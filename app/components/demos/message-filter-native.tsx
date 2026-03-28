// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilterCodeWorkbench } from "@/message-filter/app/components/filter-code-workbench";

// --- Types matching workflows/order-filter.ts ---
type FilterVerdict = "pass" | "reject";
type StageId = "fraud" | "amount" | "region";
type RunStatus = "filtering" | "done";
type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail" | "retry";

type Order = {
  id: string;
  amount: number;
  region: string;
  fraudScore: number;
  customer: string;
};

export type FilterEvent = {
  type: "filter_start" | "filter_check" | "filter_result" | "filter_done";
  orderId: string;
  stage?: string;
  verdict?: FilterVerdict;
  reason?: string;
  passedOrders?: Order[];
  rejectedOrders?: { order: Order; stage: string; reason: string }[];
};

type OrderVerdict = {
  stage: StageId;
  verdict: FilterVerdict;
  reason?: string;
};

type OrderAccumulator = {
  id: string;
  verdicts: OrderVerdict[];
  currentStage: StageId | null;
  finalVerdict: FilterVerdict | null;
};

type FilterAccumulator = {
  runId: string;
  status: RunStatus;
  orders: Record<string, OrderAccumulator>;
  activeStage: StageId | null;
  passedCount: number;
  rejectedCount: number;
};

type FilterSnapshot = {
  runId: string;
  status: RunStatus;
  orders: Record<string, OrderAccumulator>;
  activeStage: StageId | null;
  passedCount: number;
  rejectedCount: number;
  elapsedMs: number;
};

type StartResponse = {
  runId: string;
  config?: unknown;
  status: "filtering";
};

type WorkflowLineMap = {
  orderFilter: number[];
  fraudCall: number[];
  amountCall: number[];
  regionCall: number[];
  emitCall: number[];
};

type StepLineMap = {
  fraud: number[];
  amount: number[];
  region: number[];
};

type DemoProps = {
  workflowCode: string;
  workflowLinesHtml: string[];
  stepCode: string;
  stepLinesHtml: string[];
  workflowLineMap: WorkflowLineMap;
  stepLineMap: StepLineMap;
};

type HighlightState = {
  workflowActiveLines: number[];
  stepActiveLines: number[];
  workflowGutterMarks: Record<number, GutterMarkKind>;
  stepGutterMarks: Record<number, GutterMarkKind>;
  activeStage: StageId | null;
};

const STAGES: Array<{ id: StageId; label: string; short: string }> = [
  { id: "fraud", label: "Fraud Check", short: "FR" },
  { id: "amount", label: "Amount Threshold", short: "AM" },
  { id: "region", label: "Region Filter", short: "RE" },
];

const SAMPLE_ORDER_IDS = [
  "ORD-001", "ORD-002", "ORD-003", "ORD-004",
  "ORD-005", "ORD-006", "ORD-007", "ORD-008",
];

const ELAPSED_TICK_MS = 120;

const EMPTY_HIGHLIGHT_STATE: HighlightState = {
  workflowActiveLines: [],
  stepActiveLines: [],
  workflowGutterMarks: {},
  stepGutterMarks: {},
  activeStage: null,
};

function isStageId(value: string): value is StageId {
  return value === "fraud" || value === "amount" || value === "region";
}

export function createAccumulator(start: StartResponse): FilterAccumulator {
  const orders: Record<string, OrderAccumulator> = {};
  for (const id of SAMPLE_ORDER_IDS) {
    orders[id] = { id, verdicts: [], currentStage: null, finalVerdict: null };
  }
  return {
    runId: start.runId,
    status: "filtering",
    orders,
    activeStage: null,
    passedCount: 0,
    rejectedCount: 0,
  };
}

