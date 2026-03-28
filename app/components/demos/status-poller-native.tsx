// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PollerCodeWorkbench } from "@/status-poller/app/components/poller-code-workbench";

/* ── SSE event types (mirrors workflow PollEvent) ─────────────── */

type JobState =
  | "queued"
  | "processing"
  | "encoding"
  | "finalizing"
  | "ready";

type PollEvent =
  | { type: "poll_start"; poll: number; jobId: string }
  | { type: "poll_result"; poll: number; jobState: JobState; outcome: "not_ready" | "ready" }
  | { type: "sleep_start"; poll: number; durationMs: number }
  | { type: "sleep_end"; poll: number }
  | { type: "completed"; poll: number; jobId: string }
  | { type: "timeout"; poll: number; jobId: string };

/* ── Local UI state types ─────────────────────────────────────── */

type LifecycleState = "idle" | "running" | "completed" | "timeout";
type HighlightTone = "amber" | "cyan" | "green" | "red";

type PollRuntimeState =
  | "pending"
  | "running"
  | "not_ready"
  | "ready"
  | "sleeping";

type PollSnapshot = {
  poll: number;
  state: PollRuntimeState;
  jobState: JobState | null;
  sleepMs: number;
};

type LogEvent = {
  atMs: number;
  poll: number;
  kind: "poll" | "processing" | "sleep" | "wakeup" | "ready" | "timeout";
  message: string;
};

type DemoPhase =
  | { phase: "poll"; poll: number }
  | { phase: "sleep"; poll: number; durationMs: number }
  | { phase: "done"; poll: number | null };

type DemoSnapshot = {
  status: "running" | "completed" | "timeout";
  polls: PollSnapshot[];
  currentPhase: DemoPhase;
  executionLog: LogEvent[];
  elapsedMs: number;
  result: { poll: number; outcome: "ready" | "timeout" } | null;
};

/* ── Accumulator to fold SSE events into snapshot ──────────────── */

class PollAccumulator {
  polls: PollSnapshot[] = [];
  log: LogEvent[] = [];
  currentPhase: DemoPhase = { phase: "done", poll: null };
  status: "running" | "completed" | "timeout" = "running";
  result: { poll: number; outcome: "ready" | "timeout" } | null = null;
  private startMs: number;
  private maxPolls: number;

  constructor(maxPolls: number) {
    this.startMs = Date.now();
    this.maxPolls = maxPolls;
    for (let i = 1; i <= maxPolls; i++) {
      this.polls.push({ poll: i, state: "pending", jobState: null, sleepMs: 0 });
    }
  }

  private elapsed(): number {
    return Date.now() - this.startMs;
  }

  private getPoll(n: number): PollSnapshot | undefined {
    return this.polls[n - 1];
  }

  apply(event: PollEvent): void {
    const atMs = this.elapsed();

    switch (event.type) {
      case "poll_start": {
        const p = this.getPoll(event.poll);
        if (p) p.state = "running";
        this.currentPhase = { phase: "poll", poll: event.poll };
        this.log.push({
          atMs,
          poll: event.poll,
          kind: "poll",
          message: `Poll ${event.poll} started`,
        });
        break;
      }

      case "poll_result": {
        const p = this.getPoll(event.poll);
        if (p) {
          p.state = event.outcome === "ready" ? "ready" : "not_ready";
          p.jobState = event.jobState;
        }
        if (event.outcome === "ready") {
          this.log.push({
            atMs,
            poll: event.poll,
            kind: "ready",
            message: `Poll ${event.poll}: job is ready (${event.jobState})`,
          });
        } else {
          this.log.push({
            atMs,
            poll: event.poll,
            kind: "processing",
            message: `Poll ${event.poll}: still ${event.jobState}`,
          });
        }
        break;
      }

      case "sleep_start": {
        const p = this.getPoll(event.poll);
        if (p) {
          p.state = "sleeping";
          p.sleepMs = event.durationMs;
        }
        this.currentPhase = { phase: "sleep", poll: event.poll, durationMs: event.durationMs };
        this.log.push({
          atMs,
          poll: event.poll,
          kind: "sleep",
          message: `sleep("${event.durationMs}ms") started`,
        });
        break;
      }

      case "sleep_end": {
        this.log.push({
          atMs,
          poll: event.poll,
          kind: "wakeup",
          message: `Woke up after sleep`,
        });
        break;
      }

      case "completed": {
        this.status = "completed";
        this.currentPhase = { phase: "done", poll: event.poll };
        this.result = { poll: event.poll, outcome: "ready" };
        break;
      }

      case "timeout": {
        this.status = "timeout";
        this.currentPhase = { phase: "done", poll: event.poll };
        this.result = { poll: event.poll, outcome: "timeout" };
        this.log.push({
          atMs,
          poll: event.poll,
          kind: "timeout",
          message: `Max polls exhausted (${event.poll})`,
        });
        break;
      }
    }
  }

