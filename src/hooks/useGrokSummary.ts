import { useState, useCallback } from "react";

type SummaryStatus = "idle" | "loading" | "done" | "error";

export function useGrokSummary() {
  const [status, setStatus] = useState<SummaryStatus>("idle");
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const summarize = useCallback(async (text: string) => {
    setStatus("loading");
    setError(null);
    setSummary(null);

    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to summarize");
      }

      setSummary(data.summary);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setSummary(null);
    setError(null);
  }, []);

  return { status, summary, error, summarize, reset };
}