export function applyFilterEvent(
  current: FilterAccumulator,
  event: FilterEvent
): FilterAccumulator {
  if (event.type === "filter_done") {
    return {
      ...current,
      status: "done",
      passedCount: event.passedOrders?.length ?? 0,
      rejectedCount: event.rejectedOrders?.length ?? 0,
      activeStage: null,
    };
  }

  if (event.type === "filter_check" && event.stage && isStageId(event.stage)) {
    const order = current.orders[event.orderId];
    if (!order) return current;
    return {
      ...current,
      activeStage: event.stage,
      orders: {
        ...current.orders,
        [event.orderId]: { ...order, currentStage: event.stage },
      },
    };
  }

  if (event.type === "filter_result" && event.stage && isStageId(event.stage) && event.verdict) {
    const order = current.orders[event.orderId];
    if (!order) return current;
    const verdict: OrderVerdict = {
      stage: event.stage,
      verdict: event.verdict,
      reason: event.reason,
    };
    const finalVerdict = event.verdict === "reject" ? "reject" : order.finalVerdict;
    return {
      ...current,
      orders: {
        ...current.orders,
        [event.orderId]: {
          ...order,
          verdicts: [...order.verdicts, verdict],
          currentStage: null,
          finalVerdict,
        },
      },
    };
  }

  return current;
}

export function toSnapshot(
  accumulator: FilterAccumulator,
  startedAtMs: number
): FilterSnapshot {
  return {
    ...accumulator,
    elapsedMs: Math.max(0, Date.now() - startedAtMs),
  };
}

function parseSseData(rawChunk: string): string {
  return rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
}

export function parseFilterEvent(rawChunk: string): FilterEvent | null {
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
    type === "filter_check" &&
    typeof event.orderId === "string" &&
    typeof event.stage === "string"
  ) {
    return { type, orderId: event.orderId, stage: event.stage };
  }

  if (
    type === "filter_result" &&
    typeof event.orderId === "string" &&
    typeof event.stage === "string" &&
    typeof event.verdict === "string"
  ) {
    return {
      type,
      orderId: event.orderId,
      stage: event.stage,
      verdict: event.verdict as FilterVerdict,
      reason: typeof event.reason === "string" ? event.reason : undefined,
    };
  }

  if (type === "filter_done" && typeof event.orderId === "string") {
    return {
      type,
      orderId: event.orderId,
      passedOrders: Array.isArray(event.passedOrders) ? (event.passedOrders as Order[]) : undefined,
      rejectedOrders: Array.isArray(event.rejectedOrders)
        ? (event.rejectedOrders as { order: Order; stage: string; reason: string }[])
        : undefined,
    };
  }

  if (type === "filter_start" && typeof event.orderId === "string") {
    return { type, orderId: event.orderId };
  }

  return null;
}

function ensureActiveAbortController(
  existing: AbortController | null
): AbortController {
  if (!existing || existing.signal.aborted) {
    return new AbortController();
  }
  return existing;
}

function formatElapsedMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function verdictColor(verdict: FilterVerdict | null): string {
  if (verdict === "pass") return "var(--color-green-700)";
  if (verdict === "reject") return "var(--color-red-700)";
  return "var(--color-gray-500)";
}

function stageColor(stage: StageId | null, snapshot: FilterSnapshot | null): string {
  if (!snapshot || !stage) return "var(--color-gray-500)";
  if (snapshot.activeStage === stage) return "var(--color-amber-700)";
  return "var(--color-green-700)";
}

type LogTone = "default" | "green" | "amber" | "red" | "cyan";
type LogEntry = { text: string; tone: LogTone };

function eventToLogEntry(event: FilterEvent, elapsedMs: number): LogEntry {
  const ts = formatElapsedMs(elapsedMs);

  switch (event.type) {
    case "filter_check":
      return { text: `[${ts}] checking ${event.orderId} at ${event.stage}`, tone: "default" };
    case "filter_result": {
      const tone: LogTone = event.verdict === "reject" ? "red" : "green";
      return {
        text: `[${ts}] ${event.orderId} ${event.verdict}${event.reason ? ` — ${event.reason}` : ""}`,
        tone,
      };
    }
    case "filter_done":
      return {
        text: `[${ts}] done — ${event.passedOrders?.length ?? 0} passed, ${event.rejectedOrders?.length ?? 0} rejected`,
        tone: "cyan",
      };
    case "filter_start":
      return { text: `[${ts}] filter started for ${event.orderId}`, tone: "default" };
  }
}

const IDLE_LOG: LogEntry[] = [
  { text: "Idle: click Run Filter to start the workflow.", tone: "default" },
  { text: "Orders flow through 3 filter stages: fraud, amount, region.", tone: "default" },
];

const LOG_TONE_CLASS: Record<LogTone, string> = {
  default: "text-gray-900",
  green: "text-green-700",
  amber: "text-amber-700",
  red: "text-red-700",
  cyan: "text-cyan-700",
};