  toSnapshot(): DemoSnapshot {
    return {
      status: this.status,
      polls: [...this.polls],
      currentPhase: this.currentPhase,
      executionLog: [...this.log],
      elapsedMs: this.elapsed(),
      result: this.result,
    };
  }
}

/* ── SSE parsing helpers ──────────────────────────────────────── */

function parseSseChunk(rawChunk: string): PollEvent | null {
  const payload = rawChunk
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trim())
    .join("\n");

  if (!payload) return null;
  try {
    return JSON.parse(payload) as PollEvent;
  } catch {
    return null;
  }
}

/* ── Props & constants ────────────────────────────────────────── */

type PollerWorkflowLineMap = {
  poll: number[];
  sleep: number[];
  successReturn: number[];
  timeoutReturn: number[];
};

type PollerStepLineMap = {
  poll: number[];
  successReturn: number[];
};

type StatusPollerDemoProps = {
  workflowCode: string;
  workflowHtmlLines: string[];
  workflowLineMap: PollerWorkflowLineMap;
  stepCode: string;
  stepHtmlLines: string[];
  stepLineMap: PollerStepLineMap;
};

const MAX_POLLS = 8;
const DEFAULT_READY_AT_POLL = 4;
const READY_AT_MIN = 1;
const READY_AT_MAX = MAX_POLLS;
const READY_AT_OPTIONS = Array.from(
  { length: READY_AT_MAX - READY_AT_MIN + 1 },
  (_, index) => READY_AT_MIN + index
);

