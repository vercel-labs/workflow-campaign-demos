"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type AggregatorEvent =
  | { type: "collecting"; batchId: string; tokens: Record<string, string>; expectedCount: number; timeoutMs: number }
  | { type: "signal_received"; batchId: string; source: string; value: number; receivedCount: number; expectedCount: number }
  | { type: "all_collected"; batchId: string }
  | { type: "timeout"; batchId: string; missing: string[]; received: string[] }
  | { type: "processing"; batchId: string }
  | {
      type: "done";
      batchId: string;
      status: "aggregated" | "partial";
      summary: AggregatorSummary;
    };

type AggregatorSummary = {
  totalSignals: number;
  receivedSignals: number;
  totalValue: number;
  sources: string[];
};

type StartResponse = { ok: true; runId: string; batchId: string; timeoutMs: number; status: string };

function parseSseChunk(rawChunk: string): AggregatorEvent | null {
  const payload = rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;
  try {
    return JSON.parse(payload) as AggregatorEvent;
  } catch {
    return null;
  }
}

function parseApiError(data: unknown, fallback: string) {
  if (data && typeof data === "object" && "error" in data) {
    const error = (data as { error?: { message?: unknown } }).error;
    if (error && typeof error.message === "string") {
      return error.message;
    }
  }
  return fallback;
}

export function AggregatorDemo() {
  const [runId, setRunId] = useState<string | null>(null);
  const [batchId, setBatchId] = useState(`batch-${Date.now().toString(36)}`);
  const [timeoutMs, setTimeoutMs] = useState(8000);
  const [events, setEvents] = useState<AggregatorEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const connectToStream = useCallback(async (nextRunId: string) => {
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`/api/readable/${nextRunId}`, {
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        throw new Error("Failed to connect to stream");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.replaceAll("\r\n", "\n").split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const event = parseSseChunk(chunk);
          if (!event) continue;
          setEvents((current) => [...current, event]);
          if (event.type === "done") {
            setIsRunning(false);
          }
        }
      }
    } catch (streamError) {
      if (streamError instanceof Error && streamError.name === "AbortError") return;
      setError(streamError instanceof Error ? streamError.message : "Stream failed");
      setIsRunning(false);
    }
  }, []);

  const handleStart = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setEvents([]);
    setError(null);
    setIsRunning(true);

    try {
      const response = await fetch("/api/aggregator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, timeoutMs }),
      });
      const data = (await response.json()) as StartResponse | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(parseApiError(data, "Failed to start workflow"));
      }

      const startData = data as StartResponse;
      setRunId(startData.runId);
      setBatchId(startData.batchId);
      setTimeoutMs(startData.timeoutMs);
      void connectToStream(startData.runId);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Failed to start workflow");
      setIsRunning(false);
    }
  }, [batchId, connectToStream, timeoutMs]);

  const stage = useMemo(() => {
    if (events.some((event) => event.type === "done")) return "Completed";
    if (events.some((event) => event.type === "processing")) return "Processing";
    if (events.some((event) => event.type === "timeout")) return "Timed out";
    if (events.some((event) => event.type === "collecting")) return "Collecting";
    return isRunning ? "Starting" : "Idle";
  }, [events, isRunning]);

  const sourceProgress = useMemo(() => {
    const received = new Map<string, number>();
    let missing: string[] = [];
    let summary: AggregatorSummary | null = null;

    for (const event of events) {
      if (event.type === "signal_received") {
        received.set(event.source, event.value);
      }
      if (event.type === "timeout") {
        missing = event.missing;
      }
      if (event.type === "done") {
        summary = event.summary;
      }
    }

    return {
      received,
      missing,
      summary,
    };
  }, [events]);

  return (
    <section className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">Aggregator</h2>
          <p className="text-sm text-gray-600">
            Starts a batch run, streams signal collection, and shows whether the result was complete or partial.
          </p>
        </div>
        <div className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
          {stage}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_180px_140px]">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">Batch ID</span>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={batchId}
            onChange={(event) => setBatchId(event.target.value)}
            disabled={isRunning}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">Timeout (ms)</span>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            type="number"
            min={1000}
            step={1000}
            value={timeoutMs}
            onChange={(event) => setTimeoutMs(Number(event.target.value) || 8000)}
            disabled={isRunning}
          />
        </label>
        <button
          className="rounded-md bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-400"
          onClick={() => void handleStart()}
          disabled={isRunning}
        >
          {isRunning ? "Running..." : "Start Batch"}
        </button>
      </div>

      {runId ? (
        <p className="mt-4 text-xs text-gray-500">
          Run ID: <span className="font-mono">{runId}</span>
        </p>
      ) : null}

      {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h3 className="text-sm font-semibold text-gray-800">Signals</h3>
          <div className="mt-3 space-y-2">
            {["warehouse-a", "warehouse-b", "warehouse-c"].map((source) => {
              const value = sourceProgress.received.get(source);
              const isMissing = sourceProgress.missing.includes(source);
              return (
                <div key={source} className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2">
                  <span className="text-sm text-gray-700">{source}</span>
                  <span className="text-xs font-medium text-gray-600">
                    {value !== undefined ? `received: ${value}` : isMissing ? "missed" : "pending"}
                  </span>
                </div>
              );
            })}
          </div>
          {sourceProgress.summary ? (
            <div className="mt-4 space-y-1 text-sm text-gray-700">
              <p>Total value: {sourceProgress.summary.totalValue}</p>
              <p>
                Received {sourceProgress.summary.receivedSignals} / {sourceProgress.summary.totalSignals}
              </p>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h3 className="text-sm font-semibold text-gray-800">Event Stream</h3>
          <ol className="mt-3 space-y-2">
            {events.length === 0 ? (
              <li className="rounded-md border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500">
                No events yet.
              </li>
            ) : (
              events.map((event, index) => (
                <li key={`${event.type}-${index}`} className="rounded-md border border-gray-200 bg-white px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{event.type}</p>
                  <pre className="mt-1 overflow-x-auto text-xs text-gray-700">{JSON.stringify(event, null, 2)}</pre>
                </li>
              ))
            )}
          </ol>
        </div>
      </div>
    </section>
  );
}
