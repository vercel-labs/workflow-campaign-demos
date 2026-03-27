"use client";

import { useEffect, useRef, useState } from "react";

type DigestEvent =
  | { type: "window_open"; token: string; windowMs: number }
  | { type: "event_received"; event: { type: string; message: string }; eventCount: number }
  | { type: "window_closed"; eventCount: number }
  | { type: "sending_digest"; eventCount: number }
  | { type: "digest_sent"; eventCount: number }
  | { type: "digest_empty" }
  | { type: "done"; status: "sent" | "empty"; eventCount: number };

function parseEvent(chunk: string): DigestEvent | null {
  const payload = chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as DigestEvent;
  } catch {
    return null;
  }
}

export function ScheduledDigestDemo() {
  const [userId, setUserId] = useState("user_123");
  const [windowMs, setWindowMs] = useState(4000);
  const [runId, setRunId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "collecting" | "sending" | "sent" | "empty">("idle");
  const [events, setEvents] = useState<string[]>(["Start a run to collect events into a digest window."]);
  const [received, setReceived] = useState<Array<{ type: string; message: string }>>([]);
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

        if (event.type === "window_open") {
          setToken(event.token);
          setStatus("collecting");
          setEvents((current) => [...current, `Digest window opened for ${event.windowMs}ms`]);
        }

        if (event.type === "event_received") {
          setReceived((current) => [...current, event.event]);
          setEvents((current) => [...current, `${event.event.type}: ${event.event.message}`]);
        }

        if (event.type === "window_closed") {
          setEvents((current) => [...current, `Window closed with ${event.eventCount} events`]);
        }

        if (event.type === "sending_digest") {
          setStatus("sending");
        }

        if (event.type === "digest_sent") {
          setStatus("sent");
          setEvents((current) => [...current, `Digest sent with ${event.eventCount} entries`]);
        }

        if (event.type === "digest_empty") {
          setStatus("empty");
        }

        if (event.type === "done") {
          setStatus(event.status);
        }
      }
    }
  }

  async function startRun() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setRunId(null);
    setToken(null);
    setError(null);
    setStatus("collecting");
    setReceived([]);
    setEvents(["Opening digest collection window."]);

    try {
      const response = await fetch("/api/scheduled-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, windowMs }),
        signal: abortRef.current.signal,
      });

      const payload = (await response.json()) as
        | { ok: true; runId: string; token: string }
        | { error?: { message?: string } };

      if (!response.ok || !("runId" in payload)) {
        throw new Error(
          ("error" in payload ? payload.error?.message : undefined) ??
            "Failed to start scheduled digest",
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
          <p className="text-sm font-medium text-gray-500">Scheduled Digest</p>
          <h2 className="text-xl font-semibold text-gray-950">Collect events, then send one summary</h2>
        </div>
        <button
          className="rounded-md bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={startRun}
          disabled={status === "collecting" || status === "sending"}
        >
          {status === "collecting" || status === "sending" ? "Running..." : "Start Run"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm text-gray-700">
          User ID
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            disabled={status === "collecting" || status === "sending"}
          />
        </label>
        <label className="text-sm text-gray-700">
          Window (ms)
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            type="number"
            min={1000}
            step={500}
            value={windowMs}
            onChange={(event) => setWindowMs(Number(event.target.value))}
            disabled={status === "collecting" || status === "sending"}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-900">Collected Events</p>
          <div className="mt-3 space-y-2 text-sm text-gray-700">
            {received.length === 0 ? (
              <p>No events received yet.</p>
            ) : (
              received.map((event, index) => (
                <p key={`${event.type}-${index}`}>
                  <span className="font-medium">{event.type}</span> {event.message}
                </p>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-900">Execution Log</p>
          <p className="mt-1 text-xs text-gray-500">{runId ? `run ${runId}` : "idle"}</p>
          <div className="mt-3 space-y-2 text-sm text-gray-700">
            {events.map((event, index) => (
              <p key={`${event}-${index}`}>{event}</p>
            ))}
          </div>
          <dl className="mt-4 space-y-2 text-sm text-gray-700">
            <div className="flex justify-between gap-4">
              <dt>Status</dt>
              <dd>{status}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Hook token</dt>
              <dd className="truncate">{token ?? "Pending"}</dd>
            </div>
          </dl>
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