function buildJobId(): string {
  return `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
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

/* ── Main demo component ──────────────────────────────────────── */

export function StatusPollerDemo({
  workflowCode,
  workflowHtmlLines,
  workflowLineMap,
  stepCode,
  stepHtmlLines,
  stepLineMap,
}: StatusPollerDemoProps) {
  const [readyAtPoll, setReadyAtPoll] = useState(DEFAULT_READY_AT_POLL);
  const [lifecycle, setLifecycle] = useState<LifecycleState>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<DemoSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const accRef = useRef<PollAccumulator | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const hasScrolledRef = useRef(false);

  const stopTicker = useCallback(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopTicker();
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [stopTicker]);

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

  const connectToReadable = useCallback(
    async (targetRunId: string, signal: AbortSignal) => {
      const res = await fetch(`/api/readable/${targetRunId}`, { signal });
      if (!res.ok || !res.body) {
        throw new Error("Stream unavailable");
      }

      const reader = res.body.getReader();
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
          if (!event || signal.aborted) continue;

          const acc = accRef.current;
          if (!acc) continue;

          acc.apply(event);
          const snap = acc.toSnapshot();
          setSnapshot(snap);

          if (snap.status === "completed") {
            setLifecycle("completed");
            stopTicker();
          } else if (snap.status === "timeout") {
            setLifecycle("timeout");
            stopTicker();
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        const event = parseSseChunk(buffer);
        if (event && !signal.aborted) {
          const acc = accRef.current;
          if (acc) {
            acc.apply(event);
            const snap = acc.toSnapshot();
            setSnapshot(snap);

            if (snap.status === "completed") {
              setLifecycle("completed");
              stopTicker();
            } else if (snap.status === "timeout") {
              setLifecycle("timeout");
              stopTicker();
            }
          }
        }
      }
    },
    [stopTicker]
  );

  const handleStart = useCallback(async () => {
    setError(null);
    stopTicker();
    abortRef.current?.abort();
    abortRef.current = null;

    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;

    try {
      const res = await fetch("/api/status-poller", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: buildJobId(),
          maxPolls: MAX_POLLS,
          intervalMs: 1000,
          readyAtPoll,
        }),
        signal,
      });

      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error ?? `Request failed (${res.status})`);
        return;
      }

      if (signal.aborted) return;

      const acc = new PollAccumulator(MAX_POLLS);
      accRef.current = acc;

      setRunId(payload.runId);
      setSnapshot(acc.toSnapshot());
      setLifecycle("running");

      // Start elapsed ticker
      tickerRef.current = setInterval(() => {
        const a = accRef.current;
        if (a) setSnapshot(a.toSnapshot());
      }, 120);

      // Connect to SSE stream
      connectToReadable(payload.runId, signal).catch((err) => {
        if (signal.aborted) return;
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Stream error");
      });
    } catch (startError) {
      if (signal.aborted || (startError instanceof Error && startError.name === "AbortError")) {
        return;
      }
      setError(
        startError instanceof Error ? startError.message : "Failed to start"
      );
      setLifecycle("idle");
    }
  }, [connectToReadable, readyAtPoll, stopTicker]);

  const handleReset = useCallback(() => {
    stopTicker();
    abortRef.current?.abort();
    abortRef.current = null;
    accRef.current = null;
    setLifecycle("idle");
    setRunId(null);
    setSnapshot(null);
    setError(null);
    setTimeout(() => {
      startButtonRef.current?.focus();
    }, 0);
  }, [stopTicker]);

  const isRunning = lifecycle === "running";

  const phaseExplainer = useMemo(() => {
    if (!snapshot) {
      return "Waiting to start a run.";
    }

    if (snapshot.status === "running" && snapshot.currentPhase.phase === "poll") {
      return `Poll ${snapshot.currentPhase.poll} is executing checkTranscodeJob() in a step.`;
    }

    if (snapshot.status === "running" && snapshot.currentPhase.phase === "sleep") {
      return `sleep('${formatDurationLabel(snapshot.currentPhase.durationMs)}') in progress. The workflow is durably suspended and consuming zero compute.`;
    }

    if (snapshot.status === "completed") {
      return `Job ready on poll ${snapshot.result?.poll}. Transcoding complete.`;
    }

    if (snapshot.status === "timeout") {
      return `Timed out after poll ${snapshot.result?.poll}. Max polls exhausted.`;
    }

    return "Run is active.";
  }, [snapshot]);

  type GutterMarkKind = "success" | "fail";

  const codeState = useMemo(() => {
    const wfMarks: Record<number, GutterMarkKind> = {};
    const stepMarks: Record<number, GutterMarkKind> = {};

    if (snapshot) {
      const hasReady = snapshot.executionLog.some((e) => e.kind === "ready");
      const hasProcessing = snapshot.executionLog.some((e) => e.kind === "processing");

      if (hasReady) {
        for (const ln of workflowLineMap.poll) wfMarks[ln] = "success";
        for (const ln of stepLineMap.poll) stepMarks[ln] = "success";
      } else if (hasProcessing) {
        for (const ln of workflowLineMap.poll) wfMarks[ln] = "fail";
        for (const ln of stepLineMap.poll) stepMarks[ln] = "fail";
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

      if (snapshot.status === "timeout") {
        for (const ln of workflowLineMap.timeoutReturn) wfMarks[ln] = "fail";
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

    if (snapshot.status === "running" && snapshot.currentPhase.phase === "poll") {
      return {
        tone: "amber" as HighlightTone,
        workflowActiveLines: workflowLineMap.poll,
        stepActiveLines: stepLineMap.poll,
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    if (snapshot.status === "running" && snapshot.currentPhase.phase === "sleep") {
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
      workflowActiveLines: workflowLineMap.timeoutReturn,
      stepActiveLines: [] as number[],
      workflowGutterMarks: wfMarks,
      stepGutterMarks: stepMarks,
    };
  }, [snapshot, stepLineMap, workflowLineMap]);

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
            Start Polling
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
            <span className="text-xs text-gray-900">Ready at poll</span>
            <select
              aria-label="Ready at poll number"
              value={readyAtPoll}
              onChange={(event) =>
                setReadyAtPoll(Number.parseInt(event.target.value, 10))
              }
              disabled={isRunning}
              className="h-8 w-14 rounded border border-gray-400 bg-background-100 px-1 text-center text-sm font-mono tabular-nums text-gray-1000 transition-colors focus:border-gray-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {READY_AT_OPTIONS.map((pollNum) => (
                <option key={pollNum} value={pollNum}>
                  {pollNum}
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
          <p className="text-sm text-gray-900">
            {phaseExplainer}
          </p>
          {runId && (
            <span className="rounded-full bg-background-200 px-2.5 py-1 text-xs font-mono text-gray-900">
              run: {runId}
            </span>
          )}
        </div>

        <div className="lg:h-[200px]">
          <div className="grid grid-cols-1 gap-2 lg:h-full lg:grid-cols-2">
            <PollLadder
              polls={snapshot?.polls ?? []}
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
        sleep() → durable polling interval with zero compute between checks
      </p>

      <PollerCodeWorkbench
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

/* ── Sub-components ───────────────────────────────────────────── */

function PollLadder({
  polls,
  currentPhase,
}: {
  polls: PollSnapshot[];
  currentPhase: DemoPhase["phase"] | null;
}) {
  if (polls.length === 0) {
    return (
      <div className="h-full min-h-0 rounded-lg border border-gray-400/60 bg-background-200 p-2 text-xs text-gray-900">
        No polls yet.
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto rounded-lg border border-gray-400/60 bg-background-200 p-2">
      <div className="space-y-1">
        {polls.map((poll) => {
          const statusTone = pollTone(poll.state);
          const sleepLabel =
            poll.sleepMs > 0 ? formatDurationLabel(poll.sleepMs) : "none";

          return (
            <article
              key={poll.poll}
              className={`rounded-md border px-2 py-1.5 ${statusTone.cardClass}`}
              aria-label={`Poll ${poll.poll}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${statusTone.dotClass}`}
                  aria-hidden="true"
                />
                <p className="text-sm font-medium text-gray-1000">
                  Poll {poll.poll}
                </p>
                <span
                  className={`rounded-full border px-1.5 py-0.5 text-xs font-semibold uppercase leading-none ${statusTone.badgeClass}`}
                >
                  {poll.state === "not_ready" && poll.jobState
                    ? poll.jobState
                    : poll.state}
                </span>
                {poll.sleepMs > 0 && (
                  <p className="ml-auto text-xs font-mono tabular-nums text-cyan-700">
                    sleep({sleepLabel})
                    {poll.state === "sleeping" && currentPhase === "sleep" ? " *" : ""}
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

function ExecutionLog({
  events,
  elapsedMs,
}: {
  events: LogEvent[];
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
      <div ref={scrollRef} className="max-h-[130px] min-h-0 flex-1 overflow-y-auto rounded border border-gray-300/70 bg-background-100 p-1">
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

/* ── Tone helpers ─────────────────────────────────────────────── */

function pollTone(state: PollRuntimeState): {
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
    case "not_ready":
      return {
        dotClass: "bg-red-700",
        badgeClass: "border-red-700/40 bg-red-700/10 text-red-700",
        cardClass: "border-red-700/40 bg-red-700/10",
      };
    case "ready":
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

function eventTone(kind: LogEvent["kind"]): {
  dotClass: string;
  labelClass: string;
} {
  switch (kind) {
    case "poll":
      return { dotClass: "bg-blue-700", labelClass: "text-blue-700" };
    case "processing":
      return { dotClass: "bg-red-700", labelClass: "text-red-700" };
    case "sleep":
      return { dotClass: "bg-cyan-700", labelClass: "text-cyan-700" };
    case "wakeup":
      return { dotClass: "bg-amber-700", labelClass: "text-amber-700" };
    case "ready":
      return { dotClass: "bg-green-700", labelClass: "text-green-700" };
    case "timeout":
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
} as unknown as Parameters<typeof StatusPollerDemo>[0];

export default function StatusPollerNativeDemo() {
  return <StatusPollerDemo {...demoProps} />;
}
