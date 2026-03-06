"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BatchCodeWorkbench } from "@/components/batch-code-workbench";

type LifecycleState = "idle" | "running" | "crashed" | "resuming" | "completed";
type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail";
type CrashMode = "never" | "after-5000";

type BatchUnitState = "pending" | "running" | "completed" | "blocked";

type BatchUnitSnapshot = {
  batch: number;
  label: string;
  state: BatchUnitState;
};

type BatchLogEvent = {
  kind: string;
  message: string;
  atMs: number;
};

type BatchEvent =
  | { type: "batch_start"; batch: number; start: number; end: number; label: string }
  | { type: "batch_done"; batch: number; start: number; end: number; label: string }
  | { type: "crash"; afterBatch: number; message: string }
  | { type: "resume"; fromBatch: number }
  | { type: "complete"; totalBatches: number; processedRecords: number }
  | { type: "done"; status: "done"; totalBatches: number; processedRecords: number };

type BatchAccumulator = {
  lifecycle: LifecycleState;
  totalBatches: number;
  processedBatches: number;
  batches: Map<number, BatchUnitSnapshot>;
  executionLog: BatchLogEvent[];
};

type StartResponse = {
  runId: string;
  totalRecords: number;
  batchSize: number;
  totalBatches: number;
  crashAfterBatches: number | null;
  status: string;
};

type BatchWorkflowLineMap = {
  checkpoint: number[];
  checkpointComment: number[];
  returnDone: number[];
};

type BatchStepLineMap = {
  promiseAll: number[];
  processItem: number[];
};

type BatchProcessorDemoProps = {
  workflowCode: string;
  workflowHtmlLines: string[];
  workflowLineMap: BatchWorkflowLineMap;

  stepCode: string;
  stepHtmlLines: string[];
  stepLineMap: BatchStepLineMap;
};

const TOTAL_RECORDS = 10_000;
const BATCH_SIZE = 1_000;
const ELAPSED_TICK_MS = 120;

function parseSseData(rawChunk: string): string {
  return rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
}

function parseBatchEvent(rawChunk: string): BatchEvent | null {
  const payload = parseSseData(rawChunk);
  if (!payload) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;

  const event = parsed as Record<string, unknown>;
  const type = event.type;

  if (
    type === "batch_start" &&
    typeof event.batch === "number" &&
    typeof event.start === "number" &&
    typeof event.end === "number" &&
    typeof event.label === "string"
  ) {
    return { type, batch: event.batch, start: event.start, end: event.end, label: event.label };
  }

  if (
    type === "batch_done" &&
    typeof event.batch === "number" &&
    typeof event.start === "number" &&
    typeof event.end === "number" &&
    typeof event.label === "string"
  ) {
    return { type, batch: event.batch, start: event.start, end: event.end, label: event.label };
  }

  if (type === "crash" && typeof event.afterBatch === "number" && typeof event.message === "string") {
    return { type, afterBatch: event.afterBatch, message: event.message };
  }

  if (type === "resume" && typeof event.fromBatch === "number") {
    return { type, fromBatch: event.fromBatch };
  }

  if (type === "complete" && typeof event.totalBatches === "number" && typeof event.processedRecords === "number") {
    return { type, totalBatches: event.totalBatches, processedRecords: event.processedRecords };
  }

  if (type === "done" && typeof event.totalBatches === "number" && typeof event.processedRecords === "number") {
    return { type, status: "done" as const, totalBatches: event.totalBatches, processedRecords: event.processedRecords };
  }

  return null;
}

function createAccumulator(totalBatches: number): BatchAccumulator {
  const batches = new Map<number, BatchUnitSnapshot>();
  for (let i = 1; i <= totalBatches; i++) {
    batches.set(i, { batch: i, label: "", state: "pending" });
  }
  return {
    lifecycle: "running",
    totalBatches,
    processedBatches: 0,
    batches,
    executionLog: [],
  };
}

