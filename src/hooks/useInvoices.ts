import { useState, useCallback } from "react";
import type { InvoiceListItem, InvoiceRecord, OcrWord, Correction } from "../types";

export function useInvoices(authedFetch: (url: string, init?: RequestInit) => Promise<Response>) {
  const [invoices, setInvoices] = useState<InvoiceListItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authedFetch("/api/invoices");
      if (res.ok) {
        const data = await res.json();
        const sorted = (data.invoices as InvoiceListItem[]).sort((a, b) => {
          // Try to parse invoice_date for both; fall back to created_at
          const da = a.invoice_date ? new Date(a.invoice_date).getTime() : NaN;
          const db_ = b.invoice_date ? new Date(b.invoice_date).getTime() : NaN;
          const ta = isNaN(da) ? a.created_at : da;
          const tb = isNaN(db_) ? b.created_at : db_;
          return tb - ta; // newest first
        });
        setInvoices(sorted);
      }
    } finally {
      setLoading(false);
    }
  }, [authedFetch]);

  const saveInvoice = useCallback(
    async (imageBase64: string, imageMime: string, words: OcrWord[]): Promise<string | null> => {
      const res = await authedFetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: imageBase64, image_mime: imageMime, ocr_words: words }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.id;
      }
      return null;
    },
    [authedFetch]
  );

  const getInvoice = useCallback(
    async (id: string): Promise<InvoiceRecord | null> => {
      const res = await authedFetch(`/api/invoices/${id}`);
      if (res.ok) return res.json();
      return null;
    },
    [authedFetch]
  );

  const saveCorrections = useCallback(
    async (invoiceId: string, corrections: Correction[]): Promise<boolean> => {
      const res = await authedFetch(`/api/invoices/${invoiceId}/corrections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ corrections }),
      });
      return res.ok;
    },
    [authedFetch]
  );

  const summarizeInvoice = useCallback(
    async (invoiceId: string, text: string): Promise<string | null> => {
      const res = await authedFetch(`/api/invoices/${invoiceId}/summarize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.summary;
      }
      return null;
    },
    [authedFetch]
  );

  const saveSummary = useCallback(
    async (invoiceId: string, summary: string): Promise<boolean> => {
      const res = await authedFetch(`/api/invoices/${invoiceId}/summary`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
      });
      return res.ok;
    },
    [authedFetch]
  );

  return { invoices, loading, fetchInvoices, saveInvoice, getInvoice, saveCorrections, summarizeInvoice, saveSummary };
}
