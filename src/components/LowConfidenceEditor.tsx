import type { OcrWord } from "../types";

interface Props {
  words: OcrWord[];
  corrections: Map<number, string>;
  onCorrection: (index: number, text: string) => void;
  onSelectIndex: (index: number | null) => void;
}

const LOW_CONF_THRESHOLD = 90;

export function LowConfidenceEditor({ words, corrections, onCorrection, onSelectIndex }: Props) {
  const lowConfWords = words
    .map((w, i) => ({ word: w, index: i }))
    .filter(({ word }) => word.confidence < LOW_CONF_THRESHOLD);

  if (lowConfWords.length === 0) {
    return (
      <div className="low-conf-container">
        <div className="low-conf-header">
          <h3>Review Words</h3>
        </div>
        <p className="low-conf-empty">All words have high confidence.</p>
      </div>
    );
  }

  const unreviewedCount = lowConfWords.filter(({ index }) => !corrections.has(index)).length;

  return (
    <div className="low-conf-container">
      <div className="low-conf-header">
        <h3>Review Words</h3>
        {unreviewedCount > 0 && (
          <span className="review-badge">{unreviewedCount} unreviewed</span>
        )}
      </div>
      <div className="low-conf-list">
        {lowConfWords.map(({ word, index }) => (
          <div
            key={index}
            className={`low-conf-item${corrections.has(index) ? " reviewed" : ""}`}
            onMouseEnter={() => onSelectIndex(index)}
            onMouseLeave={() => onSelectIndex(null)}
          >
            <div className="low-conf-meta">
              <span className="low-conf-original">{word.text}</span>
              <span className="low-conf-score">{word.confidence.toFixed(0)}%</span>
            </div>
            <input
              type="text"
              className="low-conf-input"
              value={corrections.get(index) ?? word.text}
              onChange={(e) => onCorrection(index, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