function highlightToneForSnapshot(snapshot: FilterSnapshot | null): HighlightTone {
  if (!snapshot) return "amber";
  if (snapshot.status === "filtering") return "amber";
  return snapshot.rejectedCount > 0 ? "red" : "green";
}

function buildHighlightState(
  snapshot: FilterSnapshot | null,
  workflowLineMap: WorkflowLineMap,
  stepLineMap: StepLineMap
): HighlightState {
  if (!snapshot) return EMPTY_HIGHLIGHT_STATE;

  const workflowGutterMarks: Record<number, GutterMarkKind> = {};
  const stepGutterMarks: Record<number, GutterMarkKind> = {};

  if (snapshot.status === "filtering") {
    const stage = snapshot.activeStage;

    // Highlight the active stage call in workflow
    let workflowActiveLines: number[] = [];
    if (stage === "fraud") workflowActiveLines = workflowLineMap.fraudCall;
    else if (stage === "amount") workflowActiveLines = workflowLineMap.amountCall;
    else if (stage === "region") workflowActiveLines = workflowLineMap.regionCall;

    // Mark completed stages
    const completedStages: StageId[] = [];
    if (stage === "amount") completedStages.push("fraud");
    if (stage === "region") {
      completedStages.push("fraud");
      completedStages.push("amount");
    }

    for (const s of completedStages) {
      const callLines = s === "fraud" ? workflowLineMap.fraudCall : s === "amount" ? workflowLineMap.amountCall : workflowLineMap.regionCall;
      for (const line of callLines) {
        workflowGutterMarks[line] = "success";
      }
    }

    return {
      workflowActiveLines,
      stepActiveLines: stage ? (stepLineMap[stage] ?? []) : [],
      workflowGutterMarks,
      stepGutterMarks,
      activeStage: stage,
    };
  }

  // Done state — mark all stages as completed
  for (const line of workflowLineMap.fraudCall) workflowGutterMarks[line] = "success";
  for (const line of workflowLineMap.amountCall) workflowGutterMarks[line] = "success";
  for (const line of workflowLineMap.regionCall) workflowGutterMarks[line] = "success";
  for (const line of workflowLineMap.emitCall) workflowGutterMarks[line] = "success";

  return {
    workflowActiveLines: [],
    stepActiveLines: [],
    workflowGutterMarks,
    stepGutterMarks,
    activeStage: null,
  };
}

function statusExplanation(
  status: RunStatus | "idle",
  activeStage: StageId | null
): string {
  if (status === "idle") {
    return "Waiting to start. Click Run Filter to process orders through the pipeline.";
  }
  if (status === "filtering") {
    if (activeStage) {
      const label = STAGES.find((s) => s.id === activeStage)?.label ?? activeStage;
      return `Filtering active: processing orders through the ${label} stage.`;
    }
    return "Filtering active: orders are flowing through the filter pipeline.";
  }
  return "Completed: all orders have been evaluated through all filter stages.";
}

