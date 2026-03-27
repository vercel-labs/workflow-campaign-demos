"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type DemoStatus = "idle" | "running" | "completed" | "error";
type EventItem = Record<string, unknown> & { type: string };
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

const SIGNALS = ["payment", "inventory", "fraud"] as const;
type SignalKind = (typeof SIGNALS)[number];

export function EventGatewayDemo() {
  const [status, setStatus] = useState<DemoStatus>("idle");
  const [orderId, setOrderId] = useState("ord-1001");
  const [timeoutMs, setTimeoutMs] = useState(6500);
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

  const receivedSignals = useMemo(() => {
    return new Set(
      events
        .filter((event) => event.type === "signal_received")
        .map((event) => String(event.signal)),
    );
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
      const response = await fetch("/api/event-gateway", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId, timeoutMs }),
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
      void connectToStream(payload.runId, controller.signal);
    } catch (caught) {
      if (controller.signal.aborted) return;
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Failed to run demo");
    }
  }, [connectToStream, orderId, timeoutMs]);

  return (
    <section className="space-y-4 rounded-lg border border-gray-300 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">Event Gateway</h2>
          <p className="text-sm text-gray-600">
            Start the workflow and watch the gateway wait for signals until the timeout path completes.
          </p>
        </div>
        <span className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gray-700">
          {status}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm text-gray-700">
          <span className="font-medium">Order ID</span>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm text-gray-700">
          <span className="font-medium">Timeout (ms)</span>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            min={3000}
            onChange={(event) => setTimeoutMs(Number(event.target.value))}
            type="number"
            value={timeoutMs}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="rounded-md bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={status === "running"}
          onClick={() => void handleStart()}
        >
          Start Gateway
        </button>
        <p className="text-sm text-gray-600">
          Mounted gallery mode exposes the start route and readable stream only.
        </p>
      </div>

      {runId ? <p className="text-xs text-gray-500">runId: {runId}</p> : null}

      <div className="grid gap-3 md:grid-cols-3">
        {SIGNALS.map((kind) => (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm" key={kind}>
            <p className="font-medium capitalize text-gray-900">{kind}</p>
            <p className="mt-1 text-gray-600">
              {receivedSignals.has(kind) ? "received" : "awaiting timeout"}
            </p>
          </div>
        ))}
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <ol className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
        {events.length === 0 ? <li>No events yet.</li> : null}
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
