"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ServiceName = "payment-api" | "inventory-api" | "shipping-api" | "notification-api";
type RequestStatus = "pending" | "sent" | "awaiting_response" | "matched" | "delivered" | "timeout";

type CorrelationEvent =
  | { type: "correlation_id_generated"; requestId: string; correlationId: string }
  | { type: "request_sent"; requestId: string; correlationId: string; service: string }
  | { type: "awaiting_response"; requestId: string; correlationId: string; timeoutMs: number }
  | { type: "response_received"; requestId: string; correlationId: string; responseService: string; latencyMs: number }
  | {
      type: "correlation_matched";
      requestId: string;
      correlationId: string;
      requestPayloadHash: string;
      responsePayloadHash: string;
    }
  | { type: "delivery_complete"; requestId: string; correlationId: string; destination: string }
  | { type: "timeout_expired"; requestId: string; correlationId: string }
  | { type: "done"; requestId: string; correlationId: string; status: RequestStatus; totalSteps: number };

type StartResponse = {
  ok: true;
  runId: string;
  requestId: string;
  service: ServiceName;
  payload: string;
  status: string;
};

function parseSseChunk(rawChunk: string): CorrelationEvent | null {
  const payload = rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;
  try {
    return JSON.parse(payload) as CorrelationEvent;
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

export function CorrelationIdentifierDemo() {
  const [requestId, setRequestId] = useState("req-501");
  const [service, setService] = useState<ServiceName>("payment-api");
  const [payload, setPayload] = useState("charge $49.99 to card ending 4242");
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<CorrelationEvent[]>([]);
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
      const response = await fetch("/api/correlation-identifier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, service, payload }),
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
  }, [connectToStream, payload, requestId, service]);

  const summary = useMemo(() => {
    let correlationId: string | null = null;
    let latencyMs: number | null = null;
    let destination: string | null = null;
    let status: RequestStatus | null = null;

    for (const event of events) {
      if ("correlationId" in event) {
        correlationId = event.correlationId;
      }
      if (event.type === "response_received") {
        latencyMs = event.latencyMs;
      }
      if (event.type === "delivery_complete") {
        destination = event.destination;
      }
      if (event.type === "done") {
        status = event.status;
      }
    }

    return { correlationId, latencyMs, destination, status };
  }, [events]);

  return (
    <section className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">Correlation Identifier</h2>
          <p className="text-sm text-gray-600">
            Generates a correlation ID, matches the async response, and shows the delivery target for the resolved request.
          </p>
        </div>
        <div className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
          {summary.status ?? (isRunning ? "Running" : "Idle")}
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <div className="grid gap-4 md:grid-cols-[160px_180px]">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">Request ID</span>
            <input
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={requestId}
              onChange={(event) => setRequestId(event.target.value)}
              disabled={isRunning}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">Service</span>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={service}
              onChange={(event) => setService(event.target.value as ServiceName)}
              disabled={isRunning}
            >
              <option value="payment-api">payment-api</option>
              <option value="inventory-api">inventory-api</option>
              <option value="shipping-api">shipping-api</option>
              <option value="notification-api">notification-api</option>
            </select>
          </label>
        </div>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">Payload</span>
          <textarea
            className="min-h-24 w-full rounded-md border border-gray-300 px-3 py-2"
            value={payload}
            onChange={(event) => setPayload(event.target.value)}
            disabled={isRunning}
          />
        </label>
        <button
          className="w-full rounded-md bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-400 md:w-36"
          onClick={() => void handleStart()}
          disabled={isRunning}
        >
          {isRunning ? "Running..." : "Start"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p>Run ID</p>
          <p className="mt-1 font-mono text-xs">{runId ?? "Not started"}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p>Correlation ID</p>
          <p className="mt-1 font-mono text-xs break-all">{summary.correlationId ?? "Waiting"}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p>Latency</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {summary.latencyMs !== null ? `${summary.latencyMs} ms` : "n/a"}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p>Destination</p>
          <p className="mt-1 font-mono text-xs">{summary.destination ?? "n/a"}</p>
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