async function postJson<TResponse>(
  url: string,
  body: unknown,
  signal?: AbortSignal
): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed: ${response.status}`);
  }

  return payload as TResponse;
}

export function FilterDemo({
  workflowCode,
  workflowLinesHtml,
  stepCode,
  stepLinesHtml,
  workflowLineMap,
  stepLineMap,
}: DemoProps) {
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<FilterSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<LogEntry[]>(IDLE_LOG);

  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const accumulatorRef = useRef<FilterAccumulator | null>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    if (runId && !hasScrolledRef.current) {
      hasScrolledRef.current = true;
      const heading = document.getElementById("try-it-heading");
      if (heading) {
        const top = heading.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top, behavior: "smooth" });
      }
    }
    if (!runId) {
      hasScrolledRef.current = false;
    }
  }, [runId]);

  const stopElapsedTicker = useCallback(() => {
    if (!elapsedRef.current) return;
    clearInterval(elapsedRef.current);
    elapsedRef.current = null;
  }, []);

  const startElapsedTicker = useCallback(() => {
    stopElapsedTicker();
    elapsedRef.current = setInterval(() => {
      const startedAtMs = startedAtRef.current;
      if (!startedAtMs) return;
      setSnapshot((previous) => {
        if (!previous || previous.status === "done") return previous;
        return { ...previous, elapsedMs: Math.max(0, Date.now() - startedAtMs) };
      });
    }, ELAPSED_TICK_MS);
  }, [stopElapsedTicker]);

  const ensureAbortController = useCallback((): AbortController => {
    const nextController = ensureActiveAbortController(abortRef.current);
    abortRef.current = nextController;
    return nextController;
  }, []);

  useEffect(() => {
    return () => {
      stopElapsedTicker();
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [stopElapsedTicker]);

  const connectToReadable = useCallback(
    async (start: StartResponse) => {
      const controller = ensureAbortController();
      const signal = controller.signal;

      try {
        const response = await fetch(
          `/api/readable/${encodeURIComponent(start.runId)}`,
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

        const applyEvent = (event: FilterEvent) => {
          if (signal.aborted || !startedAtRef.current || !accumulatorRef.current) return;

          const elapsedMs = Math.max(0, Date.now() - startedAtRef.current);
          const nextAccumulator = applyFilterEvent(accumulatorRef.current, event);
          accumulatorRef.current = nextAccumulator;

          setSnapshot(toSnapshot(nextAccumulator, startedAtRef.current));
          setEventLog((prev) => [...prev, eventToLogEntry(event, elapsedMs)]);

          if (nextAccumulator.status === "done") {
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
            const event = parseFilterEvent(chunk);
            if (!event) continue;
            applyEvent(event);
          }
        }

        if (!signal.aborted && buffer.trim()) {
          const event = parseFilterEvent(buffer.replaceAll("\r\n", "\n"));
          if (event) applyEvent(event);
        }
      } catch (cause: unknown) {
        if (cause instanceof Error && cause.name === "AbortError") return;
        if (signal.aborted) return;

        const detail = cause instanceof Error ? cause.message : "Readable stream failed";
        setError(detail);
        stopElapsedTicker();
      } finally {
        if (accumulatorRef.current?.status === "done") {
          stopElapsedTicker();
        }
      }
    },
    [ensureAbortController, stopElapsedTicker]
  );

  const handleStart = async () => {
    setError(null);
    setSnapshot(null);
    setRunId(null);
    setEventLog([]);

    stopElapsedTicker();
    abortRef.current?.abort();
    abortRef.current = null;
    startedAtRef.current = null;
    accumulatorRef.current = null;

    try {
      const controller = ensureAbortController();
      const payload = await postJson<StartResponse>(
        "/api/message-filter",
        {},
        controller.signal
      );
      if (controller.signal.aborted) return;

      const startedAt = Date.now();
      const nextAccumulator = createAccumulator(payload);
      startedAtRef.current = startedAt;
      accumulatorRef.current = nextAccumulator;
      setRunId(payload.runId);
      setSnapshot(toSnapshot(nextAccumulator, startedAt));
      setEventLog([
        { text: "[0.00s] filter pipeline started with 8 orders", tone: "default" },
        { text: "[0.00s] stages: fraud → amount → region", tone: "default" },
      ]);

      if (controller.signal.aborted) return;

      startElapsedTicker();
      void connectToReadable(payload);
    } catch (cause: unknown) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      const detail = cause instanceof Error ? cause.message : "Unknown error";
      setError(detail);
    }
  };

  const handleReset = () => {
    stopElapsedTicker();
    abortRef.current?.abort();
    abortRef.current = null;
    startedAtRef.current = null;
    accumulatorRef.current = null;
    setRunId(null);
    setSnapshot(null);
    setError(null);
    setEventLog(IDLE_LOG);
    setTimeout(() => {
      startButtonRef.current?.focus();
    }, 0);
  };

  const effectiveStatus: RunStatus | "idle" =
    snapshot?.status ?? (runId ? "filtering" : "idle");

  const isRunning = runId !== null && snapshot?.status !== "done";

  const highlights = useMemo(
    () => buildHighlightState(snapshot, workflowLineMap, stepLineMap),
    [snapshot, workflowLineMap, stepLineMap]
  );

  const highlightTone = useMemo(
    () => highlightToneForSnapshot(snapshot),
    [snapshot]
  );

  const captionText = useMemo(() => {
    if (effectiveStatus === "filtering" && highlights.activeStage) {
      const label = STAGES.find((s) => s.id === highlights.activeStage)?.label ?? highlights.activeStage;
      return `Sequential pipeline: orders flow through ${label} stage.`;
    }
    if (effectiveStatus === "done") {
      return `Pipeline complete: ${snapshot?.passedCount ?? 0} passed, ${snapshot?.rejectedCount ?? 0} rejected.`;
    }
    return "Sequential pipeline: orders flow through fraud → amount → region.";
  }, [effectiveStatus, highlights.activeStage, snapshot?.passedCount, snapshot?.rejectedCount]);

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-700/40 bg-red-700/10 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-gray-400 bg-background-100 p-4">
          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                ref={startButtonRef}
                onClick={() => {
                  void handleStart();
                }}
                disabled={isRunning}
                className="cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Run Filter
              </button>

              <button
                type="button"
                onClick={handleReset}
                disabled={!runId}
                className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                  runId
                    ? "cursor-pointer border-gray-400 text-gray-900 hover:border-gray-300 hover:text-gray-1000"
                    : "invisible border-transparent"
                }`}
              >
                Reset Demo
              </button>
            </div>
          </div>

          <div
            className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2 text-xs text-gray-900"
            role="status"
            aria-live="polite"
          >
            {statusExplanation(effectiveStatus, highlights.activeStage)}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-gray-400 bg-background-100 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-900">
              Workflow Phase
            </span>
            <RunStatusBadge status={effectiveStatus} />
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">runId</span>
              <code className="font-mono text-xs text-gray-1000">
                {runId ?? "not started"}
              </code>
            </div>
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">Active Stage</span>
              <code className="font-mono text-gray-1000">
                {highlights.activeStage ?? (effectiveStatus === "done" ? "complete" : "-")}
              </code>
            </div>
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">Results</span>
              <span className="font-mono text-gray-1000">
                {snapshot?.status === "done"
                  ? `${snapshot.passedCount} passed / ${snapshot.rejectedCount} rejected`
                  : "-"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FilterPipelineGraph activeStage={highlights.activeStage} status={effectiveStatus} />
        <OrderStatusTable orders={snapshot?.orders ?? null} />
      </div>

      <div className="rounded-md border border-gray-400 bg-background-100 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
          Execution Log
        </p>
        <ol className="space-y-1 font-mono text-xs">
          {eventLog.map((entry, index) => (
            <li key={`${entry.text}-${index}`} className={LOG_TONE_CLASS[entry.tone]}>{entry.text}</li>
          ))}
        </ol>
      </div>

      <p className="text-center text-xs italic text-gray-900">{captionText}</p>

      <FilterCodeWorkbench
        workflowCode={workflowCode}
        workflowLinesHtml={workflowLinesHtml}
        workflowActiveLines={highlights.workflowActiveLines}
        workflowGutterMarks={highlights.workflowGutterMarks}
        stepCode={stepCode}
        stepLinesHtml={stepLinesHtml}
        stepActiveLines={highlights.stepActiveLines}
        stepGutterMarks={highlights.stepGutterMarks}
        tone={highlightTone}
      />
    </div>
  );
}

