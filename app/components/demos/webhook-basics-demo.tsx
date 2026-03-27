"use client";

import { useEffect, useRef, useState } from "react";

type WebhookEvent =
  | { type: "webhook_ready"; token: string }
  | { type: "event_received"; eventType: string; amount?: number }
  | { type: "response_sent"; eventType: string; action: string }
  | { type: "done"; status: "settled"; ledgerSize: number };

function parseEvent(chunk: string): WebhookEvent | null {
  const payload = chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as WebhookEvent;
  } catch {
    return null;
  }
}

export function WebhookBasicsDemo() {
  const [orderId, setOrderId] = useState("order_4242");
  const [runId, setRunId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "listening" | "settled">("idle");
  const [ledgerSize, setLedgerSize] = useState(0);
  const [events, setEvents] = useState<string[]>(["Start a run to open a durable webhook endpoint and process events."]);
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

        if (event.type === "webhook_ready") {
          setToken(event.token);
          setStatus("listening");
          setEvents((current) => [...current, `Webhook token ${event.token} is ready`]);
        }

        if (event.type === "event_received") {
          setLedgerSize((current) => current + 1);
          setEvents((current) => [
            ...current,
            `${event.eventType}${event.amount ? ` • $${(event.amount / 100).toFixed(2)}` : ""}`,
          ]);
        }

        if (event.type === "response_sent") {
          setEvents((current) => [...current, `Responded to ${event.eventType} with ${event.action}`]);
        }

        if (event.type === "done") {
          setStatus("settled");
          setLedgerSize(event.ledgerSize);
        }
      }
    }
  }

  async function startRun() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setRunId(null);
    setToken(null);
    setLedgerSize(0);
    setStatus("listening");
    setEvents(["Creating webhook workflow and replaying a demo payment sequence."]);
    setError(null);

    try {
      const response = await fetch("/api/webhook-basics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
        signal: abortRef.current.signal,
      });

      const payload = (await response.json()) as
        | { ok: true; runId: string; token: string }
        | { error?: { message?: string } };

      if (!response.ok || !("runId" in payload)) {
        throw new Error(
          ("error" in payload ? payload.error?.message : undefined) ??
            "Failed to start webhook demo",
        );
      }

      setRunId(payload.runId);
      setToken(payload.token);
      await connectToStream(payload.runId, abortRef.current.signal);
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
          <p className="text-sm font-medium text-gray-500">Webhook Basics</p>
          <h2 className="text-xl font-semibold text-gray-950">Receive events without keeping compute hot</h2>
        </div>
        <button
          className="rounded-md bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={startRun}
          disabled={status === "listening"}
        >
          {status === "listening" ? "Running..." : "Start Run"}
        </button>
      </div>

      <div className="mt-4">
        <label className="text-sm text-gray-700">
          Order ID
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            disabled={status === "listening"}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-900">Webhook Event Feed</p>
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
              <dt>Webhook token</dt>
              <dd className="truncate">{token ?? "Pending"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Ledger entries</dt>
              <dd>{ledgerSize}</dd>
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
