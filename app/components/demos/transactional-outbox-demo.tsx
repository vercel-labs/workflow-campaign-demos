"use client";

import { useEffect, useRef, useState } from "react";

type OutboxEvent =
  | { type: "persisting"; orderId: string }
  | { type: "persisted"; orderId: string; outboxId: string }
  | { type: "relaying"; outboxId: string }
  | { type: "published"; outboxId: string; brokerId: string }
  | { type: "marking_sent"; outboxId: string }
  | { type: "confirmed"; outboxId: string }
  | { type: "done"; orderId: string; outboxId: string; brokerId: string };

function parseEvent(chunk: string): OutboxEvent | null {
  const payload = chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as OutboxEvent;
  } catch {
    return null;
  }
}

export function TransactionalOutboxDemo() {
  const [orderId, setOrderId] = useState("ORD-OUTBOX-42");
  const [payload, setPayload] = useState('{"type":"order.created","amount":1299}');
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "confirmed">("idle");
  const [outboxId, setOutboxId] = useState<string | null>(null);
  const [brokerId, setBrokerId] = useState<string | null>(null);
  const [events, setEvents] = useState<string[]>(["Start a run to persist, relay, and confirm an outbox record."]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  async function connectToStream(nextRunId: string, signal: AbortSignal) {
    const response = await fetch(`/api/readable/${nextRunId}`, { signal });
    if (!response.ok || !response.body) {
      throw new Error("Readable stream unavailable");
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
        const event = parseEvent(chunk);
        if (!event) continue;

        if (event.type === "persisting") {
          setEvents((current) => [...current, `Persisting order ${event.orderId}`]);
        }

        if (event.type === "persisted") {
          setOutboxId(event.outboxId);
          setEvents((current) => [...current, `Outbox row ${event.outboxId} created`]);
        }

        if (event.type === "relaying") {
          setEvents((current) => [...current, `Relay picked up ${event.outboxId}`]);
        }

        if (event.type === "published") {
          setBrokerId(event.brokerId);
          setEvents((current) => [...current, `Published to broker as ${event.brokerId}`]);
        }

        if (event.type === "marking_sent") {
          setEvents((current) => [...current, `Marking ${event.outboxId} as sent`]);
        }

        if (event.type === "confirmed") {
          setStatus("confirmed");
        }

        if (event.type === "done") {
          setStatus("confirmed");
          setOutboxId(event.outboxId);
          setBrokerId(event.brokerId);
        }
      }
    }
  }

  async function startRun() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setRunId(null);
    setOutboxId(null);
    setBrokerId(null);
    setStatus("running");
    setError(null);
    setEvents(["Starting transactional outbox workflow."]);

    try {
      const response = await fetch("/api/transactional-outbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, payload }),
        signal: abortRef.current.signal,
      });

      const body = (await response.json()) as
        | { ok: true; runId: string }
        | { error?: { message?: string } };

      if (!response.ok || !("runId" in body)) {
        throw new Error(
          ("error" in body ? body.error?.message : undefined) ??
            "Failed to start transactional outbox",
        );
      }

      setRunId(body.runId);
      await connectToStream(body.runId, abortRef.current.signal);
    } catch (runError) {
      if (runError instanceof Error && runError.name === "AbortError") return;
      setStatus("idle");
      setError(runError instanceof Error ? runError.message : "Unknown error");
    }
  }

  return (
    <section className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">Transactional Outbox</p>
          <h2 className="text-xl font-semibold text-gray-950">Commit state changes before relaying events</h2>
        </div>
        <button
          className="rounded-md bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={startRun}
          disabled={status === "running"}
        >
          {status === "running" ? "Running..." : "Start Run"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm text-gray-700">
          Order ID
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            disabled={status === "running"}
          />
        </label>
        <label className="text-sm text-gray-700">
          Payload
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            value={payload}
            onChange={(event) => setPayload(event.target.value)}
            disabled={status === "running"}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-900">Execution Log</p>
          <div className="mt-3 space-y-2 text-sm text-gray-700">
            {events.map((event, index) => (
              <p key={`${event}-${index}`}>{event}</p>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-900">Summary</p>
          <dl className="mt-3 space-y-2 text-sm text-gray-700">
            <div className="flex justify-between gap-4">
              <dt>Status</dt>
              <dd>{status}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Outbox row</dt>
              <dd className="truncate">{outboxId ?? "Pending"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Broker ID</dt>
              <dd className="truncate">{brokerId ?? "Pending"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Run ID</dt>
              <dd className="truncate">{runId ?? "Pending"}</dd>
            </div>
          </dl>
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
