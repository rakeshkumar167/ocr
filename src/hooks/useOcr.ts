import { useState, useCallback } from "react";
import { createWorker } from "tesseract.js";
import type { OcrResult, OcrWord, OcrStatus } from "../types";

const NUMBER_RE = /^-?[\d,]+\.?\d*%?$/;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]); // strip data:...;base64, prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function useOcr() {
  const [status, setStatus] = useState<OcrStatus>("idle");
  const [result, setResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const upload = useCallback(async (file: File) => {
    setStatus("processing");
    setError(null);
    setResult(null);
    setSelectedIndex(null);

    let worker: Awaited<ReturnType<typeof createWorker>> | null = null;

    try {
      const [base64, workerInstance] = await Promise.all([
        fileToBase64(file),
        createWorker("eng"),
      ]);
      worker = workerInstance;
      const { data } = await worker.recognize(file, {}, { blocks: true });

      const rawWords = (data.blocks ?? [])
        .flatMap((b) => b.paragraphs)
        .flatMap((p) => p.lines)
        .flatMap((l) => l.words);

      const words: OcrWord[] = rawWords
        .filter((w) => w.text.trim().length > 0)
        .map((w) => ({
          text: w.text,
          confidence: w.confidence,
          bbox: { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 },
          type: NUMBER_RE.test(w.text.trim()) ? "number" : "text",
        }));

      const imageUrl = URL.createObjectURL(file);
      setResult({ words, imageUrl, imageBase64: base64, imageMime: file.type });
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    } finally {
      if (worker) await worker.terminate();
    }
  }, []);

  const reset = useCallback(() => {
    if (result?.imageUrl) URL.revokeObjectURL(result.imageUrl);
    setStatus("idle");
    setResult(null);
    setError(null);
    setSelectedIndex(null);
  }, [result]);

  return { status, result, error, selectedIndex, setSelectedIndex, upload, reset };
}
