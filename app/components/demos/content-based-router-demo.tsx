"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type TicketType = "billing" | "technical" | "account" | "feedback";
type TicketPriority = "low" | "medium" | "high" | "urgent";

type RouterEvent =
  | { type: "ticket_received"; ticketId: string; subject: string }
  | { type: "classifying"; ticketId: string }
  | { type: "classified"; ticketId: string; ticketType: TicketType; confidence: number }
  | { type: "routing"; ticketId: string; destination: TicketType }
  | { type: "handler_processing"; ticketId: string; destination: TicketType; step: string }
  | { type: "handler_complete"; ticketId: string; destination: TicketType; resolution: string }
  | { type: "done"; ticketId: string; routedTo: TicketType; totalSteps: number };

type StartResponse = {
  ok: true;
  runId: string;
  ticketId: string;
  subject: string;
  priority: TicketPriority;
  status: string;
};

function parseSseChunk(rawChunk: string): RouterEvent | null {
  const payload = rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;
  try {
    return JSON.parse(payload) as RouterEvent;
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

export function ContentBasedRouterDemo() {
  const [ticketId, setTicketId] = useState("ticket-1001");
  const [subject, setSubject] = useState("API timeout error in production deploy");
  const [priority, setPriority] = useState<TicketPriority>("high");
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<RouterEvent[]>([]);
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
      const response = await fetch("/api/content-based-router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, subject, priority }),
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
  }, [connectToStream, priority, subject, ticketId]);

  const summary = useMemo(() => {
    const classified = [...events].reverse().find((event) => event.type === "classified");
    const done = [...events].reverse().find((event) => event.type === "done");
    const resolved = [...events].reverse().find((event) => event.type === "handler_complete");

    return {
      ticketType: classified?.ticketType ?? null,
      confidence: classified?.confidence ?? null,
      routedTo: done?.routedTo ?? null,
      totalSteps: done?.totalSteps ?? null,
      resolution: resolved?.resolution ?? null,
    };
  }, [events]);

  return (
    <section className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">Content-Based Router</h2>
          <p className="text-sm text-gray-600">
            Classifies a ticket from its content and routes it to the correct specialized handler.
          </p>
        </div>
        <div className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
          {summary.routedTo ?? (isRunning ? "Routing" : "Idle")}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[160px_1fr_160px_140px]">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">Ticket ID</span>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={ticketId}
            onChange={(event) => setTicketId(event.target.value)}
            disabled={isRunning}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">Subject</span>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            disabled={isRunning}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">Priority</span>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={priority}
            onChange={(event) => setPriority(event.target.value as TicketPriority)}
            disabled={isRunning}
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="urgent">urgent</option>
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

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p>Run ID</p>
          <p className="mt-1 font-mono text-xs">{runId ?? "Not started"}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p>Classified as</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{summary.ticketType ?? "n/a"}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p>Confidence</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">
            {summary.confidence !== null ? `${Math.round(summary.confidence * 100)}%` : "n/a"}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p>Total steps</p>
          <p className="mt-1 text-lg font-semibold text-gray-900">{summary.totalSteps ?? "n/a"}</p>
        </div>
      </div>

      {summary.resolution ? (
        <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{summary.resolution}</p>
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
