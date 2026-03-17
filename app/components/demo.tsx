"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NormalizerCodeWorkbench } from "./normalizer-code-workbench";

// --- Types matching workflows/normalizer.ts ---
type RawFormat = "xml" | "csv" | "legacy-json";
type RunStatus = "normalizing" | "done";
type StepId = "detect" | "parse" | "emit";
type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail" | "retry";

type CanonicalOrder = {
  orderId: string;
  customer: string;
  amount: number;
  currency: string;
  sourceFormat: RawFormat;
};

export type NormalizeEvent = {
  type: "normalize_detect" | "normalize_parse" | "normalize_result" | "normalize_done";
  messageId: string;
  detectedFormat?: RawFormat;
  canonical?: CanonicalOrder;
  error?: string;
  results?: {
    successful: CanonicalOrder[];
    failed: { messageId: string; error: string }[];
  };
};

type MessageAccumulator = {
  id: string;
  format: RawFormat | null;
  detectedFormat: RawFormat | null;
  canonical: CanonicalOrder | null;
  error: string | null;
  step: StepId | null;
};

type NormalizeAccumulator = {
  runId: string;
  status: RunStatus;
  messages: Record<string, MessageAccumulator>;
  activeStep: StepId | null;
  successCount: number;
  failCount: number;
};

type NormalizeSnapshot = NormalizeAccumulator & {
  elapsedMs: number;
};

type StartResponse = {
  runId: string;
  config?: unknown;
  status: "normalizing";
};

type WorkflowLineMap = {
  normalizer: number[];
  detectCall: number[];
  parseCall: number[];
  emitCall: number[];
};

type StepLineMap = {
  detect: number[];
  parse: number[];
  emit: number[];
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
  activeStep: StepId | null;
};

const STEPS: Array<{ id: StepId; label: string; short: string }> = [
  { id: "detect", label: "Detect Format", short: "DT" },
  { id: "parse", label: "Parse to Canonical", short: "PR" },
  { id: "emit", label: "Emit Results", short: "EM" },
];

const SAMPLE_MESSAGE_IDS = [
  "MSG-001", "MSG-002", "MSG-003", "MSG-004", "MSG-005", "MSG-006",
];

const SAMPLE_FORMATS: Record<string, RawFormat> = {
  "MSG-001": "xml",
  "MSG-002": "csv",
  "MSG-003": "legacy-json",
  "MSG-004": "xml",
  "MSG-005": "csv",
  "MSG-006": "legacy-json",
};

const ELAPSED_TICK_MS = 120;

const EMPTY_HIGHLIGHT_STATE: HighlightState = {
  workflowActiveLines: [],
  stepActiveLines: [],
  workflowGutterMarks: {},
  stepGutterMarks: {},
  activeStep: null,
};

export function createAccumulator(start: StartResponse): NormalizeAccumulator {
  const messages: Record<string, MessageAccumulator> = {};
  for (const id of SAMPLE_MESSAGE_IDS) {
    messages[id] = {
      id,
      format: SAMPLE_FORMATS[id] ?? null,
      detectedFormat: null,
      canonical: null,
      error: null,
      step: null,
    };
  }
  return {
    runId: start.runId,
    status: "normalizing",
    messages,
    activeStep: null,
    successCount: 0,
    failCount: 0,
  };
}

export function applyNormalizeEvent(
  current: NormalizeAccumulator,
  event: NormalizeEvent
): NormalizeAccumulator {
  if (event.type === "normalize_done") {
    return {
      ...current,
      status: "done",
      activeStep: null,
      successCount: event.results?.successful.length ?? current.successCount,
      failCount: event.results?.failed.length ?? current.failCount,
    };
  }

  if (event.type === "normalize_detect") {
    const msg = current.messages[event.messageId];
    if (!msg) return current;
    return {
      ...current,
      activeStep: "detect",
      messages: {
        ...current.messages,
        [event.messageId]: {
          ...msg,
          detectedFormat: event.detectedFormat ?? null,
          step: "detect",
        },
      },
    };
  }

  if (event.type === "normalize_parse") {
    const msg = current.messages[event.messageId];
    if (!msg) return current;
    return {
      ...current,
      activeStep: "parse",
      successCount: current.successCount + 1,
      messages: {
        ...current.messages,
        [event.messageId]: {
          ...msg,
          canonical: event.canonical ?? null,
          step: "parse",
        },
      },
    };
  }

  if (event.type === "normalize_result" && event.error) {
    const msg = current.messages[event.messageId];
    if (!msg) return current;
    return {
      ...current,
      activeStep: "parse",
      failCount: current.failCount + 1,
      messages: {
        ...current.messages,
        [event.messageId]: {
          ...msg,
          error: event.error,
          step: "parse",
        },
      },
    };
  }

  return current;
}

