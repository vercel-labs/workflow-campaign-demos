"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type CCEvent =
  | { type: "claiming"; itemId: string; consumerId: string }
  | { type: "claimed"; itemId: string; consumerId: string }
  | { type: "duplicate"; itemId: string; consumerId: string; wonBy: string }
  | { type: "processing"; itemId: string; consumerId: string }
  | { type: "processed"; itemId: string; consumerId: string }
  | { type: "done"; summary: { processed: number; duplicatesBlocked: number } };

type StartResponse = { ok: true; runId: string; items: string[]; consumers: string[]; status: string };

function parseSseChunk(rawChunk: string): CCEvent | null {
  const payload = rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;
  try {
    return JSON.parse(payload) as CCEvent;
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

export function CompetingConsumersDemo() {
  const [itemsText, setItemsText] = useState("item-1, item-2, item-3");
  const [consumersText, setConsumersText] = useState("alpha, beta, gamma");
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<CCEvent[]>([]);
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

    const items = itemsText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const consumers = consumersText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      const response = await fetch("/api/competing-consumers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, consumers }),
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
  }, [connectToStream, consumersText, itemsText]);

  const summary = useMemo(() => {
    const doneEvent = [...events].reverse().find((event) => event.type === "done");
    return doneEvent?.summary ?? null;
  }, [events]);

  return (
    <section className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">Competing Consumers</h2>
          <p className="text-sm text-gray-600">
            Simulates several consumers racing to claim the same work and highlights how duplicates get blocked.
          </p>
        </div>
        <div className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
          {summary ? "Completed" : isRunning ? "Running" : "Idle"}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_140px]">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">Items</span>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={itemsText}
            onChange={(event) => setItemsText(event.target.value)}
            disabled={isRunning}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">Consumers</span>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={consumersText}
            onChange={(event) => setConsumersText(event.target.value)}
            disabled={isRunning}
          />
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
          <p>Processed</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{summary?.processed ?? 0}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p>Duplicates blocked</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{summary?.duplicatesBlocked ?? 0}</p>
        </div>
      </div>

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
