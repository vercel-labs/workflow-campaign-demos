"use client";

import { useEffect, useRef, useState } from "react";

type PollEvent =
  | { type: "poll_start"; poll: number; jobId: string }
  | { type: "poll_result"; poll: number; jobState: string; outcome: "not_ready" | "ready" }
  | { type: "sleep_start"; poll: number; durationMs: number }
  | { type: "sleep_end"; poll: number }
  | { type: "completed"; poll: number; jobId: string }
  | { type: "timeout"; poll: number; jobId: string }
  | { type: "done"; jobId: string; status: "completed" | "timeout"; pollCount: number };

function parseEvent(chunk: string): PollEvent | null {
  const payload = chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as PollEvent;
  } catch {
    return null;
  }
}

export function StatusPollerDemo() {
  const [jobId, setJobId] = useState("job_transcode_42");
  const [readyAtPoll, setReadyAtPoll] = useState(4);
  const [maxPolls, setMaxPolls] = useState(8);
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "completed" | "timeout">("idle");
  const [currentState, setCurrentState] = useState("queued");
  const [pollCount, setPollCount] = useState(0);
  const [events, setEvents] = useState<string[]>(["Start a run to watch the poll-sleep-poll loop."]);
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

        if (event.type === "poll_start") {
          setPollCount(event.poll);
          setEvents((current) => [...current, `Poll ${event.poll} started`]);
        }

        if (event.type === "poll_result") {
          setCurrentState(event.jobState);
          setEvents((current) => [
            ...current,
            `Poll ${event.poll}: ${event.jobState} (${event.outcome})`,
          ]);
        }

        if (event.type === "sleep_start") {
          setEvents((current) => [...current, `Sleeping ${event.durationMs}ms before poll ${event.poll + 1}`]);
        }

        if (event.type === "completed") {
          setStatus("completed");
        }

        if (event.type === "timeout") {
          setStatus("timeout");
        }

        if (event.type === "done") {
          setStatus(event.status);
          setPollCount(event.pollCount);
        }
      }
    }
  }

  async function startRun() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setRunId(null);
    setStatus("running");
    setCurrentState("queued");
    setPollCount(0);
    setError(null);
    setEvents(["Submitting poll loop."]);

    try {
      const response = await fetch("/api/status-poller", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, readyAtPoll, maxPolls, intervalMs: 900 }),
        signal: abortRef.current.signal,
      });

      const payload = (await response.json()) as
        | { ok: true; runId: string }
        | { error?: { message?: string } };

      if (!response.ok || !("runId" in payload)) {
        throw new Error(
          ("error" in payload ? payload.error?.message : undefined) ??
            "Failed to start poller",
        );
      }

      setRunId(payload.runId);
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
          <p className="text-sm font-medium text-gray-500">Status Poller</p>
          <h2 className="text-xl font-semibold text-gray-950">Repeat until the remote job becomes ready</h2>
        </div>
        <button
          className="rounded-md bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={startRun}
          disabled={status === "running"}
        >
          {status === "running" ? "Running..." : "Start Run"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="text-sm text-gray-700">
          Job ID
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            value={jobId}
            onChange={(event) => setJobId(event.target.value)}
            disabled={status === "running"}
          />
        </label>
        <label className="text-sm text-gray-700">
          Ready at poll
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            type="number"
            min={1}
            value={readyAtPoll}
            onChange={(event) => setReadyAtPoll(Number(event.target.value))}
            disabled={status === "running"}
          />
        </label>
        <label className="text-sm text-gray-700">
          Max polls
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            type="number"
            min={1}
            value={maxPolls}
            onChange={(event) => setMaxPolls(Number(event.target.value))}
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
              <dt>Current state</dt>
              <dd>{currentState}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Poll count</dt>
              <dd>{pollCount}</dd>
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
