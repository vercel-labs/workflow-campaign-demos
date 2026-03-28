// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RetryCodeWorkbench } from "@/retry-backoff/app/components/retry-code-workbench";

/* ── Event type (matches workflow getWritable output) ──────────── */

type RetryEvent =
  | { type: "attempt_start"; attempt: number; contactId: string }
  | { type: "attempt_fail"; attempt: number; error: string; sleepMs: number }
  | { type: "attempt_success"; attempt: number; contactId: string }
  | { type: "done"; status: "completed" | "failed"; attempts: number };

type TimestampedEvent = RetryEvent & { receivedAtMs: number };

/* ── Client-side snapshot types ────────────────────────────────── */

type AttemptState = "pending" | "running" | "sleeping" | "failed" | "succeeded";
type HighlightTone = "amber" | "cyan" | "green" | "red";

type AttemptSnapshot = {
  attempt: number;
  state: AttemptState;
  sleepMs: number;
  remainingSleepMs: number;
};

type RetryPhaseKind = "attempt" | "sleep" | "done";

type RetryPhase = {
  phase: RetryPhaseKind;
  attempt: number | null;
  nextDelayMs: number | null;
};

type RetryLogEventKind =
  | "attempt"
  | "fail"
  | "sleep"
  | "wakeup"
  | "success"
  | "exhausted";

type RetryLogEvent = {
  atMs: number;
  attempt: number;
  kind: RetryLogEventKind;
  message: string;
};

type RetrySnapshot = {
  status: "running" | "completed" | "failed";
  attempts: AttemptSnapshot[];
  currentPhase: RetryPhase;
  executionLog: RetryLogEvent[];
  elapsedMs: number;
  result: { attempt: number; outcome: "success" | "failed" } | null;
};

/* ── Snapshot builder ──────────────────────────────────────────── */

type AccAttempt = {
  attempt: number;
  state: AttemptState;
  sleepMs: number;
  failedAtMs: number;
};

