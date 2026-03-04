import { useMemo } from "react";
import type { OcrWord } from "../types";
import { reconstructText } from "../reconstructText";
import { useGrokSummary } from "../hooks/useGrokSummary";

interface Props {
  words: OcrWord[];
}

export function GrokSummary({ words }: Props) {
  const plainText = useMemo(() => reconstructText(words), [words]);
  const { status, summary, error, summarize, reset } = useGrokSummary();

  if (status === "idle") {
    return (
      <div className="grok-summary-container">
        <div className="grok-summary-header">
          <h3>Invoice Summary</h3>
        </div>
        <div className="grok-summary-idle">
          <button
            className="grok-summarize-btn"
            onClick={() => summarize(plainText)}
          >
            Summarize with Grok
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
          <p>Analyzing invoice with Grok...</p>
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
