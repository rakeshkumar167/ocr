import { useMemo } from "react";
import type { OcrWord } from "../types";
import {
  reconstructBlocks,
  reconstructText,
  type ParsedBlock,
} from "../reconstructText";

interface Props {
  words: OcrWord[];
}

export function ParsedText({ words }: Props) {
  const blocks = useMemo(() => reconstructBlocks(words), [words]);
  const plainText = useMemo(() => reconstructText(words), [words]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(plainText);
  };

  return (
    <div className="parsed-text-container">
      <div className="parsed-text-header">
        <h3>Parsed Text</h3>
        <button className="copy-btn" onClick={handleCopy}>
          Copy
        </button>
      </div>
      <div className="parsed-text-content">
        {blocks.map((block, i) => (
          <BlockRenderer key={i} block={block} />
        ))}
      </div>
    </div>
  );
}

function BlockRenderer({ block }: { block: ParsedBlock }) {
  if (block.type === "text") {
    return <pre className="parsed-text-pre">{block.content}</pre>;
  }

  return (
    <div className="parsed-table-wrapper">
      <table className="parsed-table">
        <tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