function buildSnapshotFromEvents(
  events: TimestampedEvent[],
  startedAtMs: number,
  nowMs: number,
  streamEnded: boolean
): RetrySnapshot | null {
  if (events.length === 0 && !streamEnded) return null;

  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  const attempts: AccAttempt[] = [];
  const log: RetryLogEvent[] = [];
  let status: "running" | "completed" | "failed" = "running";
  let result: RetrySnapshot["result"] = null;

  for (const event of events) {
    const atMs = Math.max(0, event.receivedAtMs - startedAtMs);

    switch (event.type) {
      case "attempt_start": {
        // Previous sleeping attempt woke up → mark it failed
        const prev = attempts.at(-1);
        if (prev && prev.state === "sleeping") {
          prev.state = "failed";
          log.push({
            atMs,
            attempt: prev.attempt,
            kind: "wakeup",
            message: `Woke up after ${prev.sleepMs}ms`,
          });
        }

        attempts.push({
          attempt: event.attempt,
          state: "running",
          sleepMs: 0,
          failedAtMs: 0,
        });

        log.push({
          atMs,
          attempt: event.attempt,
          kind: "attempt",
          message: `Attempt ${event.attempt} started`,
        });
        break;
      }

      case "attempt_fail": {
        const current = attempts.find((a) => a.attempt === event.attempt);
        if (current) {
          current.state = event.sleepMs > 0 ? "sleeping" : "failed";
          current.sleepMs = event.sleepMs;
          current.failedAtMs = event.receivedAtMs;
        }

        log.push({
          atMs,
          attempt: event.attempt,
          kind: "fail",
          message: `Attempt ${event.attempt} failed`,
        });

        if (event.sleepMs > 0) {
          log.push({
            atMs,
            attempt: event.attempt,
            kind: "sleep",
            message: `sleep("${event.sleepMs}ms") started`,
          });
        }
        break;
      }

      case "attempt_success": {
        const current = attempts.find((a) => a.attempt === event.attempt);
        if (current) {
          current.state = "succeeded";
        }
        status = "completed";
        result = { attempt: event.attempt, outcome: "success" };

        log.push({
          atMs,
          attempt: event.attempt,
          kind: "success",
          message: `Attempt ${event.attempt} succeeded`,
        });
        break;
      }

      case "done": {
        status = event.status === "completed" ? "completed" : "failed";
        if (!result) {
          result = {
            attempt: event.attempts,
            outcome: event.status === "completed" ? "success" : "failed",
          };
        }
        break;
      }
    }
  }

  // Handle stream end without success → failed
  if (streamEnded && status === "running") {
    status = "failed";
    const lastAttempt = attempts.at(-1);
    if (lastAttempt) {
      if (lastAttempt.state === "sleeping") {
        lastAttempt.state = "failed";
      }
      result = { attempt: lastAttempt.attempt, outcome: "failed" };
      log.push({
        atMs: elapsedMs,
        attempt: lastAttempt.attempt,
        kind: "exhausted",
        message: `Max attempts exhausted (${lastAttempt.attempt})`,
      });
    }
  }

  // Convert to snapshot format with remaining sleep
  const attemptSnapshots: AttemptSnapshot[] = attempts.map((a) => ({
    attempt: a.attempt,
    state: a.state,
    sleepMs: a.sleepMs,
    remainingSleepMs:
      a.state === "sleeping" && a.failedAtMs
        ? Math.max(0, a.sleepMs - (nowMs - a.failedAtMs))
        : 0,
  }));

  // Determine current phase
  const lastAttempt = attemptSnapshots.at(-1);
  let currentPhase: RetryPhase;

  if (!lastAttempt || status !== "running") {
    currentPhase = {
      phase: "done",
      attempt: lastAttempt?.attempt ?? null,
      nextDelayMs: null,
    };
  } else if (lastAttempt.state === "running") {
    currentPhase = {
      phase: "attempt",
      attempt: lastAttempt.attempt,
      nextDelayMs: null,
    };
  } else if (lastAttempt.state === "sleeping") {
    currentPhase = {
      phase: "sleep",
      attempt: lastAttempt.attempt,
      nextDelayMs: lastAttempt.sleepMs,
    };
  } else {
    currentPhase = {
      phase: "done",
      attempt: lastAttempt.attempt,
      nextDelayMs: null,
    };
  }

  return {
    status,
    attempts: attemptSnapshots,
    currentPhase,
    executionLog: log,
    elapsedMs,
    result,
  };
}

/* ── Props & constants ─────────────────────────────────────────── */

type LifecycleState = "idle" | "running" | "completed" | "failed";

type RetryWorkflowLineMap = {
  attempt: number[];
  sleep: number[];
  successReturn: number[];
  failureReturn: number[];
};

type RetryStepLineMap = {
  attempt: number[];
  successReturn: number[];
};

type RetryBackoffDemoProps = {
  workflowCode: string;
  workflowHtmlLines: string[];
  workflowLineMap: RetryWorkflowLineMap;
  stepCode: string;
  stepHtmlLines: string[];
  stepLineMap: RetryStepLineMap;
};

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 1_000;
const DEFAULT_FAIL_FIRST_ATTEMPTS = 2;
const FAIL_FIRST_MIN = 0;
const FAIL_FIRST_MAX = MAX_ATTEMPTS;
const FAIL_FIRST_OPTIONS = Array.from(
  { length: FAIL_FIRST_MAX - FAIL_FIRST_MIN + 1 },
  (_, index) => FAIL_FIRST_MIN + index
);

