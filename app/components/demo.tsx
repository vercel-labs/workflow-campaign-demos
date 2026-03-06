"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RateLimitCodeWorkbench } from "./retryable-rate-limit-code-workbench";

/* ------------------------------------------------------------------ */
/*  Event types (mirrors workflow RateLimitEvent)                      */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Client-side state types                                            */
/* ------------------------------------------------------------------ */

type AttemptState =
  | "requesting"
  | "rate-limited"
  | "waiting-retry"
  | "succeeded"
  | "pending";

type DemoAttempt = {
  attempt: number;
  idempotencyKey: string;
  state: AttemptState;
  httpStatus: number;
  retryAfterMs: number;
  retryStartedAtMs: number;
};

type RetryLogEventKind =
  | "attempt"
  | "rate-limited"
  | "retry-scheduled"
  | "retry-wakeup"
  | "success"
  | "upsert"
  | "upsert-done";

type RetryLogEvent = {
  atMs: number;
  attempt: number;
  kind: RetryLogEventKind;
  message: string;
};

type PhaseKind = "idle" | "attempt" | "waiting-retry" | "upsert" | "done";

type LifecycleState = "idle" | "running" | "completed" | "failed";
type HighlightTone = "amber" | "cyan" | "green" | "red";

type WorkflowLineMap = {
  fetchCall: number[];
  upsertCall: number[];
  successReturn: number[];
};

type StepLineMap = {
  fetchCall: number[];
  retryableErrorThrow: number[];
  serverErrorThrow: number[];
  returnJson: number[];
};

type RateLimitDemoProps = {
  workflowCode: string;
  workflowHtmlLines: string[];
  workflowLineMap: WorkflowLineMap;
  stepCode: string;
  stepHtmlLines: string[];
  stepLineMap: StepLineMap;
};

/* ------------------------------------------------------------------ */
/*  Accumulator for reducing SSE events into UI state                  */
/* ------------------------------------------------------------------ */

type Accumulator = {
  attempts: DemoAttempt[];
  events: RetryLogEvent[];
  phase: PhaseKind;
  currentAttempt: number | null;
  retryAfterMs: number | null;
  lastErrorKind: "rate-limited" | null;
  upsertDone: boolean;
  fetchDone: boolean;
  totalAttempts: number | null;
};

function createAccumulator(): Accumulator {
  return {
    attempts: [],
    events: [],
    phase: "idle",
    currentAttempt: null,
    retryAfterMs: null,
    lastErrorKind: null,
    upsertDone: false,
    fetchDone: false,
    totalAttempts: null,
  };
}

function reduceEvent(
  acc: Accumulator,
  event: RateLimitEvent,
  elapsedMs: number
): Accumulator {
  const next = { ...acc, attempts: [...acc.attempts], events: [...acc.events] };

  switch (event.type) {
    case "attempt_start": {
      next.attempts.push({
        attempt: event.attempt,
        idempotencyKey: event.idempotencyKey,
        state: "requesting",
        httpStatus: 0,
        retryAfterMs: 0,
        retryStartedAtMs: 0,
      });
      next.phase = "attempt";
      next.currentAttempt = event.attempt;
      next.lastErrorKind = null;
      next.events.push({
        atMs: elapsedMs,
        attempt: event.attempt,
        kind: "attempt",
        message: `Attempt ${event.attempt} — fetch(crm.example.com) [key: ${event.idempotencyKey}]`,
      });
      return next;
    }

    case "http_429": {
      const idx = next.attempts.findIndex((a) => a.attempt === event.attempt);
      if (idx >= 0) {
        next.attempts[idx] = {
          ...next.attempts[idx],
          state: "rate-limited",
          httpStatus: 429,
          retryAfterMs: event.retryAfterMs,
        };
      }
      next.lastErrorKind = "rate-limited";
      next.events.push({
        atMs: elapsedMs,
        attempt: event.attempt,
        kind: "rate-limited",
        message: `HTTP 429 — RetryableError { retryAfter: ${event.retryAfterMs} }`,
      });
      return next;
    }

    case "retry_scheduled": {
      const idx = next.attempts.findIndex((a) => a.attempt === event.attempt);
      if (idx >= 0) {
        next.attempts[idx] = {
          ...next.attempts[idx],
          state: "waiting-retry",
          retryStartedAtMs: Date.now(),
        };
      }
      next.phase = "waiting-retry";
      next.retryAfterMs = event.retryAfterMs;
      next.events.push({
        atMs: elapsedMs,
        attempt: event.attempt,
        kind: "retry-scheduled",
        message: `Runtime scheduling retry after ${event.retryAfterMs}ms`,
      });
      return next;
    }

    case "step_done": {
      if (event.step === "fetch") {
        const idx = next.attempts.findIndex((a) => a.attempt === event.attempt);
        if (idx >= 0) {
          next.attempts[idx] = {
            ...next.attempts[idx],
            state: "succeeded",
            httpStatus: 200,
          };
        }
        next.phase = "upsert";
        next.fetchDone = true;
        next.events.push({
          atMs: elapsedMs,
          attempt: event.attempt,
          kind: "success",
          message: "HTTP 200 OK — contact data returned",
        });
        next.events.push({
          atMs: elapsedMs,
          attempt: event.attempt,
          kind: "upsert",
          message: "upsertIntoWarehouse() started",
        });
      } else if (event.step === "upsert") {
        next.upsertDone = true;
        next.events.push({
          atMs: elapsedMs,
          attempt: event.attempt,
          kind: "upsert-done",
          message: "upsertIntoWarehouse() completed",
        });
      }
      return next;
    }

    case "done": {
      next.phase = "done";
      next.totalAttempts = event.totalAttempts;
      return next;
    }

    default:
      return next;
  }
}

