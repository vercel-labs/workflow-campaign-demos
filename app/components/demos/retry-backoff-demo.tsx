"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type RetryEvent =
  | { type: "attempt_start"; attempt: number; contactId: string }
  | { type: "attempt_fail"; attempt: number; error: string; sleepMs: number }
  | { type: "attempt_success"; attempt: number; contactId: string }
  | { type: "done"; status: "completed" | "failed"; attempts: number };

type AttemptState = {
  attempt: number;
  status: string;
  detail: string;
};

function parseSseChunk(rawChunk: string): RetryEvent | null {
  const payload = rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as RetryEvent;
  } catch {
    return null;
  }
}

export function RetryBackoffDemo() {
  const [contactId, setContactId] = useState("contact-123");
  const [failuresBeforeSuccess, setFailuresBeforeSuccess] = useState(2);
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<AttemptState[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<string | null>(null);

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

          if (event.type === "attempt_start") {
            setAttempts((current) => [
              ...current.filter((attempt) => attempt.attempt !== event.attempt),
              { attempt: event.attempt, status: "running", detail: event.contactId },
            ]);
            appendLog(`attempt ${event.attempt} started`);
          }

          if (event.type === "attempt_fail") {
            setAttempts((current) =>
              current.map((attempt) =>
                attempt.attempt === event.attempt
                  ? { ...attempt, status: "sleeping", detail: `${event.error} • ${event.sleepMs}ms` }
                  : attempt,
              ),
            );
            appendLog(`attempt ${event.attempt} failed`);
          }

          if (event.type === "attempt_success") {
            setAttempts((current) =>
              current.map((attempt) =>
                attempt.attempt === event.attempt
                  ? { ...attempt, status: "succeeded", detail: event.contactId }
                  : attempt,
              ),
            );
            appendLog(`attempt ${event.attempt} succeeded`);
          }

          if (event.type === "done") {
            setStatus("done");
            setResult(`${event.status} after ${event.attempts} attempts`);
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
    setAttempts([]);
    setLog([]);
    setResult(null);

    try {
      const response = await fetch("/api/retry-backoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          maxAttempts: 5,
          baseDelayMs: 1000,
          failuresBeforeSuccess,
        }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as {
        runId?: string;
        error?: { message?: string };
      };

      if (!response.ok || !payload.runId) {
        throw new Error(payload.error?.message ?? "Failed to start retry-backoff");
      }

      setRunId(payload.runId);
      appendLog(`workflow started for ${contactId}`);
      await connectStream(payload.runId, controller.signal);
    } catch (errorValue) {
      if (controller.signal.aborted) return;
      setStatus("error");
      setError(errorValue instanceof Error ? errorValue.message : "Unexpected retry-backoff error");
    }
  }, [appendLog, connectStream, contactId, failuresBeforeSuccess]);

  const completedAttempts = useMemo(
    () => attempts.filter((attempt) => attempt.status === "succeeded").length,
    [attempts],
  );

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-gray-300 bg-background-100 p-5">
        <div className="grid gap-4 md:grid-cols-[1fr_180px_auto] md:items-end">
          <label className="text-sm font-medium text-gray-900">
            Contact ID
            <input
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-1000 outline-none focus:border-blue-700"
              onChange={(event) => setContactId(event.target.value)}
              value={contactId}
            />
          </label>
          <label className="text-sm font-medium text-gray-900">
            Failures before success
            <input
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-1000 outline-none focus:border-blue-700"
              min={0}
              onChange={(event) => setFailuresBeforeSuccess(Number(event.target.value))}
              type="number"
              value={failuresBeforeSuccess}
            />
          </label>
          <button
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={status === "running"}
            onClick={handleStart}
            type="button"
          >
            {status === "running" ? "Retrying..." : "Start sync"}
          </button>
        </div>
        <div className="mt-3 text-sm text-gray-900">
          <div>Run: {runId ?? "not started"}</div>
          <div>Status: {status}</div>
          <div>Successful attempts: {completedAttempts}</div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {attempts.map((attempt) => (
          <article key={attempt.attempt} className="rounded-xl border border-gray-300 bg-background-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-gray-1000">Attempt {attempt.attempt}</div>
              <div className="text-xs uppercase tracking-wide text-gray-900">{attempt.status}</div>
            </div>
            <div className="mt-2 text-sm text-gray-900">{attempt.detail}</div>
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
          <h3 className="font-semibold text-gray-1000">Result</h3>
          <div className="mt-3">{result ?? "pending"}</div>
          <div className="mt-2 text-red-700">{error ?? " "}</div>
        </div>
      </div>
    </section>
  );
}
