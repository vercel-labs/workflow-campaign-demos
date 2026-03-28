// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AggregatorCodeWorkbench } from "@/aggregator/app/components/aggregator-code-workbench";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type SourceId = "warehouse-a" | "warehouse-b" | "warehouse-c";

type AggregatorEvent =
  | { type: "collecting"; batchId: string; tokens: Record<string, string>; expectedCount: number; timeoutMs: number }
  | { type: "signal_received"; batchId: string; source: string; value: number; receivedCount: number; expectedCount: number }
  | { type: "all_collected"; batchId: string }
  | { type: "timeout"; batchId: string; missing: string[]; received: string[] }
  | { type: "processing"; batchId: string }
  | { type: "done"; batchId: string; status: "aggregated" | "partial"; summary: AggregatorSummary };

type AggregatorSummary = {
  totalSignals: number;
  receivedSignals: number;
  totalValue: number;
  sources: string[];
};

type LifecycleState = "idle" | "collecting" | "processing" | "done";
type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail";

type SourceState = "pending" | "sending" | "received" | "missed";

type SourceSnapshot = {
  id: SourceId;
  label: string;
  state: SourceState;
  value: number;
  token: string | null;
};

type LogTone = "default" | "green" | "amber" | "red" | "cyan";
type LogEntry = { text: string; tone: LogTone };

type AccumulatorState = {
  batchId: string;
  tokens: Record<string, string>;
  expectedCount: number;
  timeoutMs: number;
  sources: Record<SourceId, { state: SourceState; value: number }>;
  receivedCount: number;
  timedOut: boolean;
  missing: string[];
  outcome: "aggregated" | "partial" | null;
  summary: AggregatorSummary | null;
};

type StartResponse = {
  runId: string;
  batchId: string;
  timeoutMs: number;
  status: string;
};

type WorkflowLineMap = {
  hookCreate: number[];
  promiseRace: number[];
  signalReceived: number[];
  allCollected: number[];
  timeout: number[];
  processBatch: number[];
  returnResult: number[];
};

type StepLineMap = {
  emit: number[];
  processBatch: number[];
};

type DemoProps = {
  workflowCode: string;
  workflowHtmlLines: string[];
  stepCode: string;
  stepHtmlLines: string[];
  workflowLineMap: WorkflowLineMap;
  stepLineMap: StepLineMap;
};

const SOURCES: Array<{ id: SourceId; label: string }> = [
  { id: "warehouse-a", label: "Warehouse A" },
  { id: "warehouse-b", label: "Warehouse B" },
  { id: "warehouse-c", label: "Warehouse C" },
];

const DEFAULT_TIMEOUT_MS = 8000;

/* ------------------------------------------------------------------ */
/*  SSE helpers                                                        */
/* ------------------------------------------------------------------ */

function parseSseChunk(rawChunk: string): unknown | null {
  const payload = rawChunk
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trim())
    .join("\n");
  if (!payload) return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

function formatElapsedMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

/* ------------------------------------------------------------------ */
/*  Accumulator                                                        */
/* ------------------------------------------------------------------ */

function createAccumulator(): AccumulatorState {
  return {
    batchId: "",
    tokens: {},
    expectedCount: 3,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    sources: {
      "warehouse-a": { state: "pending", value: 0 },
      "warehouse-b": { state: "pending", value: 0 },
      "warehouse-c": { state: "pending", value: 0 },
    },
    receivedCount: 0,
    timedOut: false,
    missing: [],
    outcome: null,
    summary: null,
  };
}

