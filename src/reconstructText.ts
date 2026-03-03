import type { OcrWord } from "./types";

interface TextLine {
  words: OcrWord[];
  y: number;
  height: number;
}

export interface TextBlock {
  type: "text";
  content: string;
}

export interface TableBlock {
  type: "table";
  rows: string[][];
}

export type ParsedBlock = TextBlock | TableBlock;

interface ProcessedLine {
  cells: string[];
  cellStarts: number[]; // x0 of first word in each cell
  numCells: number;
  raw: TextLine;
  isParagraphBreak: boolean; // blank line before this line
}

/**
 * Group OCR words into spatial lines.
 */
function buildLines(words: OcrWord[]): TextLine[] {
  const lines: TextLine[] = [];

  for (const word of words) {
    const wordMidY = (word.bbox.y0 + word.bbox.y1) / 2;
    const wordHeight = word.bbox.y1 - word.bbox.y0;

    let matched = false;
    for (const line of lines) {
      const tolerance = Math.max(line.height, wordHeight) * 0.5;
      if (Math.abs(line.y - wordMidY) <= tolerance) {
        line.words.push(word);
        const n = line.words.length;
        line.y = line.y + (wordMidY - line.y) / n;
        line.height = line.height + (wordHeight - line.height) / n;
        matched = true;
        break;
      }
    }

    if (!matched) {
      lines.push({ words: [word], y: wordMidY, height: wordHeight });
    }
  }

  lines.sort((a, b) => a.y - b.y);
  for (const line of lines) {
    line.words.sort((a, b) => a.bbox.x0 - b.bbox.x0);
  }

  return lines;
}

/**
 * Compute the median of a numeric array.
 */
function median(arr: number[]): number {
  if (arr.length === 0) return 10;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Split a line into cells based on large x-gaps.
 * A gap > columnThreshold × medianGap is treated as a column separator.
 */
function splitIntoCells(
  line: TextLine,
  medianGap: number,
  columnThreshold: number
): { cells: string[]; cellStarts: number[] } {
  const cells: string[] = [];
  const cellStarts: number[] = [];
  let currentCell = line.words[0].text;
  let currentStart = line.words[0].bbox.x0;

  for (let i = 1; i < line.words.length; i++) {
    const gap = line.words[i].bbox.x0 - line.words[i - 1].bbox.x1;
    if (gap > medianGap * columnThreshold) {
      cells.push(currentCell.trim());
      cellStarts.push(currentStart);
      currentCell = line.words[i].text;
      currentStart = line.words[i].bbox.x0;
    } else {
      currentCell += " " + line.words[i].text;
    }
  }

  cells.push(currentCell.trim());
  cellStarts.push(currentStart);

  return { cells, cellStarts };
}

/**
 * Check whether two lines have column starts that align within tolerance.
 */
function columnsAlign(
  startsA: number[],
  startsB: number[],
  tolerance: number
): boolean {
  if (startsA.length !== startsB.length) return false;
  for (let i = 0; i < startsA.length; i++) {
    if (Math.abs(startsA[i] - startsB[i]) > tolerance) return false;
  }
  return true;
}

/**
 * Reconstruct OCR words into structured blocks: plain text and tables.
 */
export function reconstructBlocks(words: OcrWord[]): ParsedBlock[] {
  if (words.length === 0) return [];

  const lines = buildLines(words);

  // Compute median intra-word gap
  const intraGaps: number[] = [];
  for (const line of lines) {
    for (let i = 1; i < line.words.length; i++) {
      const gap = line.words[i].bbox.x0 - line.words[i - 1].bbox.x1;
      if (gap > 0) intraGaps.push(gap);
    }
  }
  const medGap = median(intraGaps);

  // Column threshold: a gap wider than 3× median is a column separator
  const COL_THRESHOLD = 3;

  // Alignment tolerance for column starts (in pixels)
  const ALIGN_TOLERANCE = medGap * 2;

  // Process each line into cells
  const processed: ProcessedLine[] = [];
  let prevY = -Infinity;
  let prevHeight = 0;

  for (const line of lines) {
    const isParagraphBreak =
      prevY !== -Infinity &&
      line.y - prevY > Math.max(prevHeight, line.height) * 1.5;

    if (line.words.length >= 2) {
      const { cells, cellStarts } = splitIntoCells(line, medGap, COL_THRESHOLD);
      processed.push({
        cells,
        cellStarts,
        numCells: cells.length,
        raw: line,
        isParagraphBreak,
      });
    } else {
      processed.push({
        cells: [line.words.map((w) => w.text).join(" ")],
        cellStarts: [line.words[0].bbox.x0],
        numCells: 1,
        raw: line,
        isParagraphBreak,
      });
    }

    prevY = line.y;
    prevHeight = line.height;
  }

  // Identify table regions: runs of 2+ consecutive lines with
  // the same number of cells (>=2) and aligned column starts.
  const isTableLine = new Array(processed.length).fill(false);

  let i = 0;
  while (i < processed.length) {
    if (processed[i].numCells < 2) {
      i++;
      continue;
    }

    // Try to extend a run of aligned multi-column lines
    let j = i + 1;
    while (
      j < processed.length &&
      !processed[j].isParagraphBreak &&
      processed[j].numCells >= 2 &&
      columnsAlign(
        processed[i].cellStarts,
        processed[j].cellStarts,
        ALIGN_TOLERANCE
      )
    ) {
      j++;
    }

    // Need at least 2 lines to form a table
    if (j - i >= 2) {
      for (let k = i; k < j; k++) {
        isTableLine[k] = true;
      }
    }

    i = j;
  }

  // Build output blocks
  const blocks: ParsedBlock[] = [];
  let textAccum: string[] = [];

  const flushText = () => {
    if (textAccum.length > 0) {
      blocks.push({ type: "text", content: textAccum.join("\n") });
      textAccum = [];
    }
  };

  i = 0;
  while (i < processed.length) {
    if (!isTableLine[i]) {
      // Plain text line
      if (processed[i].isParagraphBreak) {
        textAccum.push("");
      }
      textAccum.push(processed[i].cells.join("    "));
      i++;
    } else {
      // Table region
      flushText();
      const tableRows: string[][] = [];

      while (i < processed.length && isTableLine[i]) {
        // Normalize to the max number of columns in this table
        tableRows.push(processed[i].cells);
        i++;
      }

      // Pad rows so all have the same number of columns
      const maxCols = Math.max(...tableRows.map((r) => r.length));
      for (const row of tableRows) {
        while (row.length < maxCols) row.push("");
      }

      blocks.push({ type: "table", rows: tableRows });
    }
  }

  flushText();
  return blocks;
}

/**
 * Convenience: reconstruct as plain text (for copy-to-clipboard).
 */
export function reconstructText(words: OcrWord[]): string {
  const blocks = reconstructBlocks(words);
  const parts: string[] = [];

  for (const block of blocks) {
    if (block.type === "text") {
      parts.push(block.content);
    } else {
      // Render table as tab-separated for clipboard
      for (const row of block.rows) {
        parts.push(row.join("\t"));
      }
    }
  }

  return parts.join("\n");
}
