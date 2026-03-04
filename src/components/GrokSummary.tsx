import { useMemo, useEffect, useRef } from "react";
import type { OcrWord } from "../types";
import { reconstructText } from "../reconstructText";
import { useGrokSummary } from "../hooks/useGrokSummary";

interface Props {
  words: OcrWord[];
  corrections: Map<number, string>;
  initialSummary?: string | null;
  onSummaryDone?: (summary: string) => void;
}

const LOW_CONF_THRESHOLD = 90;

export function GrokSummary({ words, corrections, initialSummary, onSummaryDone }: Props) {
  const correctedText = useMemo(() => {
    const correctedWords = words.map((w, i) => {
      if (corrections.has(i)) {
        return { ...w, text: corrections.get(i)! };
      }
      return w;
    });
    return reconstructText(correctedWords);
  }, [words, corrections]);

  const { status, summary, error, summarize, reset, setDone } = useGrokSummary();

  // If we have a saved summary and haven't fetched a new one, show it
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initialSummary && !initializedRef.current) {
      initializedRef.current = true;
      setDone(initialSummary);
    }
  }, [initialSummary, setDone]);

  const unreviewedCount = words.filter(
    (w, i) => w.confidence < LOW_CONF_THRESHOLD && !corrections.has(i)
  ).length;

  const handleSummarize = async () => {
    await summarize(correctedText);
  };

  // notify parent when a NEW summary arrives (not the initial one)
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (status === "done" && summary && onSummaryDone && !notifiedRef.current && summary !== initialSummary) {
      notifiedRef.current = true;
      onSummaryDone(summary);
    }
    if (status !== "done") notifiedRef.current = false;
  }, [status, summary, onSummaryDone, initialSummary]);

  if (status === "idle") {
    return (
      <div className="grok-summary-container">
        <div className="grok-summary-header">
          <h3>Invoice Summary</h3>
        </div>
        <div className="grok-summary-idle">
          <button
            className="grok-summarize-btn"
            onClick={handleSummarize}
          >
            {unreviewedCount > 0
              ? `AI Analyze (${unreviewedCount} unreviewed)`
              : "AI Analyze"}
          </button>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="grok-summary-container">
        <div className="grok-summary-header">
          <h3>Invoice Summary</h3>
        </div>
        <div className="grok-summary-loading">
          <div className="spinner" />
          <p>Analyzing invoice...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="grok-summary-container">
        <div className="grok-summary-header">
          <h3>Invoice Summary</h3>
          <button className="grok-retry-btn" onClick={reset}>
            Retry
          </button>
        </div>
        <div className="grok-summary-error">
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grok-summary-container">
      <div className="grok-summary-header">
        <h3>Invoice Summary</h3>
        <button className="grok-retry-btn" onClick={reset}>
          Re-analyze
        </button>
      </div>
      <div className="grok-summary-result">
        <pre className="grok-summary-pre">{summary}</pre>
      </div>
    </div>
  );
}
