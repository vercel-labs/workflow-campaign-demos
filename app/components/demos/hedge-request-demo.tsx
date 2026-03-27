"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type DemoStatus = "idle" | "running" | "completed" | "error";
type EventItem = Record<string, unknown> & { type: string };

const DEFAULT_PROVIDERS = [
  { name: "alpha", simulatedLatencyMs: 900 },
  { name: "beta", simulatedLatencyMs: 600 },
  { name: "gamma", simulatedLatencyMs: 1200 },
];

function parseSseEvent(chunk: string): EventItem | null {
  const payload = chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as EventItem;
  } catch {
    return null;
  }
}

export function HedgeRequestDemo() {
  const [status, setStatus] = useState<DemoStatus>("idle");
  const [query, setQuery] = useState("translate greeting");
  const [providersJson, setProvidersJson] = useState(
    JSON.stringify(DEFAULT_PROVIDERS, null, 2),
  );
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const winner = useMemo(() => {
    const item = [...events].reverse().find((event) => event.type === "winner");
    return item?.provider ? String(item.provider) : "pending";
  }, [events]);

  const connectToStream = useCallback(async (nextRunId: string, signal: AbortSignal) => {
    const response = await fetch(`/api/readable/${nextRunId}`, { signal });
    if (!response.ok || !response.body) {
      throw new Error("Failed to connect to readable stream");
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
        const event = parseSseEvent(chunk);
        if (!event) continue;
        setEvents((current) => [...current, event]);
        if (event.type === "done") {
          setStatus("completed");
        }
      }
    }
  }, []);

  const handleStart = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("running");
    setRunId(null);
    setEvents([]);
    setError(null);

    try {
      const providers = JSON.parse(providersJson) as unknown;
      const response = await fetch("/api/hedge-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, providers }),
        signal: controller.signal,
      });
      const payload = (await response.json()) as {
        runId?: string;
        error?: { message?: string };
      };

      if (!response.ok || !payload.runId) {
        throw new Error(payload.error?.message ?? "Failed to start workflow");
      }

      setRunId(payload.runId);
      await connectToStream(payload.runId, controller.signal);
      setStatus((current) => (current === "running" ? "completed" : current));
    } catch (caught) {
      if (controller.signal.aborted) return;
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Failed to run demo");
    }
  }, [connectToStream, providersJson, query]);

  return (
    <section className="space-y-4 rounded-lg border border-gray-300 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">Hedge Request</h2>
          <p className="text-sm text-gray-600">
            Launch providers in parallel and watch the fastest response win.
          </p>
        </div>
        <span className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gray-700">
          {status}
        </span>
      </div>

      <label className="space-y-1 text-sm text-gray-700">
        <span className="font-medium">Query</span>
        <input
          className="w-full rounded-md border border-gray-300 px-3 py-2"
          onChange={(event) => setQuery(event.target.value)}
          value={query}
        />
      </label>

      <label className="space-y-1 text-sm text-gray-700">
        <span className="font-medium">Providers JSON</span>
        <textarea
          className="min-h-40 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs"
          onChange={(event) => setProvidersJson(event.target.value)}
          value={providersJson}
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          className="rounded-md bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={status === "running"}
          onClick={() => void handleStart()}
        >
          Run Demo
        </button>
        <p className="text-sm text-gray-600">Winner: {winner}</p>
      </div>

      {runId ? <p className="text-xs text-gray-500">runId: {runId}</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <ol className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
        {events.length === 0 ? <li>No provider activity yet.</li> : null}
        {events.map((event, index) => (
          <li key={`${event.type}-${index}`} className="rounded bg-white px-3 py-2">
            <span className="font-medium text-gray-950">{String(event.type)}</span>
            <span className="ml-2 text-gray-600">{JSON.stringify(event)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
