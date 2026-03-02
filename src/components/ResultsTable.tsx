import { useState } from "react";
import type { OcrWord } from "../types";

interface Props {
  words: OcrWord[];
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
}

type SortKey = "index" | "confidence";

export function ResultsTable({ words, selectedIndex, onSelectIndex }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("index");
  const [sortAsc, setSortAsc] = useState(true);

  const indexed = words.map((w, i) => ({ ...w, index: i }));
  const sorted = [...indexed].sort((a, b) => {
    const v = sortKey === "confidence" ? a.confidence - b.confidence : a.index - b.index;
    return sortAsc ? v : -v;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(key === "index");
    }
  };

  const arrow = (key: SortKey) => (sortKey === key ? (sortAsc ? " ▲" : " ▼") : "");

  return (
    <div className="results-table-container">
      <h3>OCR Results ({words.length} words)</h3>
      <div className="table-scroll">
        <table className="results-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort("index")} className="sortable">
                #{arrow("index")}
              </th>
              <th>Text</th>
              <th>Type</th>
              <th onClick={() => toggleSort("confidence")} className="sortable">
                Confidence{arrow("confidence")}
              </th>
              <th>Bbox</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((w) => (
              <tr
                key={w.index}
                className={`row-${w.type} ${w.index === selectedIndex ? "row-selected" : ""}`}
                onClick={() => onSelectIndex(w.index === selectedIndex ? null : w.index)}
              >
                <td>{w.index + 1}</td>
                <td className="text-cell">{w.text}</td>
                <td>
                  <span className={`type-badge type-${w.type}`}>{w.type}</span>
                </td>
                <td>{w.confidence.toFixed(1)}%</td>
                <td className="bbox-cell">
                  {w.bbox.x0},{w.bbox.y0} → {w.bbox.x1},{w.bbox.y1}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