function applyBatchEvent(
  acc: BatchAccumulator,
  event: BatchEvent,
  elapsedMs: number
): BatchAccumulator {
  const batches = new Map(acc.batches);
  const executionLog = [...acc.executionLog];

  if (event.type === "batch_start") {
    batches.set(event.batch, {
      batch: event.batch,
      label: event.label,
      state: "running",
    });
    return { ...acc, batches, executionLog };
  }

  if (event.type === "batch_done") {
    batches.set(event.batch, {
      batch: event.batch,
      label: event.label,
      state: "completed",
    });
    executionLog.push({
      kind: "batch_completed",
      message: `Batch ${event.batch} done (${event.label})`,
      atMs: Math.round(elapsedMs),
    });
    return { ...acc, lifecycle: "running", batches, processedBatches: event.batch, executionLog };
  }

  if (event.type === "crash") {
    // Mark the next batch as blocked
    const nextBatch = event.afterBatch + 1;
    const existing = batches.get(nextBatch);
    if (existing) {
      batches.set(nextBatch, { ...existing, state: "blocked" });
    }
    executionLog.push({
      kind: "crash",
      message: event.message,
      atMs: Math.round(elapsedMs),
    });
    return { ...acc, lifecycle: "crashed", batches, executionLog };
  }

  if (event.type === "resume") {
    // Unblock the batch
    const existing = batches.get(event.fromBatch);
    if (existing && existing.state === "blocked") {
      batches.set(event.fromBatch, { ...existing, state: "pending" });
    }
    executionLog.push({
      kind: "resume",
      message: "Resumed from last durable checkpoint.",
      atMs: Math.round(elapsedMs),
    });
    return { ...acc, lifecycle: "running", batches, executionLog };
  }

  if (event.type === "complete") {
    executionLog.push({
      kind: "completed",
      message: `Backfill complete. ${event.processedRecords.toLocaleString()} records in ${event.totalBatches} batches.`,
      atMs: Math.round(elapsedMs),
    });
    return { ...acc, lifecycle: "completed", executionLog };
  }

  if (event.type === "done") {
    return { ...acc, lifecycle: "completed", executionLog };
  }

  return acc;
}

