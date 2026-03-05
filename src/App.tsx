import { useState, useEffect, useCallback } from "react";
import { useAuthContext } from "./context/AuthContext";
import { useOcr } from "./hooks/useOcr";
import { useInvoices } from "./hooks/useInvoices";
import { LoginPage } from "./components/LoginPage";
import { InvoiceHistory } from "./components/InvoiceHistory";
import { Dashboard } from "./components/Dashboard";
import { FileUpload } from "./components/FileUpload";
import { ImageOverlay } from "./components/ImageOverlay";
import { ResultsTable } from "./components/ResultsTable";
import { ParsedText } from "./components/ParsedText";
import { GrokSummary } from "./components/GrokSummary";
import { LowConfidenceEditor } from "./components/LowConfidenceEditor";
import type { Correction } from "./types";

type View = "history" | "upload" | "review" | "dashboard";

const viewMeta: Record<View, { label: string }> = {
  history: { label: "Invoices" },
  upload: { label: "New Invoice" },
  review: { label: "Invoice Detail" },
  dashboard: { label: "Dashboard" },
};

export function App() {
  const { isAuthenticated, logout, authedFetch } = useAuthContext();
  const { status, result, error, selectedIndex, setSelectedIndex, upload, reset } = useOcr();
  const {
    invoices, loading: historyLoading, fetchInvoices,
    saveInvoice, getInvoice, saveCorrections, saveSummary,
  } = useInvoices(authedFetch);

  const [view, setView] = useState<View>("history");
  const [corrections, setCorrections] = useState<Map<number, string>>(new Map());
  const [currentInvoiceId, setCurrentInvoiceId] = useState<string | null>(null);
  const [currentSummary, setCurrentSummary] = useState<string | null>(null);
  const [savedSummary, setSavedSummary] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [displayWords, setDisplayWords] = useState<import("./types").OcrWord[] | null>(null);
  const [displayImageUrl, setDisplayImageUrl] = useState<string | null>(null);
  const [pendingBase64, setPendingBase64] = useState<string | null>(null);
  const [pendingMime, setPendingMime] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) fetchInvoices();
  }, [isAuthenticated, fetchInvoices]);

  useEffect(() => {
    if (status === "done" && result) {
      setDisplayWords(result.words);
      setDisplayImageUrl(result.imageUrl);
      setPendingBase64(result.imageBase64 ?? null);
      setPendingMime(result.imageMime ?? null);
      setCurrentSummary(null);
      setSavedSummary(null);
      setView("review");
      setDirty(true);
    }
  }, [status, result]);

  const handleCorrection = useCallback((index: number, text: string) => {
    setCorrections((prev) => {
      const next = new Map(prev);
      next.set(index, text);
      return next;
    });
    setDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      let invoiceId = currentInvoiceId;
      if (!invoiceId && pendingBase64 && displayWords) {
        invoiceId = await saveInvoice(pendingBase64, pendingMime!, displayWords);
        if (invoiceId) setCurrentInvoiceId(invoiceId);
      }
      if (!invoiceId) return;

      if (corrections.size > 0) {
        const correctionsList: Correction[] = [];
        corrections.forEach((correctedText, wordIndex) => {
          correctionsList.push({
            wordIndex,
            originalText: displayWords?.[wordIndex]?.text ?? "",
            correctedText,
          });
        });
        await saveCorrections(invoiceId, correctionsList);
      }

      if (currentSummary && currentSummary !== savedSummary) {
        await saveSummary(invoiceId, currentSummary);
        setSavedSummary(currentSummary);
      }

      setDirty(false);
      fetchInvoices();
    } finally {
      setSaving(false);
    }
  }, [currentInvoiceId, pendingBase64, pendingMime, displayWords, corrections, currentSummary, savedSummary, saveInvoice, saveCorrections, saveSummary, fetchInvoices]);

  const handleSummaryDone = useCallback((summary: string) => {
    setCurrentSummary(summary);
    setDirty(true);
  }, []);

  const handleSelectInvoice = useCallback(
    async (id: string) => {
      const invoice = await getInvoice(id);
      if (invoice) {
        setCurrentInvoiceId(id);
        setDisplayWords(invoice.ocr_words);
        setDisplayImageUrl(`data:${invoice.image_mime};base64,${invoice.image_base64}`);
        setPendingBase64(null);
        setPendingMime(null);
        setCurrentSummary(invoice.summary);
        setSavedSummary(invoice.summary);
        const corrMap = new Map<number, string>();
        invoice.corrections.forEach((c) => corrMap.set(c.wordIndex, c.correctedText));
        setCorrections(corrMap);
        setDirty(false);
        setView("review");
      }
    },
    [getInvoice]
  );

  const handleNewInvoice = useCallback(() => {
    reset();
    setDisplayWords(null);
    setDisplayImageUrl(null);
    setPendingBase64(null);
    setPendingMime(null);
    setCurrentInvoiceId(null);
    setCurrentSummary(null);
    setSavedSummary(null);
    setCorrections(new Map());
    setDirty(false);
    setView("upload");
  }, [reset]);

  const handleBackToHistory = useCallback(() => {
    reset();
    setDisplayWords(null);
    setDisplayImageUrl(null);
    setPendingBase64(null);
    setPendingMime(null);
    setCurrentInvoiceId(null);
    setCurrentSummary(null);
    setSavedSummary(null);
    setCorrections(new Map());
    setDirty(false);
    fetchInvoices();
    setView("history");
  }, [reset, fetchInvoices]);

  if (!isAuthenticated) return <LoginPage />;

  const isProcessing = status === "processing";

  return (
    <div className="app">
      {/* ── Sidebar ────────────────────────────────── */}
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <h1>
            <span className="sidebar-brand-icon">
              <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </span>
            InvoiceAI
          </h1>
        </div>

        <nav className="sidebar-nav">
          <span className="sidebar-section-label">Main</span>
          <button
            className={`nav-item ${view === "history" ? "active" : ""}`}
            onClick={handleBackToHistory}
          >
            <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Invoices
          </button>
          <button
            className={`nav-item ${view === "dashboard" ? "active" : ""}`}
            onClick={() => setView("dashboard")}
          >
            <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
            Dashboard
          </button>

          <span className="sidebar-section-label">Actions</span>
          <button
            className={`nav-item ${view === "upload" ? "active" : ""}`}
            onClick={handleNewInvoice}
          >
            <svg viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Invoice
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item nav-logout" onClick={logout}>
            <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────── */}
      <main className="app-main">
        <header className="app-topbar">
          <span className="topbar-title">{viewMeta[view].label}</span>
          <div className="topbar-actions">
            {view === "review" && (
              <button
                className="btn btn-success"
                onClick={handleSave}
                disabled={saving || !dirty}
              >
                <svg viewBox="0 0 24 24"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                {saving ? "Saving..." : dirty ? "Save" : "Saved"}
              </button>
            )}
          </div>
        </header>

        <div className="app-content">
          {view === "history" && (
            <InvoiceHistory
              invoices={invoices}
              loading={historyLoading}
              onSelect={handleSelectInvoice}
              onNew={handleNewInvoice}
              onDashboard={() => setView("dashboard")}
            />
          )}

          {view === "dashboard" && (
            <Dashboard
              authedFetch={authedFetch}
              onBack={() => { fetchInvoices(); setView("history"); }}
            />
          )}

          {view === "upload" && status === "idle" && (
            <FileUpload onUpload={upload} disabled={false} />
          )}

          {isProcessing && (
            <div className="loading">
              <div className="spinner" />
              <p>Processing image with Tesseract OCR...</p>
            </div>
          )}

          {status === "error" && (
            <div className="error-msg">
              <p>Error: {error}</p>
              <button className="btn btn-primary" onClick={handleNewInvoice}>Try Again</button>
            </div>
          )}

          {view === "review" && displayWords && displayImageUrl && (
            <div className="results-layout">
              <div className="results-image">
                <ImageOverlay
                  imageUrl={displayImageUrl}
                  words={displayWords}
                  selectedIndex={selectedIndex}
                  onSelectIndex={setSelectedIndex}
                />
              </div>
              <div className="results-sidebar">
                <GrokSummary
                  words={displayWords}
                  corrections={corrections}
                  initialSummary={savedSummary}
                  onSummaryDone={handleSummaryDone}
                />
                <LowConfidenceEditor
                  words={displayWords}
                  corrections={corrections}
                  onCorrection={handleCorrection}
                  onSelectIndex={setSelectedIndex}
                />
                <ParsedText words={displayWords} />
                <ResultsTable
                  words={displayWords}
                  selectedIndex={selectedIndex}
                  onSelectIndex={setSelectedIndex}
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
