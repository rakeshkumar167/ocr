import { useEffect, useRef, useState } from "react";
import type { OcrWord } from "../types";

interface Props {
  imageUrl: string;
  words: OcrWord[];
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
}

const TEXT_COLOR = "rgba(34, 197, 94, ";   // green
const NUMBER_COLOR = "rgba(59, 130, 246, "; // blue

export function ImageOverlay({ imageUrl, words, selectedIndex, onSelectIndex }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const onLoad = () => {
      const container = containerRef.current;
      if (!container) return;
      const containerWidth = container.clientWidth;
      const s = Math.min(1, containerWidth / img.naturalWidth);
      setScale(s);
    };

    img.addEventListener("load", onLoad);
    if (img.complete) onLoad();
    return () => img.removeEventListener("load", onLoad);
  }, [imageUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.complete) return;

    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, w, h);

    words.forEach((word, i) => {
      const isActive = i === selectedIndex || i === hoveredIndex;
      const baseColor = word.type === "number" ? NUMBER_COLOR : TEXT_COLOR;
      const alpha = 0.15 + (word.confidence / 100) * 0.35;
      const strokeAlpha = isActive ? 1 : 0.6 + (word.confidence / 100) * 0.4;

      const { x0, y0, x1, y1 } = word.bbox;
      const sx = x0 * scale, sy = y0 * scale;
      const sw = (x1 - x0) * scale, sh = (y1 - y0) * scale;

      ctx.fillStyle = baseColor + (isActive ? 0.4 : alpha) + ")";
      ctx.fillRect(sx, sy, sw, sh);

      ctx.strokeStyle = baseColor + strokeAlpha + ")";
      ctx.lineWidth = isActive ? 3 : 1.5;
      ctx.strokeRect(sx, sy, sw, sh);

      if (isActive) {
        ctx.font = `bold ${Math.max(11, 13 * scale)}px sans-serif`;
        ctx.fillStyle = "#fff";
        const textY = sy - 4;
        const metrics = ctx.measureText(word.text);
        ctx.fillStyle = baseColor + "0.85)";
        ctx.fillRect(sx, textY - 13 * scale, metrics.width + 6, 15 * scale);
        ctx.fillStyle = "#fff";
        ctx.fillText(word.text, sx + 3, textY);
      }
    });
  }, [words, scale, selectedIndex, hoveredIndex]);

  const handleCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    const idx = words.findIndex(
      (w) => x >= w.bbox.x0 && x <= w.bbox.x1 && y >= w.bbox.y0 && y <= w.bbox.y1
    );
    setHoveredIndex(idx >= 0 ? idx : null);
  };

  const handleCanvasClick = () => {
    if (hoveredIndex !== null) {
      onSelectIndex(hoveredIndex === selectedIndex ? null : hoveredIndex);
    }
  };

  return (
    <div className="image-overlay-container" ref={containerRef}>
      <img
        ref={imgRef}
        src={imageUrl}
        alt="Uploaded"
        style={{ width: `${(imgRef.current?.naturalWidth ?? 800) * scale}px`, display: "block" }}
      />
      <canvas
        ref={canvasRef}
        className="overlay-canvas"
        onMouseMove={handleCanvasMove}
        onMouseLeave={() => setHoveredIndex(null)}
        onClick={handleCanvasClick}
        title={hoveredIndex !== null ? `${words[hoveredIndex].text} (${words[hoveredIndex].confidence.toFixed(1)}%)` : undefined}
      />
    </div>
  );
}