export function toSnapshot(
  accumulator: NormalizeAccumulator,
  startedAtMs: number
): NormalizeSnapshot {
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

export function parseNormalizeEvent(rawChunk: string): NormalizeEvent | null {
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
    type === "normalize_detect" &&
    typeof event.messageId === "string"
  ) {
    return {
      type,
      messageId: event.messageId,
      detectedFormat: typeof event.detectedFormat === "string"
        ? (event.detectedFormat as RawFormat)
        : undefined,
    };
  }

  if (
    type === "normalize_parse" &&
    typeof event.messageId === "string"
  ) {
    return {
      type,
      messageId: event.messageId,
      canonical: event.canonical as CanonicalOrder | undefined,
    };
  }

  if (
    type === "normalize_result" &&
    typeof event.messageId === "string"
  ) {
    return {
      type,
      messageId: event.messageId,
      error: typeof event.error === "string" ? event.error : undefined,
    };
  }

  if (
    type === "normalize_done" &&
    typeof event.messageId === "string"
  ) {
    return {
      type,
      messageId: event.messageId,
      results: event.results as NormalizeEvent["results"],
      error: typeof event.error === "string" ? event.error : undefined,
    };
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

type LogTone = "default" | "green" | "amber" | "red" | "cyan";
type LogEntry = { text: string; tone: LogTone };

function eventToLogEntry(event: NormalizeEvent, elapsedMs: number): LogEntry {
  const ts = formatElapsedMs(elapsedMs);

  switch (event.type) {
    case "normalize_detect":
      return {
        text: `[${ts}] detected ${event.messageId} as ${event.detectedFormat}`,
        tone: "default",
      };
    case "normalize_parse":
      return {
        text: `[${ts}] parsed ${event.messageId} → ${event.canonical?.orderId ?? "?"}`,
        tone: "green",
      };
    case "normalize_result":
      return {
        text: `[${ts}] ${event.messageId} failed: ${event.error}`,
        tone: "red",
      };
    case "normalize_done":
      return {
        text: `[${ts}] done — ${event.results?.successful.length ?? 0} normalized, ${event.results?.failed.length ?? 0} failed`,
        tone: "cyan",
      };
  }
}

const IDLE_LOG: LogEntry[] = [
  { text: "Idle: click Normalize to start the workflow.", tone: "default" },
  { text: "Messages in XML, CSV, and legacy-JSON are transformed to canonical format.", tone: "default" },
];

const LOG_TONE_CLASS: Record<LogTone, string> = {
  default: "text-gray-900",
  green: "text-green-700",
  amber: "text-amber-700",
  red: "text-red-700",
  cyan: "text-cyan-700",
};

function formatBadgeColor(format: RawFormat | null): string {
  if (format === "xml") return "bg-blue-700/20 text-blue-700";
  if (format === "csv") return "bg-purple-700/20 text-purple-700";
  if (format === "legacy-json") return "bg-amber-700/20 text-amber-700";
  return "bg-gray-500/10 text-gray-900";
}

function highlightToneForSnapshot(snapshot: NormalizeSnapshot | null): HighlightTone {
  if (!snapshot) return "amber";
  if (snapshot.status === "normalizing") return "amber";
  return snapshot.failCount > 0 ? "red" : "green";
}

export function buildHighlightState(
  snapshot: NormalizeSnapshot | null,
  workflowLineMap: WorkflowLineMap,
  stepLineMap: StepLineMap
): HighlightState {
  if (!snapshot) return EMPTY_HIGHLIGHT_STATE;

  const workflowGutterMarks: Record<number, GutterMarkKind> = {};

  if (snapshot.status === "normalizing") {
    const step = snapshot.activeStep;

    let workflowActiveLines: number[] = [];
    if (step === "detect") workflowActiveLines = workflowLineMap.detectCall;
    else if (step === "parse") workflowActiveLines = workflowLineMap.parseCall;
    else if (step === "emit") workflowActiveLines = workflowLineMap.emitCall;

    const completedSteps: StepId[] = [];
    if (step === "parse") completedSteps.push("detect");
    if (step === "emit") {
      completedSteps.push("detect");
      completedSteps.push("parse");
    }

    for (const s of completedSteps) {
      const callLines =
        s === "detect"
          ? workflowLineMap.detectCall
          : s === "parse"
            ? workflowLineMap.parseCall
            : workflowLineMap.emitCall;
      for (const line of callLines) {
        workflowGutterMarks[line] = "success";
      }
    }

    return {
      workflowActiveLines,
      stepActiveLines: step ? (stepLineMap[step] ?? []) : [],
      workflowGutterMarks,
      stepGutterMarks: {},
      activeStep: step,
    };
  }

  for (const line of workflowLineMap.detectCall) workflowGutterMarks[line] = "success";
  for (const line of workflowLineMap.parseCall) workflowGutterMarks[line] = "success";
  for (const line of workflowLineMap.emitCall) workflowGutterMarks[line] = "success";

  return {
    workflowActiveLines: [],
    stepActiveLines: [],
    workflowGutterMarks,
    stepGutterMarks: {},
    activeStep: null,
  };
}

function statusExplanation(
  status: RunStatus | "idle",
  activeStep: StepId | null
): string {
  if (status === "idle") {
    return "Waiting to start. Click Normalize to transform messages into canonical format.";
  }
  if (status === "normalizing") {
    if (activeStep) {
      const label = STEPS.find((s) => s.id === activeStep)?.label ?? activeStep;
      return `Normalizing: running the ${label} step.`;
    }
    return "Normalizing: messages are being transformed into canonical format.";
  }
  return "Completed: all messages have been normalized to the canonical schema.";
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

export function NormalizerDemo({
  workflowCode,
  workflowLinesHtml,
  stepCode,
  stepLinesHtml,
  workflowLineMap,
  stepLineMap,
}: DemoProps) {
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<NormalizeSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<LogEntry[]>(IDLE_LOG);

  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const accumulatorRef = useRef<NormalizeAccumulator | null>(null);
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

        const applyEvent = (event: NormalizeEvent) => {
          if (signal.aborted || !startedAtRef.current || !accumulatorRef.current) return;

          const elapsedMs = Math.max(0, Date.now() - startedAtRef.current);
          const nextAccumulator = applyNormalizeEvent(accumulatorRef.current, event);
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
            const event = parseNormalizeEvent(chunk);
            if (!event) continue;
            applyEvent(event);
          }
        }

        if (!signal.aborted && buffer.trim()) {
          const event = parseNormalizeEvent(buffer.replaceAll("\r\n", "\n"));
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
        "/api/normalizer",
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
        { text: "[0.00s] normalizer pipeline started with 6 messages", tone: "default" },
        { text: "[0.00s] steps: detect → parse → emit", tone: "default" },
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
    snapshot?.status ?? (runId ? "normalizing" : "idle");

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
    if (effectiveStatus === "normalizing" && highlights.activeStep) {
      const label = STEPS.find((s) => s.id === highlights.activeStep)?.label ?? highlights.activeStep;
      return `Normalizer pipeline: running ${label} step.`;
    }
    if (effectiveStatus === "done") {
      return `Pipeline complete: ${snapshot?.successCount ?? 0} normalized, ${snapshot?.failCount ?? 0} failed.`;
    }
    return "Normalizer pipeline: detect format → parse to canonical → emit results.";
  }, [effectiveStatus, highlights.activeStep, snapshot?.successCount, snapshot?.failCount]);

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
                Normalize
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
            {statusExplanation(effectiveStatus, highlights.activeStep)}
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
              <span className="text-gray-900">Active Step</span>
              <code className="font-mono text-gray-1000">
                {highlights.activeStep ?? (effectiveStatus === "done" ? "complete" : "-")}
              </code>
            </div>
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">Results</span>
              <span className="font-mono text-gray-1000">
                {snapshot?.status === "done"
                  ? `${snapshot.successCount} normalized / ${snapshot.failCount} failed`
                  : "-"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <NormalizerPipelineGraph activeStep={highlights.activeStep} status={effectiveStatus} />
        <RawInputCards messages={snapshot?.messages ?? null} />
      </div>

      <CanonicalOutputTable messages={snapshot?.messages ?? null} />

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

      <NormalizerCodeWorkbench
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

function NormalizerPipelineGraph({
  activeStep,
  status,
}: {
  activeStep: StepId | null;
  status: RunStatus | "idle";
}) {
  const nodes: Array<{ id: StepId; x: number; y: number; short: string; label: string }> = [
    { id: "detect", x: 60, y: 128, short: "DT", label: "Detect" },
    { id: "parse", x: 160, y: 128, short: "PR", label: "Parse" },
    { id: "emit", x: 260, y: 128, short: "EM", label: "Emit" },
  ];

  const stepOrder: StepId[] = ["detect", "parse", "emit"];

  function nodeColor(id: StepId): string {
    if (status === "idle") return "var(--color-gray-500)";
    if (status === "done") return "var(--color-green-700)";
    if (!activeStep) return "var(--color-gray-500)";
    const activeIdx = stepOrder.indexOf(activeStep);
    const nodeIdx = stepOrder.indexOf(id);
    if (nodeIdx < activeIdx) return "var(--color-green-700)";
    if (nodeIdx === activeIdx) return "var(--color-amber-700)";
    return "var(--color-gray-500)";
  }

  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Normalizer Pipeline
      </p>

      <svg
        viewBox="0 0 320 200"
        role="img"
        aria-label="Sequential normalizer pipeline: detect, parse, emit"
        className="h-auto w-full"
      >
        <rect x={0} y={0} width={320} height={200} fill="var(--color-background-100)" rx={8} />

        <line x1={10} y1={128} x2={40} y2={128} stroke="var(--color-gray-500)" strokeWidth={2} />
        <polygon points="38,124 44,128 38,132" fill="var(--color-gray-500)" />
        <text x={10} y={108} className="fill-gray-900 font-mono text-xs">Raw</text>

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
                strokeDasharray={activeStep === next.id ? "6 4" : undefined}
                className={activeStep === next.id ? "animate-pulse" : undefined}
              />
              <polygon
                points={`${next.x - 22},124 ${next.x - 16},128 ${next.x - 22},132`}
                fill={color}
              />
            </g>
          );
        })}

        <line x1={280} y1={128} x2={310} y2={128} stroke={status === "done" ? "var(--color-green-700)" : "var(--color-gray-500)"} strokeWidth={2} />
        <polygon points="308,124 314,128 308,132" fill={status === "done" ? "var(--color-green-700)" : "var(--color-gray-500)"} />
        <text x={276} y={108} className="fill-gray-900 font-mono text-xs">Canon</text>

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
                className={activeStep === node.id ? "animate-pulse" : undefined}
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

