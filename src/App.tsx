import { useState, useEffect, useCallback } from "react";
import { useAuthContext } from "./context/AuthContext";
import { useOcr } from "./hooks/useOcr";
import { useInvoices } from "./hooks/useInvoices";
import { LoginPage } from "./components/LoginPage";
import { InvoiceHistory } from "./components/InvoiceHistory";
import { FileUpload } from "./components/FileUpload";
import { ImageOverlay } from "./components/ImageOverlay";
import { ResultsTable } from "./components/ResultsTable";
import { ParsedText } from "./components/ParsedText";
import { GrokSummary } from "./components/GrokSummary";
import { LowConfidenceEditor } from "./components/LowConfidenceEditor";
import type { Correction } from "./types";

type View = "history" | "upload" | "review";

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
  // savedSummary tracks what's persisted in DB — used to detect initial vs new
  const [savedSummary, setSavedSummary] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Display data — either from live OCR or loaded from DB
  const [displayWords, setDisplayWords] = useState<import("./types").OcrWord[] | null>(null);
  const [displayImageUrl, setDisplayImageUrl] = useState<string | null>(null);
  // Keep base64 data for saving new invoices
  const [pendingBase64, setPendingBase64] = useState<string | null>(null);
  const [pendingMime, setPendingMime] = useState<string | null>(null);

  // Fetch invoices on auth
  useEffect(() => {
    if (isAuthenticated) fetchInvoices();
  }, [isAuthenticated, fetchInvoices]);

  // When OCR completes, switch to review
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
      // If new invoice (no ID yet), create it first
      let invoiceId = currentInvoiceId;
      if (!invoiceId && pendingBase64 && displayWords) {
        invoiceId = await saveInvoice(pendingBase64, pendingMime!, displayWords);
        if (invoiceId) setCurrentInvoiceId(invoiceId);
      }
      if (!invoiceId) return;

      // Save corrections
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

      // Save summary if it changed
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
      <header className="app-header">
        <h1>OCR Web App</h1>
        <div className="header-actions">
          {view === "review" && (
            <button
              className="save-btn"
              onClick={handleSave}
              disabled={saving || !dirty}
            >
              {saving ? "Saving..." : dirty ? "Save" : "Saved"}
            </button>
          )}
          {view !== "history" && (
            <button className="reset-btn" onClick={handleBackToHistory}>
              History
            </button>
          )}
          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      {view === "history" && (
        <InvoiceHistory
          invoices={invoices}
          loading={historyLoading}
          onSelect={handleSelectInvoice}
          onNew={handleNewInvoice}
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
          <button onClick={handleNewInvoice}>Try Again</button>
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
  );
}
