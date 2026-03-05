export interface OcrWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  type: "number" | "text";
}

export interface OcrResult {
  words: OcrWord[];
  imageUrl: string;
  imageBase64?: string;
  imageMime?: string;
}

export type OcrStatus = "idle" | "processing" | "done" | "error";

export interface Correction {
  wordIndex: number;
  originalText: string;
  correctedText: string;
}

export interface InvoiceListItem {
  id: string;
  created_at: number;
  invoice_date: string | null;
  invoice_description: string | null;
  invoice_amount: number | null;
  invoice_category: string | null;
  summaryPreview: string | null;
}

export interface InvoiceRecord {
  id: string;
  image_base64: string;
  image_mime: string;
  ocr_words: OcrWord[];
  summary: string | null;
  invoice_date: string | null;
  invoice_description: string | null;
  invoice_amount: number | null;
  invoice_category: string | null;
  corrections: Correction[];
  created_at: number;
}
