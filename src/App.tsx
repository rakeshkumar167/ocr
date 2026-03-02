import { useOcr } from "./hooks/useOcr";
import { FileUpload } from "./components/FileUpload";
import { ImageOverlay } from "./components/ImageOverlay";
import { ResultsTable } from "./components/ResultsTable";

export function App() {
  const { status, result, error, selectedIndex, setSelectedIndex, upload, reset } = useOcr();

  const isProcessing = status === "processing";

  return (
    <div className="app">
      <header className="app-header">
        <h1>OCR Web App</h1>
        {status !== "idle" && (
          <button className="reset-btn" onClick={reset}>
            New Upload
          </button>
        )}
      </header>

      {status === "idle" && <FileUpload onUpload={upload} disabled={false} />}

      {isProcessing && (
        <div className="loading">
          <div className="spinner" />
          <p>Processing image with Tesseract OCR...</p>
        </div>
      )}

      {status === "error" && (
        <div className="error-msg">
          <p>Error: {error}</p>
          <button onClick={reset}>Try Again</button>
        </div>
      )}

      {status === "done" && result && (
        <div className="results-layout">
          <div className="results-image">
            <ImageOverlay
              imageUrl={result.imageUrl}
              words={result.words}
              selectedIndex={selectedIndex}
              onSelectIndex={setSelectedIndex}
            />
          </div>
          <div className="results-sidebar">
            <ResultsTable
              words={result.words}
              selectedIndex={selectedIndex}
              onSelectIndex={setSelectedIndex}
            />
          </div>
        </div>
      )}
    </div>
  );
}
