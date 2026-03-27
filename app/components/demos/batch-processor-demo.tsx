"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type BatchEvent =
  | { type: "batch_start"; batch: number; start: number; end: number; label: string }
  | { type: "batch_done"; batch: number; start: number; end: number; label: string }
  | { type: "crash"; afterBatch: number; message: string }
  | { type: "resume"; fromBatch: number }
  | { type: "complete"; totalBatches: number; processedRecords: number }
  | { type: "done"; status: "done"; totalBatches: number; processedRecords: number };

type StartResponse = {
  ok: true;
  runId: string;
  totalRecords: number;
  batchSize: number;
  totalBatches: number;
  crashAfterBatches: number | null;
  status: string;
};

function parseSseChunk(rawChunk: string): BatchEvent | null {
  const payload = rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;
  try {
    return JSON.parse(payload) as BatchEvent;
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

export function BatchProcessorDemo() {
  const [totalRecords, setTotalRecords] = useState(10_000);
  const [batchSize, setBatchSize] = useState(1_000);
  const [crashAfterBatches, setCrashAfterBatches] = useState<number | "none">("none");
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<BatchEvent[]>([]);
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
      const response = await fetch(`/api/readable/${nextRunId}`, { signal: controller.signal });
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
    setRunId(null);
    setEvents([]);
    setError(null);
    setIsRunning(true);

    try {
      const response = await fetch("/api/batch-processor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalRecords,
          batchSize,
          crashAfterBatches: crashAfterBatches === "none" ? null : crashAfterBatches,
        }),
      });
      const data = (await response.json()) as StartResponse | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(parseApiError(data, "Failed to start workflow"));
      }

      const startData = data as StartResponse;
      setRunId(startData.runId);
      void connectToStream(startData.runId);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Failed to start workflow");
      setIsRunning(false);
    }
  }, [batchSize, connectToStream, crashAfterBatches, totalRecords]);

  const progress = useMemo(() => {
    const started = new Set<number>();
    const finished = new Set<number>();
    let crashed: string | null = null;
    let resumedFrom: number | null = null;
    let final: { totalBatches: number; processedRecords: number } | null = null;

    for (const event of events) {
      if (event.type === "batch_start") started.add(event.batch);
      if (event.type === "batch_done") finished.add(event.batch);
      if (event.type === "crash") crashed = event.message;
      if (event.type === "resume") resumedFrom = event.fromBatch;
      if (event.type === "done") {
        final = {
          totalBatches: event.totalBatches,
          processedRecords: event.processedRecords,
        };
      }
    }

    return {
      started: started.size,
      finished: finished.size,
      crashed,
      resumedFrom,
      final,
    };
  }, [events]);

  return (
    <section className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">Batch Processor</h2>
          <p className="text-sm text-gray-600">
            Processes records in batches and shows checkpoint, crash, and resume behavior in the stream.
          </p>
        </div>
        <div className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
          {progress.final ? "Completed" : isRunning ? "Running" : "Idle"}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">Total records</span>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            type="number"
            min={1000}
            step={1000}
            value={totalRecords}
            onChange={(event) => setTotalRecords(Number(event.target.value) || 10000)}
            disabled={isRunning}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">Batch size</span>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            type="number"
            min={100}
            step={100}
            value={batchSize}
            onChange={(event) => setBatchSize(Number(event.target.value) || 1000)}
            disabled={isRunning}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">Crash after</span>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={String(crashAfterBatches)}
            onChange={(event) =>
              setCrashAfterBatches(event.target.value === "none" ? "none" : Number(event.target.value))
            }
            disabled={isRunning}
          >
            <option value="none">Never</option>
            <option value="2">2 batches</option>
            <option value="5">5 batches</option>
          </select>
        </label>
        <button
          className="rounded-md bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-400"
          onClick={() => void handleStart()}
          disabled={isRunning}
        >
          {isRunning ? "Running..." : "Start"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p>Run ID</p>
          <p className="mt-1 font-mono text-xs">{runId ?? "Not started"}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p>Batches finished</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{progress.finished}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p>Resume point</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{progress.resumedFrom ?? "n/a"}</p>
        </div>
      </div>

      {progress.crashed ? (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{progress.crashed}</p>
      ) : null}
      {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-800">Event stream</h3>
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
    </section>
  );
}