function applyEvent(acc: AccumulatorState, event: AggregatorEvent): AccumulatorState {
  switch (event.type) {
    case "collecting":
      return {
        ...acc,
        batchId: event.batchId,
        tokens: event.tokens,
        expectedCount: event.expectedCount,
        timeoutMs: event.timeoutMs,
      };

    case "signal_received": {
      const sourceId = event.source as SourceId;
      return {
        ...acc,
        receivedCount: event.receivedCount,
        sources: {
          ...acc.sources,
          [sourceId]: { state: "received", value: event.value },
        },
      };
    }

    case "all_collected":
      return acc;

    case "timeout": {
      const updated = { ...acc, timedOut: true, missing: event.missing };
      const sources = { ...updated.sources };
      for (const m of event.missing) {
        const sid = m as SourceId;
        if (sources[sid]) {
          sources[sid] = { ...sources[sid], state: "missed" };
        }
      }
      return { ...updated, sources };
    }

    case "processing":
      return acc;

    case "done":
      return {
        ...acc,
        outcome: event.status,
        summary: event.summary,
      };

    default:
      return acc;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function AggregatorDemo({
  workflowCode,
  workflowHtmlLines,
  stepCode,
  stepHtmlLines,
  workflowLineMap,
  stepLineMap,
}: DemoProps) {
  const [lifecycle, setLifecycle] = useState<LifecycleState>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [eventLog, setEventLog] = useState<LogEntry[]>([
    { text: "Idle: click Start Batch to begin collecting signals.", tone: "default" },
  ]);

  // Which sources the user has chosen to skip (will cause timeout)
  const [skipSources, setSkipSources] = useState<Set<SourceId>>(new Set());

  const accRef = useRef<AccumulatorState>(createAccumulator());
  const [snapshot, setSnapshot] = useState<AccumulatorState | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const signalTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hasScrolledRef = useRef(false);

  const stopElapsedTimer = useCallback(() => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }, []);

  const clearSignalTimers = useCallback(() => {
    for (const t of signalTimersRef.current) clearTimeout(t);
    signalTimersRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      stopElapsedTimer();
      clearSignalTimers();
    };
  }, [stopElapsedTimer, clearSignalTimers]);

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

  /* -- Auto-send signals after receiving tokens -- */
  const autoSendSignals = useCallback(
    (tokens: Record<string, string>, skipped: Set<SourceId>) => {
      clearSignalTimers();
      const delays: Record<SourceId, number> = {
        "warehouse-a": 800,
        "warehouse-b": 1600,
        "warehouse-c": 2400,
      };
      const values: Record<SourceId, number> = {
        "warehouse-a": 42,
        "warehouse-b": 78,
        "warehouse-c": 35,
      };

      for (const source of SOURCES) {
        if (skipped.has(source.id)) continue;
        const token = tokens[source.id];
        if (!token) continue;

        const timer = setTimeout(async () => {
          // Mark as sending
          const acc = accRef.current;
          acc.sources[source.id] = { ...acc.sources[source.id], state: "sending" };
          setSnapshot({ ...acc });

          try {
            await fetch("/api/signal", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                token,
                source: source.id,
                value: values[source.id],
              }),
            });
          } catch {
            // Signal delivery is best-effort in the demo
          }
        }, delays[source.id]);

        signalTimersRef.current.push(timer);
      }
    },
    [clearSignalTimers]
  );

  /* -- Connect to SSE stream -- */
  const connectSse = useCallback(
    async (targetRunId: string, signal: AbortSignal, skipped: Set<SourceId>) => {
      const acc = createAccumulator();
      accRef.current = acc;
      setSnapshot({ ...acc });

      stopElapsedTimer();
      const startMs = Date.now();
      elapsedTimerRef.current = setInterval(() => {
        if (!signal.aborted) {
          setElapsedMs(Date.now() - startMs);
        }
      }, 100);

      try {
        const res = await fetch(`/api/readable/${encodeURIComponent(targetRunId)}`, { signal });
        if (!res.ok || !res.body) {
          throw new Error("Stream unavailable");
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (signal.aborted) return;

          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.replaceAll("\r\n", "\n").split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const chunk of chunks) {
            const parsed = parseSseChunk(chunk);
            if (!parsed || typeof parsed !== "object" || !("type" in parsed)) continue;
            const event = parsed as AggregatorEvent;

            const updated = applyEvent(accRef.current, event);
            accRef.current = updated;
            setSnapshot({ ...updated });

            const ts = formatElapsedMs(Date.now() - startMs);
            const logEntry = eventToLogEntry(event, ts);
            if (logEntry) {
              setEventLog((prev) => [...prev, logEntry]);
            }

            // When we get collecting event, auto-send signals
            if (event.type === "collecting") {
              setLifecycle("collecting");
              autoSendSignals(event.tokens, skipped);
            }

            if (event.type === "processing") {
              setLifecycle("processing");
            }

            if (event.type === "done") {
              setLifecycle("done");
              stopElapsedTimer();
              setElapsedMs(Date.now() - startMs);
              return;
            }
          }
        }

        if (!signal.aborted) {
          setLifecycle("done");
          stopElapsedTimer();
        }
      } catch (err) {
        if (signal.aborted || (err instanceof Error && err.name === "AbortError")) return;
        setLifecycle("done");
        stopElapsedTimer();
        setError(err instanceof Error ? err.message : "Failed to read stream");
      }
    },
    [autoSendSignals, stopElapsedTimer]
  );

  const handleStart = useCallback(async () => {
    setError(null);
    abortRef.current?.abort();
    abortRef.current = null;
    stopElapsedTimer();
    clearSignalTimers();

    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;

    // Capture current skip state
    const skipped = new Set(skipSources);

    try {
      const res = await fetch("/api/aggregator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: `batch-${Date.now()}`,
          timeoutMs: DEFAULT_TIMEOUT_MS,
        }),
        signal,
      });

      const payload = (await res.json()) as StartResponse;
      if (!res.ok) {
        throw new Error((payload as unknown as { error?: string }).error ?? `Request failed (${res.status})`);
      }
      if (signal.aborted) return;

      setRunId(payload.runId);
      setLifecycle("collecting");
      setElapsedMs(0);
      setEventLog([
        { text: `[0.00s] batch ${payload.batchId} started`, tone: "default" },
        { text: `[0.00s] waiting for 3 warehouse signals (timeout: ${DEFAULT_TIMEOUT_MS / 1000}s)`, tone: "default" },
      ]);

      void connectSse(payload.runId, signal, skipped);
    } catch (startError) {
      if (signal.aborted || (startError instanceof Error && startError.name === "AbortError")) return;
      setError(startError instanceof Error ? startError.message : "Failed to start");
      setLifecycle("idle");
    }
  }, [connectSse, stopElapsedTimer, clearSignalTimers, skipSources]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopElapsedTimer();
    clearSignalTimers();
    setLifecycle("idle");
    setRunId(null);
    setSnapshot(null);
    setElapsedMs(0);
    setError(null);
    setEventLog([
      { text: "Idle: click Start Batch to begin collecting signals.", tone: "default" },
    ]);
    accRef.current = createAccumulator();
    setTimeout(() => startButtonRef.current?.focus(), 0);
  }, [stopElapsedTimer, clearSignalTimers]);

  const isRunning = lifecycle === "collecting" || lifecycle === "processing";

  /* -- Build source snapshots -- */
  const sourceSnapshots: SourceSnapshot[] = useMemo(() => {
    return SOURCES.map((s) => {
      const src = snapshot?.sources[s.id] ?? { state: "pending", value: 0 };
      return {
        id: s.id,
        label: s.label,
        state: src.state,
        value: src.value,
        token: snapshot?.tokens[s.id] ?? null,
      };
    });
  }, [snapshot]);

  /* -- Phase explanation -- */
  const phaseExplainer = useMemo(() => {
    if (lifecycle === "idle") return "Waiting to start. Click Start Batch to run the workflow.";
    if (lifecycle === "collecting") {
      const received = sourceSnapshots.filter((s) => s.state === "received").length;
      return `Collecting signals: ${received}/3 received. Promise.race() vs sleep() timeout.`;
    }
    if (lifecycle === "processing") return "All signals collected (or timed out). Processing batch...";
    if (lifecycle === "done" && snapshot?.outcome) {
      if (snapshot.outcome === "aggregated") {
        return `Aggregated: all ${snapshot.summary?.receivedSignals} signals collected. Total value: ${snapshot.summary?.totalValue}.`;
      }
      return `Partial: ${snapshot.summary?.receivedSignals}/${snapshot.summary?.totalSignals} signals. Missing: ${snapshot.missing.join(", ")}.`;
    }
    return "Run complete.";
  }, [lifecycle, sourceSnapshots, snapshot]);

  /* -- Code highlight state -- */
  const codeState = useMemo(() => {
    const wfMarks: Record<number, GutterMarkKind> = {};
    const stepMarks: Record<number, GutterMarkKind> = {};

    if (!snapshot || lifecycle === "idle") {
      return {
        tone: "amber" as HighlightTone,
        workflowActiveLines: [] as number[],
        stepActiveLines: [] as number[],
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    if (lifecycle === "collecting") {
      return {
        tone: "amber" as HighlightTone,
        workflowActiveLines: workflowLineMap.promiseRace,
        stepActiveLines: stepLineMap.emit,
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    if (lifecycle === "processing") {
      return {
        tone: "cyan" as HighlightTone,
        workflowActiveLines: workflowLineMap.processBatch,
        stepActiveLines: stepLineMap.processBatch,
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    // done
    if (snapshot.outcome === "aggregated") {
      for (const ln of workflowLineMap.promiseRace) wfMarks[ln] = "success";
      for (const ln of workflowLineMap.processBatch) wfMarks[ln] = "success";
      for (const ln of stepLineMap.processBatch) stepMarks[ln] = "success";
      return {
        tone: "green" as HighlightTone,
        workflowActiveLines: workflowLineMap.returnResult,
        stepActiveLines: [] as number[],
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    // partial (timeout)
    for (const ln of workflowLineMap.timeout) wfMarks[ln] = "fail";
    for (const ln of workflowLineMap.processBatch) wfMarks[ln] = "success";
    return {
      tone: "red" as HighlightTone,
      workflowActiveLines: workflowLineMap.returnResult,
      stepActiveLines: [] as number[],
      workflowGutterMarks: wfMarks,
      stepGutterMarks: stepMarks,
    };
  }, [snapshot, lifecycle, workflowLineMap, stepLineMap]);

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

      {/* Controls */}
      <div className="rounded-lg border border-gray-400/70 bg-background-100 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            ref={startButtonRef}
            type="button"
            onClick={handleStart}
            disabled={isRunning}
            className="min-h-10 cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start Batch
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
          <div className="flex items-center gap-1.5 rounded-md border border-gray-400/70 bg-background-200 px-2 py-1 text-xs text-gray-900">
            <span className="font-semibold uppercase tracking-wide text-gray-900">Skip</span>
            {SOURCES.map((source) => {
              const isSkipped = skipSources.has(source.id);
              return (
                <button
                  key={source.id}
                  type="button"
                  disabled={isRunning}
                  aria-label={`${source.label}: ${isSkipped ? "skipped" : "active"} (click to toggle)`}
                  onClick={() => {
                    setSkipSources((prev) => {
                      const next = new Set(prev);
                      if (next.has(source.id)) next.delete(source.id);
                      else next.add(source.id);
                      return next;
                    });
                  }}
                  className={`cursor-pointer rounded px-2 py-0.5 font-mono transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    isSkipped
                      ? "bg-red-700/20 text-red-700"
                      : "bg-background-200 text-gray-900"
                  }`}
                >
                  {source.id.replace("warehouse-", "").toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-gray-900">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded bg-background-200 border border-gray-400/70" />
            Active
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded bg-red-700/20 border border-red-700/40" />
            Skipped <span className="text-gray-700">(triggers timeout)</span>
          </span>
        </div>
      </div>

      {/* Status + Sources */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-gray-400/70 bg-background-100 p-3">
          <div className="flex items-center justify-between gap-2" role="status" aria-live="polite">
            <p className="text-sm text-gray-900">{phaseExplainer}</p>
            {runId && (
              <span className="rounded-full bg-background-200 px-2.5 py-1 text-xs font-mono text-gray-900">
                {formatElapsedMs(elapsedMs)}
              </span>
            )}
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">runId</span>
              <code className="font-mono text-xs text-gray-1000">{runId ?? "not started"}</code>
            </div>
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">Signals Received</span>
              <span className="font-mono text-gray-1000">
                {sourceSnapshots.filter((s) => s.state === "received").length}/3
              </span>
            </div>
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">Outcome</span>
              <OutcomeBadge outcome={snapshot?.outcome ?? null} />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-400/70 bg-background-100 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
            Signal Sources
          </p>
          <AggregatorGraph sources={sourceSnapshots} lifecycle={lifecycle} />
        </div>
      </div>

      {/* Execution Log */}
      <div className="rounded-md border border-gray-400 bg-background-100 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
          Execution Log
        </p>
        <EventLog entries={eventLog} />
      </div>

      <p className="text-center text-xs italic text-gray-900">
        Promise.race() → collect all signals or timeout, then aggregate the batch
      </p>

      {/* Code Workbench */}
      <AggregatorCodeWorkbench
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
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function eventToLogEntry(event: AggregatorEvent, ts: string): LogEntry | null {
  switch (event.type) {
    case "collecting":
      return { text: `[${ts}] collecting — waiting for ${event.expectedCount} signals (timeout: ${event.timeoutMs / 1000}s)`, tone: "default" };
    case "signal_received":
      return { text: `[${ts}] ${event.source} signal received (value: ${event.value}, ${event.receivedCount}/${event.expectedCount})`, tone: "green" };
    case "all_collected":
      return { text: `[${ts}] all signals collected`, tone: "green" };
    case "timeout":
      return { text: `[${ts}] timeout — missing: ${event.missing.join(", ")}`, tone: "red" };
    case "processing":
      return { text: `[${ts}] processing batch...`, tone: "cyan" };
    case "done":
      return {
        text: `[${ts}] done — ${event.status} (${event.summary.receivedSignals}/${event.summary.totalSignals} signals, total: ${event.summary.totalValue})`,
        tone: event.status === "aggregated" ? "green" : "amber",
      };
    default:
      return null;
  }
}

const LOG_TONE_CLASS: Record<LogTone, string> = {
  default: "text-gray-900",
  green: "text-green-700",
  amber: "text-amber-700",
  red: "text-red-700",
  cyan: "text-cyan-700",
};

function EventLog({ entries }: { entries: LogEntry[] }) {
  const scrollRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length]);

  return (
    <ol ref={scrollRef} className="max-h-[160px] space-y-1 overflow-y-auto font-mono text-xs">
      {entries.map((entry, index) => (
        <li key={`${entry.text}-${index}`} className={LOG_TONE_CLASS[entry.tone]}>
          {entry.text}
        </li>
      ))}
    </ol>
  );
}

function OutcomeBadge({ outcome }: { outcome: "aggregated" | "partial" | null }) {
  if (outcome === "aggregated") {
    return (
      <span className="rounded-full bg-green-700/20 px-2 py-0.5 text-xs font-medium text-green-700">
        aggregated
      </span>
    );
  }
  if (outcome === "partial") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        partial
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-900">
      pending
    </span>
  );
}

function sourceColor(state: SourceState): string {
  if (state === "received") return "var(--color-green-700)";
  if (state === "missed") return "var(--color-red-700)";
  if (state === "sending") return "var(--color-amber-700)";
  return "var(--color-gray-500)";
}

function AggregatorGraph({
  sources,
  lifecycle,
}: {
  sources: SourceSnapshot[];
  lifecycle: LifecycleState;
}) {
  const nodes = [
    { id: "warehouse-a" as SourceId, x: 55, y: 60, short: "A" },
    { id: "warehouse-b" as SourceId, x: 265, y: 60, short: "B" },
    { id: "warehouse-c" as SourceId, x: 160, y: 200, short: "C" },
  ];

  const byId = new Map(sources.map((s) => [s.id, s]));

  return (
    <svg
      viewBox="0 0 320 240"
      role="img"
      aria-label="Aggregator signal collection graph"
      className="h-auto w-full"
    >
      <rect x={0} y={0} width={320} height={240} fill="var(--color-background-100)" rx={8} />

      {nodes.map((node) => {
        const src = byId.get(node.id);
        const state = src?.state ?? "pending";
        const color = sourceColor(state);

        return (
          <g key={node.id}>
            <line
              x1={160}
              y1={128}
              x2={node.x}
              y2={node.y}
              stroke={color}
              strokeWidth={2.5}
              strokeDasharray={state === "sending" ? "6 4" : undefined}
              className={state === "sending" ? "animate-pulse" : undefined}
              markerEnd={state === "received" ? undefined : undefined}
            />
            <circle
              cx={node.x}
              cy={node.y}
              r={18}
              fill="var(--color-background-200)"
              stroke={color}
              strokeWidth={2.5}
            />
            <text
              x={node.x}
              y={node.y + 4}
              textAnchor="middle"
              className="fill-gray-1000 font-mono text-xs"
            >
              {node.short}
            </text>
            <text
              x={node.x}
              y={node.y + 32}
              textAnchor="middle"
              className="fill-gray-900 font-mono text-[10px]"
            >
              {node.id.replace("warehouse-", "WH-")}
            </text>
          </g>
        );
      })}

      {/* Center aggregator node */}
      <circle
        cx={160}
        cy={128}
        r={26}
        fill="var(--color-background-200)"
        stroke={
          lifecycle === "done"
            ? "var(--color-green-700)"
            : lifecycle === "collecting" || lifecycle === "processing"
              ? "var(--color-amber-700)"
              : "var(--color-blue-700)"
        }
        strokeWidth={2.5}
        className="transition-colors duration-500"
      />
      <text
        x={160}
        y={132}
        textAnchor="middle"
        className={`font-mono text-xs font-semibold transition-colors duration-500 ${
          lifecycle === "done"
            ? "fill-green-700"
            : lifecycle === "collecting" || lifecycle === "processing"
              ? "fill-amber-700"
              : "fill-blue-700"
        }`}
      >
        AGG
      </text>
    </svg>
  );
}

const demoProps = {
  workflowCode: "",
  workflowHtmlLines: [],
  stepCode: "",
  stepHtmlLines: [],
  workflowLineMap: {},
  stepLineMap: {},
} as unknown as Parameters<typeof AggregatorDemo>[0];

export default function AggregatorNativeDemo() {
  return <AggregatorDemo {...demoProps} />;
}