function FilterPipelineGraph({
  activeStage,
  status,
}: {
  activeStage: StageId | null;
  status: RunStatus | "idle";
}) {
  const nodes: Array<{ id: StageId; x: number; y: number; short: string; label: string }> = [
    { id: "fraud", x: 60, y: 128, short: "FR", label: "Fraud" },
    { id: "amount", x: 160, y: 128, short: "AM", label: "Amount" },
    { id: "region", x: 260, y: 128, short: "RE", label: "Region" },
  ];

  const stageOrder: StageId[] = ["fraud", "amount", "region"];

  function nodeColor(id: StageId): string {
    if (status === "idle") return "var(--color-gray-500)";
    if (status === "done") return "var(--color-green-700)";
    if (!activeStage) return "var(--color-gray-500)";
    const activeIdx = stageOrder.indexOf(activeStage);
    const nodeIdx = stageOrder.indexOf(id);
    if (nodeIdx < activeIdx) return "var(--color-green-700)";
    if (nodeIdx === activeIdx) return "var(--color-amber-700)";
    return "var(--color-gray-500)";
  }

  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Filter Pipeline
      </p>

      <svg
        viewBox="0 0 320 200"
        role="img"
        aria-label="Sequential filter pipeline: fraud, amount, region"
        className="h-auto w-full"
      >
        <rect x={0} y={0} width={320} height={200} fill="var(--color-background-100)" rx={8} />

        {/* Input arrow */}
        <line x1={10} y1={128} x2={40} y2={128} stroke="var(--color-gray-500)" strokeWidth={2} />
        <polygon points="38,124 44,128 38,132" fill="var(--color-gray-500)" />
        <text x={10} y={108} className="fill-gray-900 font-mono text-xs">Orders</text>

        {/* Arrows between stages */}
        {nodes.slice(0, -1).map((node, i) => {
          const next = nodes[i + 1];
          const color = nodeColor(next.id);
          return (
            <g key={`arrow-${node.id}`}>
              <line
                x1={node.x + 20}
                y1={128}
                x2={next.x - 20}
                y2={128}
                stroke={color}
                strokeWidth={2}
                strokeDasharray={activeStage === next.id ? "6 4" : undefined}
                className={activeStage === next.id ? "animate-pulse" : undefined}
              />
              <polygon
                points={`${next.x - 22},124 ${next.x - 16},128 ${next.x - 22},132`}
                fill={color}
              />
            </g>
          );
        })}

        {/* Output arrow */}
        <line x1={280} y1={128} x2={310} y2={128} stroke={status === "done" ? "var(--color-green-700)" : "var(--color-gray-500)"} strokeWidth={2} />
        <polygon points="308,124 314,128 308,132" fill={status === "done" ? "var(--color-green-700)" : "var(--color-gray-500)"} />
        <text x={280} y={108} className="fill-gray-900 font-mono text-xs">Result</text>

        {nodes.map((node) => {
          const color = nodeColor(node.id);
          return (
            <g key={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                r={18}
                fill="var(--color-background-200)"
                stroke={color}
                strokeWidth={2.5}
                className={activeStage === node.id ? "animate-pulse" : undefined}
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
                y={node.y + 34}
                textAnchor="middle"
                className="fill-gray-900 font-mono text-xs"
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function OrderStatusTable({ orders }: { orders: Record<string, OrderAccumulator> | null }) {
  const orderList = orders ? Object.values(orders) : [];

  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Order Results
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-400/70">
              <th className="px-2 py-1 text-left font-semibold text-gray-900">Order</th>
              {STAGES.map((stage) => (
                <th key={stage.id} className="px-2 py-1 text-center font-semibold text-gray-900">
                  {stage.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orderList.length === 0
              ? SAMPLE_ORDER_IDS.map((id) => (
                  <tr key={id} className="border-b border-gray-400/30">
                    <td className="px-2 py-1 font-mono text-gray-1000">{id}</td>
                    {STAGES.map((stage) => (
                      <td key={stage.id} className="px-2 py-1 text-center text-gray-700">
                        —
                      </td>
                    ))}
                  </tr>
                ))
              : orderList.map((order) => (
                  <tr key={order.id} className="border-b border-gray-400/30">
                    <td className="px-2 py-1 font-mono text-gray-1000">{order.id}</td>
                    {STAGES.map((stage) => {
                      const verdict = order.verdicts.find((v) => v.stage === stage.id);
                      const isChecking = order.currentStage === stage.id;
                      return (
                        <td key={stage.id} className="px-2 py-1 text-center">
                          {isChecking ? (
                            <span className="inline-block rounded-full bg-amber-700/20 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                              ...
                            </span>
                          ) : verdict ? (
                            <VerdictBadge verdict={verdict.verdict} />
                          ) : (
                            <span className="text-gray-700">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: FilterVerdict }) {
  if (verdict === "pass") {
    return (
      <span className="inline-block rounded-full bg-green-700/20 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
        pass
      </span>
    );
  }
  return (
    <span className="inline-block rounded-full bg-red-700/20 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
      reject
    </span>
  );
}

function RunStatusBadge({ status }: { status: RunStatus | "idle" }) {
  if (status === "done") {
    return (
      <span className="rounded-full bg-green-700/20 px-2 py-0.5 text-xs font-medium text-green-700">
        done
      </span>
    );
  }
  if (status === "filtering") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        filtering
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-900">
      idle
    </span>
  );
}

const demoProps = {
  workflowCode: "",
  workflowLinesHtml: [],
  stepCode: "",
  stepLinesHtml: [],
  workflowLineMap: {},
  stepLineMap: {},
} as unknown as Parameters<typeof FilterDemo>[0];

export default function MessageFilterNativeDemo() {
  return <FilterDemo {...demoProps} />;
}
