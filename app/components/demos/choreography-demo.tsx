"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ParticipantId =
  | "order-service"
  | "inventory-service"
  | "payment-service"
  | "shipping-service";

type ChoreographyEvent =
  | { type: "event_emitted"; participant: ParticipantId; event: string; correlationId: string; message: string }
  | { type: "event_received"; participant: ParticipantId; event: string; correlationId: string; message: string }
  | { type: "step_started"; participant: ParticipantId; message: string }
  | { type: "step_completed"; participant: ParticipantId; message: string }
  | { type: "step_retrying"; participant: ParticipantId; attempt: number }
  | { type: "compensation_started"; participant: ParticipantId; reason: string; correlationId: string }
  | { type: "compensation_completed"; participant: ParticipantId; message: string; correlationId: string }
  | { type: "sleeping"; participant: ParticipantId; duration: string; reason: string }
  | {
      type: "done";
      correlationId: string;
      outcome: "fulfilled" | "compensated";
      summary: {
        correlationId: string;
        outcome: "fulfilled" | "compensated";
        participantsInvolved: ParticipantId[];
        eventsEmitted: number;
        trackingId: string | null;
        failedService: ParticipantId | null;
      };
    };

type StartResponse = {
  ok: true;
  runId: string;
  orderId: string;
  items: Array<{ name: string; qty: number }>;
  failService: string | null;
  status: string;
};

function parseSseChunk(rawChunk: string): ChoreographyEvent | null {
  const payload = rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;
  try {
    return JSON.parse(payload) as ChoreographyEvent;
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

export function ChoreographyDemo() {
  const [orderId, setOrderId] = useState("ord-3001");
  const [itemsJson, setItemsJson] = useState('[{"name":"keyboard","qty":1},{"name":"mouse","qty":2}]');
  const [failService, setFailService] = useState<"none" | "inventory" | "payment" | "shipping">("none");
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<ChoreographyEvent[]>([]);
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
      const items = JSON.parse(itemsJson) as Array<{ name: string; qty: number }>;
      const response = await fetch("/api/choreography", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          items,
          failService: failService === "none" ? null : failService,
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
  }, [connectToStream, failService, itemsJson, orderId]);

  const summary = useMemo(() => {
    const doneEvent = [...events].reverse().find((event) => event.type === "done");
    return doneEvent?.summary ?? null;
  }, [events]);

  return (
    <section className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">Choreography</h2>
          <p className="text-sm text-gray-600">
            Shows event-driven coordination across services and whether the flow fulfilled or compensated.
          </p>
        </div>
        <div className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
          {summary?.outcome ?? (isRunning ? "Running" : "Idle")}
        </div>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">Order ID</span>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            disabled={isRunning}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">Items JSON</span>
          <textarea
            className="min-h-28 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs"
            value={itemsJson}
            onChange={(event) => setItemsJson(event.target.value)}
            disabled={isRunning}
          />
        </label>
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <label className="text-sm md:w-56">
            <span className="mb-1 block font-medium text-gray-700">Fail service</span>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={failService}
              onChange={(event) =>
                setFailService(event.target.value as "none" | "inventory" | "payment" | "shipping")
              }
              disabled={isRunning}
            >
              <option value="none">None</option>
              <option value="inventory">Inventory</option>
              <option value="payment">Payment</option>
              <option value="shipping">Shipping</option>
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
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p>Run ID</p>
          <p className="mt-1 font-mono text-xs">{runId ?? "Not started"}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p>Participants</p>
          <p className="mt-1 text-sm">{summary?.participantsInvolved.join(", ") ?? "n/a"}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p>Tracking ID</p>
          <p className="mt-1 font-mono text-xs">{summary?.trackingId ?? "n/a"}</p>
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