/* ------------------------------------------------------------------ */
/*  SSE parsing                                                        */
/* ------------------------------------------------------------------ */

function parseSseData(rawChunk: string): string {
  return rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
}

function parseRateLimitEvent(rawChunk: string): RateLimitEvent | null {
  const payload = parseSseData(rawChunk);
  if (!payload) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const evt = parsed as Record<string, unknown>;

  if (
    evt.type === "attempt_start" &&
    typeof evt.attempt === "number" &&
    typeof evt.contactId === "string" &&
    typeof evt.idempotencyKey === "string"
  ) {
    return evt as RateLimitEvent;
  }
  if (evt.type === "http_429" && typeof evt.attempt === "number" && typeof evt.retryAfterMs === "number") {
    return evt as RateLimitEvent;
  }
  if (evt.type === "retry_scheduled" && typeof evt.attempt === "number" && typeof evt.retryAfterMs === "number") {
    return evt as RateLimitEvent;
  }
  if (evt.type === "step_done" && typeof evt.step === "string" && typeof evt.attempt === "number") {
    return evt as RateLimitEvent;
  }
  if (evt.type === "done" && typeof evt.contactId === "string") {
    return evt as RateLimitEvent;
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const DEFAULT_CONTACT_ID = "contact-42";
const DEFAULT_FAIL_FIRST = 2;
const FAIL_FIRST_MIN = 0;
const FAIL_FIRST_MAX = 4;
const FAIL_FIRST_OPTIONS = Array.from(
  { length: FAIL_FIRST_MAX - FAIL_FIRST_MIN + 1 },
  (_, index) => FAIL_FIRST_MIN + index
);

function formatDurationLabel(durationMs: number): string {
  if (durationMs >= 1000 && durationMs % 1000 === 0) {
    return `${durationMs / 1000}s`;
  }
  return `${durationMs}ms`;
}

function formatElapsedLabel(durationMs: number): string {
  const seconds = (durationMs / 1000).toFixed(2);
  return `${seconds}s`;
}

/* ------------------------------------------------------------------ */
/*  Main Demo Component                                                */
/* ------------------------------------------------------------------ */

export function RateLimitDemo({
  workflowCode,
  workflowHtmlLines,
  workflowLineMap,
  stepCode,
  stepHtmlLines,
  stepLineMap,
}: RateLimitDemoProps) {
  const [contactId, setContactId] = useState(DEFAULT_CONTACT_ID);
  const [failFirst, setFailFirst] = useState(DEFAULT_FAIL_FIRST);

  const [lifecycle, setLifecycle] = useState<LifecycleState>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const accRef = useRef<Accumulator>(createAccumulator());
  const [acc, setAcc] = useState<Accumulator>(createAccumulator());

  const abortRef = useRef<AbortController | null>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const startedAtRef = useRef(0);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopElapsedTicker = useCallback(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  const startElapsedTicker = useCallback(() => {
    stopElapsedTicker();
    tickerRef.current = setInterval(() => {
      if (startedAtRef.current > 0) {
        setElapsedMs(Date.now() - startedAtRef.current);
      }
    }, 80);
  }, [stopElapsedTicker]);

  useEffect(() => {
    return () => {
      stopElapsedTicker();
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [stopElapsedTicker]);

  const applyEvent = useCallback((event: RateLimitEvent) => {
    const elapsed = startedAtRef.current > 0 ? Date.now() - startedAtRef.current : 0;
    accRef.current = reduceEvent(accRef.current, event, elapsed);
    setAcc({ ...accRef.current });
  }, []);

  const connectToReadable = useCallback(
    async (targetRunId: string) => {
      const controller = abortRef.current;
      if (!controller) return;
      const signal = controller.signal;

      try {
        const response = await fetch(
          `/api/readable/${encodeURIComponent(targetRunId)}`,
          { cache: "no-store", signal }
        );

        if (!response.ok || !response.body) {
          throw new Error(`Readable stream request failed (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const normalized = buffer.replaceAll("\r\n", "\n");
          const chunks = normalized.split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const chunk of chunks) {
            if (signal.aborted) return;
            const event = parseRateLimitEvent(chunk);
            if (event) applyEvent(event);
          }
        }

        // Handle remaining buffer
        if (!signal.aborted && buffer.trim()) {
          const event = parseRateLimitEvent(buffer.replaceAll("\r\n", "\n"));
          if (event) applyEvent(event);
        }

        // Stream ended — workflow complete
        if (!signal.aborted) {
          setLifecycle("completed");
          stopElapsedTicker();
        }
      } catch (cause: unknown) {
        if (cause instanceof Error && cause.name === "AbortError") return;
        if (signal.aborted) return;

        const detail = cause instanceof Error ? cause.message : "Stream failed";
        setError(detail);
        setLifecycle("failed");
        stopElapsedTicker();
      }
    },
    [applyEvent, stopElapsedTicker]
  );

  const hasScrolledRef = useRef(false);

  useEffect(() => {
    if (lifecycle !== "idle" && !hasScrolledRef.current) {
      hasScrolledRef.current = true;
      const heading = document.getElementById("try-it-heading");
      if (heading) {
        const top = heading.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top, behavior: "smooth" });
      }
    }
    if (lifecycle === "idle") {
      hasScrolledRef.current = false;
    }
  }, [lifecycle]);

  const handleStart = useCallback(async () => {
    setError(null);
    stopElapsedTicker();
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    accRef.current = createAccumulator();
    setAcc(createAccumulator());
    setElapsedMs(0);

    const signal = abortRef.current.signal;

    try {
      const res = await fetch("/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: contactId.trim() || DEFAULT_CONTACT_ID,
          failuresBeforeSuccess: failFirst,
        }),
        signal,
      });

      const payload = await res.json();
      if (signal.aborted) return;

      if (!res.ok || !payload.ok) {
        setError(payload?.error?.message ?? `Start failed (${res.status})`);
        return;
      }

      setRunId(payload.runId);
      setLifecycle("running");
      startedAtRef.current = Date.now();
      startElapsedTicker();

      void connectToReadable(payload.runId);
    } catch (startError) {
      if (signal.aborted || (startError instanceof Error && startError.name === "AbortError")) return;
      const message = startError instanceof Error ? startError.message : "Failed to start";
      setError(message);
      setLifecycle("idle");
    }
  }, [connectToReadable, contactId, failFirst, startElapsedTicker, stopElapsedTicker]);

  const handleReset = useCallback(() => {
    stopElapsedTicker();
    abortRef.current?.abort();
    abortRef.current = null;
    accRef.current = createAccumulator();
    setAcc(createAccumulator());
    setLifecycle("idle");
    setRunId(null);
    setElapsedMs(0);
    setError(null);
    setTimeout(() => startButtonRef.current?.focus(), 0);
  }, [stopElapsedTicker]);

  const isRunning = lifecycle === "running";

  /* ---------------------------------------------------------------- */
  /*  Phase explainer                                                  */
  /* ---------------------------------------------------------------- */

  const phaseExplainer = useMemo(() => {
    if (lifecycle === "idle") return "Waiting to start a CRM sync.";

    if (acc.phase === "attempt") {
      return `Attempt ${acc.currentAttempt} — fetching from CRM API...`;
    }
    if (acc.phase === "waiting-retry") {
      return `RetryableError thrown — runtime will retry after ${formatDurationLabel(acc.retryAfterMs ?? 0)}`;
    }
    if (acc.phase === "upsert" && !acc.upsertDone) {
      return "Contact fetched — running upsertIntoWarehouse() step...";
    }
    if (lifecycle === "completed" || acc.phase === "done") {
      const lastSuccess = acc.attempts.find((a) => a.state === "succeeded");
      return `Sync completed on attempt ${lastSuccess?.attempt ?? "?"}. Contact upserted to warehouse.`;
    }
    if (lifecycle === "failed") {
      return "Sync failed.";
    }
    return "Run is active.";
  }, [lifecycle, acc]);

  /* ---------------------------------------------------------------- */
  /*  Code workbench state                                             */
  /* ---------------------------------------------------------------- */

  type GutterMarkKind = "success" | "fail";

  const codeState = useMemo(() => {
    const wfMarks: Record<number, GutterMarkKind> = {};
    const stepMarks: Record<number, GutterMarkKind> = {};

    // Show fail marks for rate-limited attempts
    if (acc.lastErrorKind === "rate-limited" && acc.phase === "waiting-retry") {
      for (const ln of stepLineMap.fetchCall) stepMarks[ln] = "fail";
      for (const ln of stepLineMap.retryableErrorThrow) stepMarks[ln] = "fail";
    }

    // Show success marks on fetch + return
    if (acc.fetchDone) {
      for (const ln of workflowLineMap.fetchCall) wfMarks[ln] = "success";
      for (const ln of stepLineMap.fetchCall) stepMarks[ln] = "success";
      for (const ln of stepLineMap.returnJson) stepMarks[ln] = "success";
    }

    // Upsert done
    if (acc.upsertDone) {
      for (const ln of workflowLineMap.upsertCall) wfMarks[ln] = "success";
    }

    // Final success
    if (lifecycle === "completed" || acc.phase === "done") {
      for (const ln of workflowLineMap.successReturn) wfMarks[ln] = "success";
    }

    if (lifecycle === "idle") {
      return {
        tone: "amber" as HighlightTone,
        workflowActiveLines: [] as number[],
        stepActiveLines: [] as number[],
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    if (acc.phase === "attempt") {
      return {
        tone: "amber" as HighlightTone,
        workflowActiveLines: workflowLineMap.fetchCall,
        stepActiveLines: stepLineMap.fetchCall,
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    if (acc.phase === "waiting-retry") {
      return {
        tone: "red" as HighlightTone,
        workflowActiveLines: [] as number[],
        stepActiveLines: stepLineMap.retryableErrorThrow,
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    if (acc.phase === "upsert" && !acc.upsertDone) {
      return {
        tone: "amber" as HighlightTone,
        workflowActiveLines: workflowLineMap.upsertCall,
        stepActiveLines: [] as number[],
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    if (lifecycle === "completed" || acc.phase === "done") {
      return {
        tone: "green" as HighlightTone,
        workflowActiveLines: workflowLineMap.successReturn,
        stepActiveLines: [] as number[],
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    return {
      tone: "red" as HighlightTone,
      workflowActiveLines: [] as number[],
      stepActiveLines: [] as number[],
      workflowGutterMarks: wfMarks,
      stepGutterMarks: stepMarks,
    };
  }, [lifecycle, acc, stepLineMap, workflowLineMap]);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-700/40 bg-red-700/10 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="rounded-lg border border-gray-400/70 bg-background-100 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            ref={startButtonRef}
            type="button"
            onClick={handleStart}
            disabled={isRunning}
            className="min-h-10 cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Run Sync
          </button>
          {lifecycle !== "idle" && (
            <button
              type="button"
              onClick={handleReset}
              className="min-h-10 cursor-pointer rounded-md border border-gray-400 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:border-gray-300 hover:text-gray-1000"
            >
              Reset
            </button>
          )}
          <label className="inline-flex items-center gap-1.5 rounded-md border border-gray-400/80 bg-background-200 px-2 py-1.5">
            <span className="text-xs text-gray-900">ID</span>
            <input
              type="text"
              aria-label="Contact ID"
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              disabled={isRunning}
              className="h-8 w-24 rounded border border-gray-400 bg-background-100 px-2 text-sm font-mono text-gray-1000 transition-colors focus:border-gray-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
          <label className="inline-flex items-center gap-1.5 rounded-md border border-gray-400/80 bg-background-200 px-2 py-1.5">
            <span className="text-xs text-gray-900">429s first</span>
            <select
              aria-label="Number of 429 failures before success"
              value={failFirst}
              onChange={(event) =>
                setFailFirst(Number.parseInt(event.target.value, 10))
              }
              disabled={isRunning}
              className="h-8 w-14 rounded border border-gray-400 bg-background-100 px-1 text-center text-sm font-mono tabular-nums text-gray-1000 transition-colors focus:border-gray-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {FAIL_FIRST_OPTIONS.map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-gray-400/70 bg-background-100 p-3">
        <div
          className="mb-2 flex flex-wrap items-center justify-between gap-2"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm text-gray-900">{phaseExplainer}</p>
          {runId && (
            <span className="rounded-full bg-background-200 px-2.5 py-1 text-xs font-mono text-gray-900">
              run: {runId}
            </span>
          )}
        </div>

        <div className="lg:h-[200px]">
          <div className="grid grid-cols-1 gap-2 lg:h-full lg:grid-cols-2">
            <AttemptLadder
              attempts={acc.attempts}
              currentPhase={acc.phase}
              contactId={contactId}
            />
            <ExecutionLog elapsedMs={elapsedMs} events={acc.events} />
          </div>
        </div>
      </div>

      <p className="text-center text-xs italic text-gray-900">
        RetryableError tells the runtime when to retry — no manual sleep loops
        needed
      </p>

      <RateLimitCodeWorkbench
        workflowCode={workflowCode}
        workflowHtmlLines={workflowHtmlLines}
        workflowActiveLines={codeState.workflowActiveLines}
        workflowGutterMarks={codeState.workflowGutterMarks}
        stepCode={stepCode}
        stepHtmlLines={stepHtmlLines}
        stepActiveLines={codeState.stepActiveLines}
        stepGutterMarks={codeState.stepGutterMarks}
        tone={codeState.tone}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AttemptLadder                                                      */
/* ------------------------------------------------------------------ */

function AttemptLadder({
  attempts,
  currentPhase,
}: {
  attempts: DemoAttempt[];
  currentPhase: PhaseKind;
  contactId: string;
}) {
  if (attempts.length === 0) {
    return (
      <div className="h-full min-h-0 rounded-lg border border-gray-400/60 bg-background-200 p-2 text-xs text-gray-900">
        No attempts yet.
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto rounded-lg border border-gray-400/60 bg-background-200 p-2">
      <div className="space-y-1">
        {attempts.map((attempt) => {
          const statusTone = attemptTone(attempt.state);
          const retryLabel =
            attempt.retryAfterMs > 0
              ? `Retry-After: ${formatDurationLabel(attempt.retryAfterMs)}`
              : "";

          return (
            <article
              key={attempt.attempt}
              className={`rounded-md border px-2 py-1.5 ${statusTone.cardClass}`}
              aria-label={`Attempt ${attempt.attempt}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${statusTone.dotClass}`}
                  aria-hidden="true"
                />
                <p className="text-sm font-medium text-gray-1000">
                  #{attempt.attempt}
                </p>
                {attempt.httpStatus > 0 && (
                  <span
                    className={`rounded-full border px-1.5 py-0.5 text-xs font-semibold leading-none tabular-nums ${statusTone.badgeClass}`}
                  >
                    {attempt.httpStatus}
                  </span>
                )}
                <span className="hidden truncate text-xs font-mono text-gray-900 sm:inline">
                  {attempt.idempotencyKey}
                </span>
                {retryLabel && (
                  <p className="ml-auto text-xs font-mono tabular-nums text-cyan-700">
                    {retryLabel}
                    {attempt.state === "waiting-retry" &&
                    currentPhase === "waiting-retry"
                      ? " *"
                      : ""}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ExecutionLog                                                        */
/* ------------------------------------------------------------------ */

function ExecutionLog({
  events,
  elapsedMs,
}: {
  events: RetryLogEvent[];
  elapsedMs: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [events.length]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-gray-400/60 bg-background-200 p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900">
          Execution log
        </h3>
        <p className="text-xs font-mono tabular-nums text-gray-900">
          {formatElapsedLabel(elapsedMs)}
        </p>
      </div>
      <div
        ref={scrollRef}
        className="max-h-[130px] min-h-0 flex-1 overflow-y-auto rounded border border-gray-300/70 bg-background-100 p-1"
      >
        {events.length === 0 && (
          <p className="px-1 py-0.5 text-sm text-gray-900">No events yet.</p>
        )}

        {events.map((event, index) => {
          const tone = eventTone(event.kind);
          return (
            <div
              key={`${event.kind}-${event.atMs}-${index}`}
              className="flex items-center gap-2 px-1 py-0.5 text-sm leading-5 text-gray-900"
            >
              <span
                className={`h-2 w-2 rounded-full ${tone.dotClass}`}
                aria-hidden="true"
              />
              <span
                className={`w-20 shrink-0 text-xs font-semibold uppercase ${tone.labelClass}`}
              >
                {event.kind}
              </span>
              <p className="min-w-0 flex-1 truncate">{event.message}</p>
              <span className="shrink-0 font-mono tabular-nums text-gray-900">
                +{event.atMs}ms
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Style helpers                                                      */
/* ------------------------------------------------------------------ */

function attemptTone(state: AttemptState): {
  dotClass: string;
  badgeClass: string;
  cardClass: string;
} {
  switch (state) {
    case "requesting":
      return {
        dotClass: "bg-amber-700 animate-pulse",
        badgeClass: "border-amber-700/40 bg-amber-700/10 text-amber-700",
        cardClass: "border-amber-700/40 bg-amber-700/10",
      };
    case "waiting-retry":
      return {
        dotClass: "bg-cyan-700 animate-pulse",
        badgeClass: "border-cyan-700/40 bg-cyan-700/10 text-cyan-700",
        cardClass: "border-cyan-700/40 bg-cyan-700/10",
      };
    case "rate-limited":
      return {
        dotClass: "bg-red-700",
        badgeClass: "border-red-700/40 bg-red-700/10 text-red-700",
        cardClass: "border-red-700/40 bg-red-700/10",
      };
    case "succeeded":
      return {
        dotClass: "bg-green-700",
        badgeClass: "border-green-700/40 bg-green-700/10 text-green-700",
        cardClass: "border-green-700/40 bg-green-700/10",
      };
    case "pending":
    default:
      return {
        dotClass: "bg-gray-500",
        badgeClass: "border-gray-400/70 bg-background-100 text-gray-900",
        cardClass: "border-gray-400/40 bg-background-100",
      };
  }
}

function eventTone(kind: RetryLogEventKind): {
  dotClass: string;
  labelClass: string;
} {
  switch (kind) {
    case "attempt":
      return { dotClass: "bg-blue-700", labelClass: "text-blue-700" };
    case "rate-limited":
      return { dotClass: "bg-red-700", labelClass: "text-red-700" };
    case "retry-scheduled":
      return { dotClass: "bg-cyan-700", labelClass: "text-cyan-700" };
    case "retry-wakeup":
      return { dotClass: "bg-amber-700", labelClass: "text-amber-700" };
    case "success":
      return { dotClass: "bg-green-700", labelClass: "text-green-700" };
    case "upsert":
      return { dotClass: "bg-violet-700", labelClass: "text-violet-700" };
    case "upsert-done":
      return { dotClass: "bg-green-700", labelClass: "text-green-700" };
    default:
      return { dotClass: "bg-gray-500", labelClass: "text-gray-900" };
  }
}