function buildContactId(): string {
  return `contact_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

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

/* ── Main component ────────────────────────────────────────────── */

export function RetryBackoffDemo({
  workflowCode,
  workflowHtmlLines,
  workflowLineMap,
  stepCode,
  stepHtmlLines,
  stepLineMap,
}: RetryBackoffDemoProps) {
  const [failFirstAttempts, setFailFirstAttempts] = useState(
    DEFAULT_FAIL_FIRST_ATTEMPTS
  );

  const [lifecycle, setLifecycle] = useState<LifecycleState>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Event accumulation (SSE)
  const [events, setEvents] = useState<TimestampedEvent[]>([]);
  const [streamEnded, setStreamEnded] = useState(false);
  const [tick, setTick] = useState(0);
  const startedAtRef = useRef<number>(0);

  const abortRef = useRef<AbortController | null>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const hasScrolledRef = useRef(false);

  // Derive snapshot from accumulated events
  const snapshot = useMemo<RetrySnapshot | null>(
    () =>
      buildSnapshotFromEvents(
        events,
        startedAtRef.current,
        Date.now(),
        streamEnded
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, streamEnded, tick]
  );

  // Sleep countdown timer — tick every 100ms during sleep phase
  useEffect(() => {
    if (snapshot?.currentPhase.phase === "sleep") {
      const timer = setInterval(() => setTick((t) => t + 1), 100);
      return () => clearInterval(timer);
    }
  }, [snapshot?.currentPhase.phase]);

  // Update lifecycle from snapshot
  useEffect(() => {
    if (!snapshot) return;
    if (snapshot.status === "completed") setLifecycle("completed");
    else if (snapshot.status === "failed") setLifecycle("failed");
    else if (snapshot.status === "running") setLifecycle("running");
  }, [snapshot?.status]);

  // Scroll to demo on start
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  // SSE stream connection
  const connectToReadable = useCallback(
    async (targetRunId: string, signal: AbortSignal) => {
      const response = await fetch(
        `/api/readable/${encodeURIComponent(targetRunId)}`,
        { cache: "no-store", signal }
      );

      if (!response.ok || !response.body) {
        throw new Error(`Stream unavailable: ${response.status}`);
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
          const dataLine = chunk
            .split("\n")
            .find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          try {
            const event = JSON.parse(dataLine.slice(6)) as RetryEvent;
            const timestamped: TimestampedEvent = {
              ...event,
              receivedAtMs: Date.now(),
            };
            if (signal.aborted) return;
            setEvents((prev) => [...prev, timestamped]);
          } catch {
            /* ignore parse errors */
          }
        }
      }

      // Flush remaining buffer
      if (buffer.trim()) {
        const dataLine = buffer
          .split("\n")
          .find((l) => l.startsWith("data: "));
        if (dataLine) {
          try {
            const event = JSON.parse(dataLine.slice(6)) as RetryEvent;
            if (signal.aborted) return;
            setEvents((prev) => [
              ...prev,
              { ...event, receivedAtMs: Date.now() },
            ]);
          } catch {
            /* ignore */
          }
        }
      }

      if (signal.aborted) return;
      setStreamEnded(true);
    },
    []
  );

  const handleStart = useCallback(async () => {
    setError(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;

    // Reset event state
    setEvents([]);
    setStreamEnded(false);
    setTick(0);

    try {
      const response = await fetch("/api/retry-backoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: buildContactId(),
          maxAttempts: MAX_ATTEMPTS,
          baseDelayMs: BASE_DELAY_MS,
          failuresBeforeSuccess: failFirstAttempts,
        }),
        signal,
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? `Start failed (${response.status})`);
      }
      if (signal.aborted) return;

      setRunId(payload.runId);
      startedAtRef.current = Date.now();
      setLifecycle("running");

      // Connect to SSE readable stream
      connectToReadable(payload.runId, signal).catch((err) => {
        if (signal.aborted || err?.name === "AbortError") return;
        setError(err?.message ?? "Stream connection failed");
        setLifecycle("failed");
      });
    } catch (startError) {
      if (
        signal.aborted ||
        (startError instanceof Error && startError.name === "AbortError")
      ) {
        return;
      }
      const message =
        startError instanceof Error
          ? startError.message
          : "Failed to start retry run";
      setError(message);
      setLifecycle("idle");
    }
  }, [connectToReadable, failFirstAttempts]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    startedAtRef.current = 0;
    setLifecycle("idle");
    setRunId(null);
    setEvents([]);
    setStreamEnded(false);
    setTick(0);
    setError(null);
    setTimeout(() => {
      startButtonRef.current?.focus();
    }, 0);
  }, []);

  const isRunning = lifecycle === "running";

  /* ── Phase explainer ──────────────────────────────────────────── */

  const phaseExplainer = useMemo(() => {
    if (!snapshot) {
      return "Waiting to start a run.";
    }

    if (
      snapshot.status === "running" &&
      snapshot.currentPhase.phase === "attempt"
    ) {
      return `Attempt ${snapshot.currentPhase.attempt} is executing syncContactToCrm() in a step.`;
    }

    if (
      snapshot.status === "running" &&
      snapshot.currentPhase.phase === "sleep"
    ) {
      return `sleep('${formatDurationLabel(snapshot.currentPhase.nextDelayMs ?? 0)}') in progress. The workflow is durably suspended and consuming zero compute.`;
    }

    if (snapshot.status === "completed") {
      return `Run completed on attempt ${snapshot.result?.attempt}.`;
    }

    if (snapshot.status === "failed") {
      return `Run failed after attempt ${snapshot.result?.attempt}. Max attempts exhausted.`;
    }

    return "Run is active.";
  }, [snapshot]);

  /* ── Code workbench highlight state ──────────────────────────── */

  type GutterMarkKind = "success" | "fail";

  const codeState = useMemo(() => {
    const wfMarks: Record<number, GutterMarkKind> = {};
    const stepMarks: Record<number, GutterMarkKind> = {};

    if (snapshot) {
      const lastSuccess = [...snapshot.executionLog]
        .reverse()
        .find((e) => e.kind === "success");
      let lastFailIdx = -1;
      let lastAttemptIdx = -1;
      for (let i = snapshot.executionLog.length - 1; i >= 0; i--) {
        if (lastFailIdx === -1 && snapshot.executionLog[i].kind === "fail")
          lastFailIdx = i;
        if (
          lastAttemptIdx === -1 &&
          snapshot.executionLog[i].kind === "attempt"
        )
          lastAttemptIdx = i;
        if (lastFailIdx !== -1 && lastAttemptIdx !== -1) break;
      }

      if (lastSuccess) {
        for (const ln of workflowLineMap.attempt) wfMarks[ln] = "success";
        for (const ln of stepLineMap.attempt) stepMarks[ln] = "success";
      } else if (lastFailIdx > lastAttemptIdx) {
        for (const ln of workflowLineMap.attempt) wfMarks[ln] = "fail";
        for (const ln of stepLineMap.attempt) stepMarks[ln] = "fail";
      }

      const hasSlept = snapshot.executionLog.some(
        (e) => e.kind === "sleep" || e.kind === "wakeup"
      );
      if (hasSlept) {
        for (const ln of workflowLineMap.sleep) wfMarks[ln] = "success";
      }

      if (snapshot.status === "completed") {
        for (const ln of workflowLineMap.successReturn) wfMarks[ln] = "success";
        for (const ln of stepLineMap.successReturn) stepMarks[ln] = "success";
      }

      if (snapshot.status === "failed") {
        for (const ln of workflowLineMap.failureReturn) wfMarks[ln] = "fail";
      }
    }

    if (!snapshot) {
      return {
        tone: "amber" as HighlightTone,
        workflowActiveLines: [] as number[],
        stepActiveLines: [] as number[],
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    if (
      snapshot.status === "running" &&
      snapshot.currentPhase.phase === "attempt"
    ) {
      return {
        tone: "amber" as HighlightTone,
        workflowActiveLines: workflowLineMap.attempt,
        stepActiveLines: stepLineMap.attempt,
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    if (
      snapshot.status === "running" &&
      snapshot.currentPhase.phase === "sleep"
    ) {
      return {
        tone: "cyan" as HighlightTone,
        workflowActiveLines: workflowLineMap.sleep,
        stepActiveLines: [] as number[],
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    if (snapshot.status === "completed") {
      return {
        tone: "green" as HighlightTone,
        workflowActiveLines: workflowLineMap.successReturn,
        stepActiveLines: stepLineMap.successReturn,
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    return {
      tone: "red" as HighlightTone,
      workflowActiveLines: workflowLineMap.failureReturn,
      stepActiveLines: [] as number[],
      workflowGutterMarks: wfMarks,
      stepGutterMarks: stepMarks,
    };
  }, [snapshot, stepLineMap, workflowLineMap]);

  /* ── Render ──────────────────────────────────────────────────── */

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
            <span className="text-xs text-gray-900">Fail first</span>
            <select
              aria-label="Fail first attempts"
              value={failFirstAttempts}
              onChange={(event) =>
                setFailFirstAttempts(Number.parseInt(event.target.value, 10))
              }
              disabled={isRunning}
              className="h-8 w-14 rounded border border-gray-400 bg-background-100 px-1 text-center text-sm font-mono tabular-nums text-gray-1000 transition-colors focus:border-gray-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {FAIL_FIRST_OPTIONS.map((attemptCount) => (
                <option key={attemptCount} value={attemptCount}>
                  {attemptCount}
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
              attempts={snapshot?.attempts ?? []}
              currentPhase={snapshot?.currentPhase.phase ?? null}
            />
            <ExecutionLog
              elapsedMs={snapshot?.elapsedMs ?? 0}
              events={snapshot?.executionLog ?? []}
            />
          </div>
        </div>
      </div>

      <p className="text-center text-xs italic text-gray-900">
        sleep() → durable backoff with zero compute between attempts
      </p>

      <RetryCodeWorkbench
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

/* ── AttemptLadder ─────────────────────────────────────────────── */

function AttemptLadder({
  attempts,
  currentPhase,
}: {
  attempts: AttemptSnapshot[];
  currentPhase: RetryPhaseKind | null;
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
          const sleepLabel =
            attempt.sleepMs > 0 ? formatDurationLabel(attempt.sleepMs) : "none";
          const remainingLabel =
            attempt.state === "sleeping" && attempt.remainingSleepMs > 0
              ? ` (${formatDurationLabel(attempt.remainingSleepMs)} left)`
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
                  Attempt {attempt.attempt}
                </p>
                <span
                  className={`rounded-full border px-1.5 py-0.5 text-xs font-semibold uppercase leading-none ${statusTone.badgeClass}`}
                >
                  {attempt.state}
                </span>
                <p className="ml-auto text-xs font-mono tabular-nums text-cyan-700">
                  sleep({sleepLabel})
                  {remainingLabel}
                  {attempt.state === "sleeping" && currentPhase === "sleep"
                    ? " *"
                    : ""}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/* ── ExecutionLog ──────────────────────────────────────────────── */

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
                className={`w-16 shrink-0 text-xs font-semibold uppercase ${tone.labelClass}`}
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

/* ── Tone helpers ──────────────────────────────────────────────── */

function attemptTone(state: AttemptState): {
  dotClass: string;
  badgeClass: string;
  cardClass: string;
} {
  switch (state) {
    case "running":
      return {
        dotClass: "bg-amber-700 animate-pulse",
        badgeClass: "border-amber-700/40 bg-amber-700/10 text-amber-700",
        cardClass: "border-amber-700/40 bg-amber-700/10",
      };
    case "sleeping":
      return {
        dotClass: "bg-cyan-700 animate-pulse",
        badgeClass: "border-cyan-700/40 bg-cyan-700/10 text-cyan-700",
        cardClass: "border-cyan-700/40 bg-cyan-700/10",
      };
    case "failed":
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
    case "fail":
      return { dotClass: "bg-red-700", labelClass: "text-red-700" };
    case "sleep":
      return { dotClass: "bg-cyan-700", labelClass: "text-cyan-700" };
    case "wakeup":
      return { dotClass: "bg-amber-700", labelClass: "text-amber-700" };
    case "success":
      return { dotClass: "bg-green-700", labelClass: "text-green-700" };
    case "exhausted":
      return { dotClass: "bg-red-700", labelClass: "text-red-700" };
    default:
      return { dotClass: "bg-gray-500", labelClass: "text-gray-900" };
  }
}

const demoProps = {
  workflowCode: "",
  workflowHtmlLines: [],
  workflowLineMap: {},
  stepCode: "",
  stepHtmlLines: [],
  stepLineMap: {},
} as unknown as Parameters<typeof RetryBackoffDemo>[0];

export default function RetryBackoffNativeDemo() {
  return <RetryBackoffDemo {...demoProps} />;
}