function RawInputCards({ messages }: { messages: Record<string, MessageAccumulator> | null }) {
  const msgList = messages ? Object.values(messages) : [];

  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Raw Inputs
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {msgList.length === 0
          ? SAMPLE_MESSAGE_IDS.map((id) => (
              <div key={id} className="rounded-md border border-gray-400/70 bg-background-200 px-2 py-1.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-xs text-gray-1000">{id}</span>
                  <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${formatBadgeColor(SAMPLE_FORMATS[id] ?? null)}`}>
                    {SAMPLE_FORMATS[id] ?? "?"}
                  </span>
                </div>
              </div>
            ))
          : msgList.map((msg) => (
              <div key={msg.id} className="rounded-md border border-gray-400/70 bg-background-200 px-2 py-1.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-xs text-gray-1000">{msg.id}</span>
                  <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${formatBadgeColor(msg.detectedFormat ?? msg.format)}`}>
                    {msg.detectedFormat ?? msg.format ?? "?"}
                  </span>
                </div>
                {msg.canonical && (
                  <div className="mt-1 text-[10px] text-gray-900">
                    → {msg.canonical.orderId}
                  </div>
                )}
                {msg.error && (
                  <div className="mt-1 text-[10px] text-red-700">
                    {msg.error}
                  </div>
                )}
              </div>
            ))}
      </div>
    </div>
  );
}

