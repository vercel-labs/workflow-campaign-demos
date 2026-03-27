"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type RateLimitEvent =
  | {
      type: "attempt_start";
      attempt: number;
      contactId: string;
      idempotencyKey: string;
    }
  | { type: "http_429"; attempt: number; retryAfterMs: number }
  | { type: "retry_scheduled"; attempt: number; retryAfterMs: number }
  | { type: "step_done"; step: "fetch" | "upsert"; attempt: number }
  | {
      type: "done";
      contactId: string;
      status: "synced";
      totalAttempts: number;
    };

type AttemptState = "pending" | "requesting" | "rate-limited" | "waiting" | "succeeded";

type AttemptSnapshot = {
  attempt: number;
  state: AttemptState;
  retryAfterMs: number;
  idempotencyKey: string;
};

type LogEntry = {
  id: string;
  text: string;
  tone: "default" | "success" | "warning";
};

function parseSseChunk(rawChunk: string): RateLimitEvent | null {
  const payload = rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as RateLimitEvent;
  } catch {
    return null;
  }
}

function logTone(tone: LogEntry["tone"]): string {
  if (tone === "success") return "text-green-700";
  if (tone === "warning") return "text-amber-700";
  return "text-gray-900";
}

export function RetryableRateLimitDemo() {
  const [contactId, setContactId] = useState("contact-123");
  const [failuresBeforeSuccess, setFailuresBeforeSuccess] = useState(2);
  const [runId, setRunId] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<AttemptSnapshot[]>([]);
  const [status, setStatus] = useState<"idle" | "running" | "completed" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const appendLog = useCallback((tone: LogEntry["tone"], text: string) => {
    setLog((current) => [
      ...current,
      { id: `${Date.now()}-${current.length}`, tone, text },
    ]);
  }, []);

  const connectStream = useCallback(
    async (targetRunId: string, signal: AbortSignal) => {
      const response = await fetch(`/api/readable/${encodeURIComponent(targetRunId)}`, {
        signal,
      });

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
              {
                attempt: event.attempt,
                state: "requesting",
                retryAfterMs: 0,
                idempotencyKey: event.idempotencyKey,
              },
            ]);
            appendLog("default", `Attempt ${event.attempt} started`);
          }

          if (event.type === "http_429") {
            setAttempts((current) =>
              current.map((attempt) =>
                attempt.attempt === event.attempt
                  ? { ...attempt, state: "rate-limited", retryAfterMs: event.retryAfterMs }
                  : attempt,
              ),
            );
            appendLog("warning", `Attempt ${event.attempt} returned HTTP 429`);
          }

          if (event.type === "retry_scheduled") {
            setAttempts((current) =>
              current.map((attempt) =>
                attempt.attempt === event.attempt
                  ? { ...attempt, state: "waiting", retryAfterMs: event.retryAfterMs }
                  : attempt,
              ),
            );
            appendLog(
              "warning",
              `Runtime scheduled retry after ${event.retryAfterMs}ms`,
            );
          }

          if (event.type === "step_done" && event.step === "fetch") {
            setAttempts((current) =>
              current.map((attempt) =>
                attempt.attempt === event.attempt
                  ? { ...attempt, state: "succeeded", retryAfterMs: 0 }
                  : attempt,
              ),
            );
            appendLog("success", `Attempt ${event.attempt} fetched CRM data`);
          }

          if (event.type === "step_done" && event.step === "upsert") {
            appendLog("success", `Warehouse upsert completed on attempt ${event.attempt}`);
          }

          if (event.type === "done") {
            setStatus("completed");
            appendLog("success", `Sync completed after ${event.totalAttempts} attempts`);
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

    setStatus("running");
    setRunId(null);
    setAttempts([]);
    setError(null);
    setLog([]);

    try {
      const response = await fetch("/api/retryable-rate-limit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId, failuresBeforeSuccess }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as {
        runId?: string;
        error?: { message?: string };
      };

      if (!response.ok || !payload.runId) {
        throw new Error(payload.error?.message ?? "Failed to start rate-limit demo");
      }

      setRunId(payload.runId);
      await connectStream(payload.runId, controller.signal);
    } catch (errorValue) {
      if (controller.signal.aborted) return;
      setStatus("error");
      setError(
        errorValue instanceof Error ? errorValue.message : "Unexpected retryable rate-limit error",
      );
    }
  }, [connectStream, contactId, failuresBeforeSuccess]);

  const completedAttempts = useMemo(
    () => attempts.filter((attempt) => attempt.state === "succeeded").length,
    [attempts],
  );

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-gray-300 bg-background-100 p-5">
        <div className="grid gap-4 md:grid-cols-[1fr,180px,auto]">
          <label className="text-sm font-medium text-gray-900">
            Contact ID
            <input
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-1000 outline-none focus:border-amber-700"
              value={contactId}
              onChange={(event) => setContactId(event.target.value)}
            />
          </label>
          <label className="text-sm font-medium text-gray-900">
            Failures before success
            <select
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-1000 outline-none focus:border-amber-700"
              value={failuresBeforeSuccess}
              onChange={(event) => setFailuresBeforeSuccess(Number(event.target.value))}
            >
              {[0, 1, 2, 3, 4].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={handleStart}
            disabled={status === "running"}
            className="self-end rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-500"
          >
            {status === "running" ? "Running..." : "Start Sync"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-900">
          <span className="rounded-full border border-gray-300 px-3 py-1">
            Status: {status}
          </span>
          <span className="rounded-full border border-gray-300 px-3 py-1">
            Successful attempts: {completedAttempts}
          </span>
          {runId ? (
            <span className="rounded-full border border-gray-300 px-3 py-1 font-mono text-xs">
              runId: {runId}
            </span>
          ) : null}
        </div>

        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {attempts.length === 0 ? (
          <div className="rounded-xl border border-gray-300 bg-background-100 p-4 text-sm text-gray-900">
            No attempts yet.
          </div>
        ) : (
          attempts
            .slice()
            .sort((left, right) => left.attempt - right.attempt)
            .map((attempt) => (
              <article
                key={attempt.attempt}
                className="rounded-xl border border-gray-300 bg-background-100 p-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-1000">
                    Attempt {attempt.attempt}
                  </h3>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      attempt.state === "succeeded"
                        ? "bg-green-700/15 text-green-700"
                        : attempt.state === "rate-limited" || attempt.state === "waiting"
                          ? "bg-amber-700/15 text-amber-700"
                          : "bg-cyan-700/15 text-cyan-700"
                    }`}
                  >
                    {attempt.state}
                  </span>
                </div>
                <p className="mt-2 break-all font-mono text-xs text-gray-900">
                  {attempt.idempotencyKey}
                </p>
                {attempt.retryAfterMs > 0 ? (
                  <p className="mt-2 text-sm text-amber-700">
                    retryAfter: {attempt.retryAfterMs}ms
                  </p>
                ) : null}
              </article>
            ))
        )}
      </div>

      <div className="rounded-xl border border-gray-300 bg-background-100 p-5">
        <h3 className="text-sm font-semibold text-gray-1000">Execution Log</h3>
        <div className="mt-3 space-y-2 text-sm">
          {log.length === 0 ? (
            <p className="text-gray-900">No events yet.</p>
          ) : (
            log.map((entry) => (
              <p key={entry.id} className={logTone(entry.tone)}>
                {entry.text}
              </p>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