export function BatchProcessorDemo({
  workflowCode,
  workflowHtmlLines,
  workflowLineMap,
  stepCode,
  stepHtmlLines,
  stepLineMap,
}: BatchProcessorDemoProps) {
  const [crashMode, setCrashMode] = useState<CrashMode>("after-5000");
  const [lifecycle, setLifecycle] = useState<LifecycleState>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [batches, setBatches] = useState<BatchUnitSnapshot[]>([]);
  const [executionLog, setExecutionLog] = useState<BatchLogEvent[]>([]);
  const [processedBatches, setProcessedBatches] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const accumulatorRef = useRef<BatchAccumulator | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopElapsedTicker = useCallback(() => {
    if (elapsedRef.current) {
      clearInterval(elapsedRef.current);
      elapsedRef.current = null;
    }
  }, []);

  const startElapsedTicker = useCallback(() => {
    stopElapsedTicker();
    elapsedRef.current = setInterval(() => {
      const startedAt = startedAtRef.current;
      if (startedAt) {
        setElapsedMs(Math.max(0, Date.now() - startedAt));
      }
    }, ELAPSED_TICK_MS);
  }, [stopElapsedTicker]);

  useEffect(() => {
    return () => {
      stopElapsedTicker();
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [stopElapsedTicker]);

  const syncFromAccumulator = useCallback((acc: BatchAccumulator) => {
    setLifecycle(acc.lifecycle);
    setProcessedBatches(acc.processedBatches);
    setExecutionLog([...acc.executionLog]);
    setBatches(
      Array.from(acc.batches.values()).sort((a, b) => a.batch - b.batch)
    );
  }, []);

  const connectToReadable = useCallback(
    async (startResponse: StartResponse) => {
      if (!abortRef.current || abortRef.current.signal.aborted) {
        abortRef.current = new AbortController();
      }
      const signal = abortRef.current.signal;

      try {
        const response = await fetch(
          `/api/readable/${encodeURIComponent(startResponse.runId)}`,
          { cache: "no-store", signal }
        );

        if (signal.aborted) return;

        if (!response.ok || !response.body) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(
            payload?.error ?? `Readable stream request failed: ${response.status}`
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const applyEvent = (event: BatchEvent) => {
          if (signal.aborted || !accumulatorRef.current || !startedAtRef.current) return;

          const elapsed = Date.now() - startedAtRef.current;
          const nextAcc = applyBatchEvent(accumulatorRef.current, event, elapsed);
          accumulatorRef.current = nextAcc;
          syncFromAccumulator(nextAcc);

          if (nextAcc.lifecycle === "completed") {
            stopElapsedTicker();
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const normalized = buffer.replaceAll("\r\n", "\n");
          const chunks = normalized.split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const chunk of chunks) {
            if (signal.aborted) return;
            const event = parseBatchEvent(chunk);
            if (event) applyEvent(event);
          }
        }

        if (!signal.aborted && buffer.trim()) {
          const event = parseBatchEvent(buffer.replaceAll("\r\n", "\n"));
          if (event) applyEvent(event);
        }
      } catch (cause: unknown) {
        if (cause instanceof Error && cause.name === "AbortError") return;
        if (signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Readable stream failed");
        stopElapsedTicker();
      } finally {
        if (accumulatorRef.current?.lifecycle === "completed") {
          stopElapsedTicker();
        }
      }
    },
    [syncFromAccumulator, stopElapsedTicker]
  );

  const handleStart = useCallback(async () => {
    setError(null);
    stopElapsedTicker();
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    startedAtRef.current = null;
    accumulatorRef.current = null;

    const signal = abortRef.current.signal;

    try {
      const crashAfterBatches = crashMode === "after-5000" ? 5 : null;

      const res = await fetch("/api/batch-processor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          totalRecords: TOTAL_RECORDS,
          batchSize: BATCH_SIZE,
          crashAfterBatches,
        }),
        signal,
      });

      const payload = (await res.json()) as StartResponse & { error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? `Request failed (${res.status})`);
      }

      if (signal.aborted) return;

      const acc = createAccumulator(payload.totalBatches);
      acc.executionLog.push({
        kind: "start",
        message: `Backfill started (${TOTAL_RECORDS.toLocaleString()} records, ${payload.totalBatches} batches)`,
        atMs: 0,
      });

      accumulatorRef.current = acc;
      startedAtRef.current = Date.now();
      setRunId(payload.runId);
      setTotalBatches(payload.totalBatches);
      setElapsedMs(0);
      syncFromAccumulator(acc);

      startElapsedTicker();
      void connectToReadable(payload);
    } catch (err) {
      if (signal.aborted || (err instanceof Error && err.name === "AbortError")) return;
      setError(err instanceof Error ? err.message : "Failed to start run");
      setLifecycle("idle");
    }
  }, [crashMode, connectToReadable, stopElapsedTicker, startElapsedTicker, syncFromAccumulator]);

  const handleReset = useCallback(() => {
    stopElapsedTicker();
    abortRef.current?.abort();
    abortRef.current = null;
    startedAtRef.current = null;
    accumulatorRef.current = null;

    setLifecycle("idle");
    setRunId(null);
    setError(null);
    setBatches([]);
    setExecutionLog([]);
    setProcessedBatches(0);
    setTotalBatches(0);
    setElapsedMs(0);

    setTimeout(() => startButtonRef.current?.focus(), 0);
  }, [stopElapsedTicker]);

  const primaryLabel = useMemo(() => {
    if (lifecycle === "running" || lifecycle === "crashed" || lifecycle === "resuming") return "Running\u2026";
    if (lifecycle === "completed") return "Run Again";
    return "Start Backfill";
  }, [lifecycle]);

  const isRunning = lifecycle === "running" || lifecycle === "crashed" || lifecycle === "resuming";

  const explainer = useMemo(() => {
    if (lifecycle === "idle") return "Start a run to see durable batching.";
    if (lifecycle === "running") {
      const current = processedBatches + 1;
      return `Processing batch ${current}/${totalBatches}. Each batch is a durable checkpoint.`;
    }
    if (lifecycle === "crashed") {
      return "Simulated crash at a batch boundary. Workflow resumes automatically from the last checkpoint.";
    }
    if (lifecycle === "resuming") {
      return "Resuming from last durable checkpoint\u2026";
    }
    if (lifecycle === "completed") {
      return `Done. Processed ${TOTAL_RECORDS.toLocaleString()} records in ${totalBatches} batches.`;
    }
    return "Run active.";
  }, [lifecycle, processedBatches, totalBatches]);

  const codeState = useMemo(() => {
    const wfMarks: Record<number, GutterMarkKind> = {};
    const stepMarks: Record<number, GutterMarkKind> = {};

    if (lifecycle === "idle") {
      return {
        tone: "amber" as HighlightTone,
        workflowActiveLines: [] as number[],
        workflowGutterMarks: wfMarks,
        stepActiveLines: [] as number[],
        stepGutterMarks: stepMarks,
      };
    }

    if (lifecycle === "running" || lifecycle === "resuming") {
      return {
        tone: "amber" as HighlightTone,
        workflowActiveLines: workflowLineMap.checkpoint,
        workflowGutterMarks: wfMarks,
        stepActiveLines: [...stepLineMap.promiseAll, ...stepLineMap.processItem],
        stepGutterMarks: stepMarks,
      };
    }

    if (lifecycle === "crashed") {
      const crashLine =
        workflowLineMap.checkpointComment.length > 0
          ? workflowLineMap.checkpointComment[0]
          : workflowLineMap.checkpoint[0];
      wfMarks[crashLine] = "fail";

      return {
        tone: "red" as HighlightTone,
        workflowActiveLines: workflowLineMap.checkpointComment.length
          ? workflowLineMap.checkpointComment
          : workflowLineMap.checkpoint,
        workflowGutterMarks: wfMarks,
        stepActiveLines: [],
        stepGutterMarks: stepMarks,
      };
    }

    // completed
    wfMarks[workflowLineMap.checkpoint[0] ?? 1] = "success";
    if (stepLineMap.promiseAll[0]) stepMarks[stepLineMap.promiseAll[0]] = "success";

    return {
      tone: "green" as HighlightTone,
      workflowActiveLines: workflowLineMap.returnDone,
      workflowGutterMarks: wfMarks,
      stepActiveLines: [],
      stepGutterMarks: stepMarks,
    };
  }, [lifecycle, workflowLineMap, stepLineMap]);

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
            onClick={() => void handleStart()}
            disabled={isRunning}
            className="min-h-10 rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {primaryLabel}
          </button>

          {lifecycle !== "idle" && (
            <button
              type="button"
              onClick={handleReset}
              className="min-h-10 rounded-md border border-gray-400 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:border-gray-300 hover:text-gray-1000"
            >
              Reset
            </button>
          )}

          <label className="inline-flex items-center gap-1.5 rounded-md border border-gray-400/80 bg-background-200 px-2 py-1.5">
            <span className="text-xs text-gray-900">Crash after</span>
            <select
              aria-label="Crash mode"
              value={crashMode}
              onChange={(e) => setCrashMode(e.target.value as CrashMode)}
              disabled={isRunning}
              className="h-8 rounded border border-gray-400 bg-background-100 px-2 text-sm font-mono text-gray-1000 transition-colors focus:border-gray-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="never">Never</option>
              <option value="after-5000">5,000 records</option>
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-gray-400/70 bg-background-100 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2" role="status" aria-live="polite">
          <p className="text-sm text-gray-900">{explainer}</p>
          {runId && (
            <span className="rounded-full bg-background-200 px-2.5 py-1 text-xs font-mono text-gray-900">
              run: {runId}
            </span>
          )}
        </div>

        <div className="lg:h-[200px]">
          <div className="grid grid-cols-1 gap-2 lg:h-full lg:grid-cols-2">
            <BatchSteps batches={batches} lifecycle={lifecycle} />
            <ExecutionLog elapsedMs={elapsedMs} events={executionLog} />
          </div>
        </div>
      </div>

      <p className="text-center text-xs italic text-gray-900">
        Sequential batches for durable checkpoints — Promise.all() for concurrent items within a step
      </p>

      <BatchCodeWorkbench
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

function BatchSteps({
  batches,
  lifecycle,
}: {
  batches: BatchUnitSnapshot[];
  lifecycle: LifecycleState;
}) {
  if (batches.length === 0) {
    return (
      <div className="h-full min-h-0 rounded-lg border border-gray-400/60 bg-background-200 p-2 text-xs text-gray-900">
        No batches yet.
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto rounded-lg border border-gray-400/60 bg-background-200 p-2">
      <div className="space-y-1">
        {batches.map((batch) => {
          const tone = batchTone(batch.state, lifecycle);
          return (
            <article
              key={batch.batch}
              className={`rounded-md border px-2 py-1.5 ${tone.cardClass}`}
              aria-label={`Batch ${batch.batch}`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${tone.dotClass}`} aria-hidden="true" />
                <p className="text-sm font-medium text-gray-1000">
                  Batch {batch.batch}
                </p>
                <span className={`rounded-full border px-1.5 py-0.5 text-xs font-semibold uppercase leading-none ${tone.badgeClass}`}>
                  {batch.state}
                </span>
                {batch.label && (
                  <p className="ml-auto text-xs font-mono tabular-nums text-gray-900">
                    {batch.label}
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
  events: BatchLogEvent[];
  elapsedMs: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-gray-400/60 bg-background-200 p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900">
          Execution log
        </h3>
        <p className="text-xs font-mono tabular-nums text-gray-900">
          {(elapsedMs / 1000).toFixed(2)}s
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
              <span className={`h-2 w-2 rounded-full ${tone.dotClass}`} aria-hidden="true" />
              <span className={`w-20 shrink-0 text-xs font-semibold uppercase ${tone.labelClass}`}>
                {event.kind}
              </span>
              <p className="min-w-0 flex-1 truncate">{event.message}</p>
              <span className="shrink-0 font-mono tabular-nums text-gray-900">
                +{Math.round(event.atMs)}ms
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function batchTone(state: BatchUnitState, lifecycle: LifecycleState) {
  if (state === "running") {
    return {
      dotClass: "bg-amber-700 animate-pulse",
      badgeClass: "border-amber-700/40 bg-amber-700/10 text-amber-700",
      cardClass: "border-amber-700/40 bg-amber-700/10",
    };
  }

  if (state === "blocked") {
    return {
      dotClass: "bg-red-700",
      badgeClass: "border-red-700/40 bg-red-700/10 text-red-700",
      cardClass: "border-red-700/40 bg-red-700/10",
    };
  }

  if (state === "completed") {
    return {
      dotClass: "bg-green-700",
      badgeClass: "border-green-700/40 bg-green-700/10 text-green-700",
      cardClass: "border-green-700/40 bg-green-700/10",
    };
  }

  return {
    dotClass: "bg-gray-500",
    badgeClass: "border-gray-400/70 bg-background-100 text-gray-900",
    cardClass: "border-gray-400/40 bg-background-100",
  };
}

function eventTone(kind: string) {
  switch (kind) {
    case "batch_completed":
      return { dotClass: "bg-green-700", labelClass: "text-green-700" };
    case "crash":
      return { dotClass: "bg-red-700", labelClass: "text-red-700" };
    case "resume":
      return { dotClass: "bg-amber-700", labelClass: "text-amber-700" };
    case "completed":
      return { dotClass: "bg-green-700", labelClass: "text-green-700" };
    case "start":
    default:
      return { dotClass: "bg-cyan-700", labelClass: "text-cyan-700" };
  }
}