function CanonicalOutputTable({ messages }: { messages: Record<string, MessageAccumulator> | null }) {
  const canonicals = messages
    ? Object.values(messages).filter((m) => m.canonical !== null)
    : [];

  if (canonicals.length === 0) return null;

  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Canonical Output
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-400/70">
              <th className="px-2 py-1 text-left font-semibold text-gray-900">Order ID</th>
              <th className="px-2 py-1 text-left font-semibold text-gray-900">Customer</th>
              <th className="px-2 py-1 text-right font-semibold text-gray-900">Amount</th>
              <th className="px-2 py-1 text-center font-semibold text-gray-900">Currency</th>
              <th className="px-2 py-1 text-center font-semibold text-gray-900">Source</th>
            </tr>
          </thead>
          <tbody>
            {canonicals.map((msg) => {
              const c = msg.canonical!;
              return (
                <tr key={msg.id} className="border-b border-gray-400/30">
                  <td className="px-2 py-1 font-mono text-gray-1000">{c.orderId}</td>
                  <td className="px-2 py-1 text-gray-1000">{c.customer}</td>
                  <td className="px-2 py-1 text-right font-mono text-gray-1000">{c.amount.toFixed(2)}</td>
                  <td className="px-2 py-1 text-center font-mono text-gray-1000">{c.currency}</td>
                  <td className="px-2 py-1 text-center">
                    <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${formatBadgeColor(c.sourceFormat)}`}>
                      {c.sourceFormat}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
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
  if (status === "normalizing") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        normalizing
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-900">
      idle
    </span>
  );
}
