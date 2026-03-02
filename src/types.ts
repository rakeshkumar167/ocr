export interface OcrWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  type: "number" | "text";
}

export interface OcrResult {
  words: OcrWord[];
  imageUrl: string;
}

export type OcrStatus = "idle" | "processing" | "done" | "error";
