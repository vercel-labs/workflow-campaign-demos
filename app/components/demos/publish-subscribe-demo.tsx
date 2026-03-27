"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Topic = "orders" | "inventory" | "shipping" | "analytics";

type PubSubEvent =
  | { type: "subscribers_registered"; subscribers: Array<{ id: string; name: string; topics: Topic[] }> }
  | { type: "message_published"; topic: Topic; payload: string }
  | { type: "filtering"; topic: Topic; total: number; matched: number }
  | { type: "delivering"; subscriberId: string; subscriberName: string; topic: Topic }
  | { type: "delivered"; subscriberId: string; subscriberName: string; topic: Topic }
  | { type: "subscriber_skipped"; subscriberId: string; subscriberName: string; topic: Topic }
  | { type: "done"; topic: Topic; delivered: number; skipped: number };

type SubscriberState = {
  id: string;
  name: string;
  topics: Topic[];
  status: "idle" | "matched" | "delivering" | "delivered" | "skipped";
};

const TOPIC_OPTIONS: Topic[] = ["orders", "inventory", "shipping", "analytics"];

const PAYLOADS: Record<Topic, string> = {
  orders: "Order #ORD-9182 created",
  inventory: "SKU-4401 inventory below threshold",
  shipping: "Shipment #PKG-3310 dispatched",
  analytics: "Daily active users crossed 10k",
};

function parseSseChunk(rawChunk: string): PubSubEvent | null {
  const payload = rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as PubSubEvent;
  } catch {
    return null;
  }
}

export function PublishSubscribeDemo() {
  const [topic, setTopic] = useState<Topic>("orders");
  const [payload, setPayload] = useState(PAYLOADS.orders);
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [subscribers, setSubscribers] = useState<SubscriberState[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [summary, setSummary] = useState<{ delivered: number; skipped: number } | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const appendLog = useCallback((line: string) => {
    setLog((current) => [...current, line]);
  }, []);

  const connectStream = useCallback(
    async (targetRunId: string, signal: AbortSignal) => {
      const response = await fetch(`/api/readable/${encodeURIComponent(targetRunId)}`, { signal });

      if (!response.ok || !response.body) {
        throw new Error("Failed to connect to workflow stream");
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

          if (event.type === "subscribers_registered") {
            setSubscribers(
              event.subscribers.map((subscriber) => ({
                ...subscriber,
                status: "idle",
              })),
            );
            appendLog(`registered ${event.subscribers.length} subscribers`);
          }

          if (event.type === "message_published") {
            appendLog(`published ${event.topic} event`);
          }

          if (event.type === "filtering") {
            setSubscribers((current) =>
              current.map((subscriber) => ({
                ...subscriber,
                status: subscriber.topics.includes(event.topic) ? "matched" : subscriber.status,
              })),
            );
            appendLog(`matched ${event.matched}/${event.total} subscribers`);
          }

          if (event.type === "subscriber_skipped") {
            setSubscribers((current) =>
              current.map((subscriber) =>
                subscriber.id === event.subscriberId
                  ? { ...subscriber, status: "skipped" }
                  : subscriber,
              ),
            );
          }

          if (event.type === "delivering") {
            setSubscribers((current) =>
              current.map((subscriber) =>
                subscriber.id === event.subscriberId
                  ? { ...subscriber, status: "delivering" }
                  : subscriber,
              ),
            );
          }

          if (event.type === "delivered") {
            setSubscribers((current) =>
              current.map((subscriber) =>
                subscriber.id === event.subscriberId
                  ? { ...subscriber, status: "delivered" }
                  : subscriber,
              ),
            );
            appendLog(`${event.subscriberName} received ${event.topic}`);
          }

          if (event.type === "done") {
            setStatus("done");
            setSummary({ delivered: event.delivered, skipped: event.skipped });
            appendLog("delivery summary emitted");
          }
        }
      }
    },
    [appendLog],
  );

  const handleStart = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRunId(null);
    setStatus("running");
    setError(null);
    setSubscribers([]);
    setLog([]);
    setSummary(null);

    try {
      const response = await fetch("/api/publish-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, payload }),
        signal: controller.signal,
      });

      const result = (await response.json()) as {
        runId?: string;
        error?: { message?: string };
      };

      if (!response.ok || !result.runId) {
        throw new Error(result.error?.message ?? "Failed to start publish-subscribe");
      }

      setRunId(result.runId);
      appendLog(`workflow started for ${topic}`);
      await connectStream(result.runId, controller.signal);
    } catch (errorValue) {
      if (controller.signal.aborted) return;
      setStatus("error");
      setError(errorValue instanceof Error ? errorValue.message : "Unexpected publish-subscribe error");
    }
  }, [appendLog, connectStream, payload, topic]);

  const deliveredCount = useMemo(
    () => subscribers.filter((subscriber) => subscriber.status === "delivered").length,
    [subscribers],
  );

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-gray-300 bg-background-100 p-5">
        <div className="grid gap-4 md:grid-cols-[180px_1fr_auto] md:items-end">
          <label className="text-sm font-medium text-gray-900">
            Topic
            <select
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-1000 outline-none focus:border-blue-700"
              onChange={(event) => {
                const nextTopic = event.target.value as Topic;
                setTopic(nextTopic);
                setPayload(PAYLOADS[nextTopic]);
              }}
              value={topic}
            >
              {TOPIC_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-900">
            Payload
            <input
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-1000 outline-none focus:border-blue-700"
              onChange={(event) => setPayload(event.target.value)}
              value={payload}
            />
          </label>
          <button
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={status === "running"}
            onClick={handleStart}
            type="button"
          >
            {status === "running" ? "Publishing..." : "Publish event"}
          </button>
        </div>
        <div className="mt-3 text-sm text-gray-900">
          <div>Run: {runId ?? "not started"}</div>
          <div>Status: {status}</div>
          <div>Delivered: {deliveredCount}</div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {subscribers.map((subscriber) => (
          <article key={subscriber.id} className="rounded-xl border border-gray-300 bg-background-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-1000">{subscriber.name}</div>
                <div className="text-xs text-gray-900">{subscriber.topics.join(", ")}</div>
              </div>
              <div className="text-xs uppercase tracking-wide text-gray-900">{subscriber.status}</div>
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-gray-300 bg-background-100 p-4">
          <h3 className="text-sm font-semibold text-gray-1000">Execution log</h3>
          <div className="mt-3 space-y-2 text-sm text-gray-900">
            {log.length > 0 ? log.map((entry, index) => <div key={`${entry}-${index}`}>{entry}</div>) : <div>No events yet.</div>}
          </div>
        </div>
        <div className="rounded-xl border border-gray-300 bg-background-100 p-4 text-sm text-gray-900">
          <h3 className="font-semibold text-gray-1000">Summary</h3>
          <div className="mt-3">Delivered: {summary?.delivered ?? 0}</div>
          <div>Skipped: {summary?.skipped ?? 0}</div>
          <div className="mt-2 text-red-700">{error ?? " "}</div>
        </div>
      </div>
    </section>
  );
}
