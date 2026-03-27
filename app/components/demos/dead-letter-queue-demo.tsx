"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type DemoStatus = "idle" | "running" | "completed" | "error";
type EventItem = Record<string, unknown> & { type: string };

const DEFAULT_MESSAGES = ["msg-001", "msg-002", "msg-003", "msg-004"];
const DEFAULT_POISON = ["msg-003"];

function parseSseEvent(chunk: string): EventItem | null {
  const payload = chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(payload) as EventItem;
  } catch {
    return null;
  }
}

function formatEvent(event: EventItem): string {
  if (event.type === "processing") return `Processing ${event.messageId}`;
  if (event.type === "attempt") return `Attempt ${event.attempt} for ${event.messageId}`;
  if (event.type === "success") return `${event.messageId} delivered`;
  if (event.type === "retry") return `${event.messageId} retrying: ${event.error}`;
  if (event.type === "dlq") return `${event.messageId} moved to dead letter queue`;
  if (event.type === "done") return "Batch completed";
  return JSON.stringify(event);
}

export function DeadLetterQueueDemo() {
  const [status, setStatus] = useState<DemoStatus>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [messagesInput, setMessagesInput] = useState(DEFAULT_MESSAGES.join(", "));
  const [poisonInput, setPoisonInput] = useState(DEFAULT_POISON.join(", "));
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const deliveredCount = useMemo(
    () => events.filter((event) => event.type === "success").length,
    [events],
  );
  const deadLetterCount = useMemo(
    () => events.filter((event) => event.type === "dlq").length,
    [events],
  );

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

    const messages = messagesInput
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const poisonMessages = poisonInput
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    setStatus("running");
    setRunId(null);
    setEvents([]);
    setError(null);

    try {
      const response = await fetch("/api/dead-letter-queue", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages, poisonMessages }),
        signal: controller.signal,
      });
      const payload = (await response.json()) as {
        ok?: boolean;
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
  }, [connectToStream, messagesInput, poisonInput]);

  return (
    <section className="space-y-4 rounded-lg border border-gray-300 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">Dead Letter Queue</h2>
          <p className="text-sm text-gray-600">
            Start a message batch and watch retries and dead-letter routing.
          </p>
        </div>
        <span className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gray-700">
          {status}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm text-gray-700">
          <span className="font-medium">Messages</span>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={messagesInput}
            onChange={(event) => setMessagesInput(event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm text-gray-700">
          <span className="font-medium">Poison Messages</span>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={poisonInput}
            onChange={(event) => setPoisonInput(event.target.value)}
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="rounded-md bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={status === "running"}
          onClick={() => void handleStart()}
        >
          Run Demo
        </button>
        {runId ? <p className="text-xs text-gray-500">runId: {runId}</p> : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
          <p className="font-medium text-gray-900">Delivered</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{deliveredCount}</p>
        </div>
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
          <p className="font-medium text-gray-900">Dead-lettered</p>
          <p className="mt-1 text-2xl font-semibold text-rose-700">{deadLetterCount}</p>
        </div>
      </div>

      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <ol className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
        {events.length === 0 ? <li>No events yet.</li> : null}
        {events.map((event, index) => (
          <li key={`${event.type}-${index}`} className="rounded bg-white px-3 py-2">
            <span className="font-medium text-gray-950">{event.type}</span>
            <span className="ml-2">{formatEvent(event)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
