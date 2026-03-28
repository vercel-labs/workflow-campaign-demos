// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  OutboxCodeWorkbench,
  type GutterMarkKind,
  type HighlightTone,
} from "@/transactional-outbox/app/components/outbox-code-workbench";
import type { OutboxEvent } from "@/transactional-outbox/workflows/transactional-outbox";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type OutboxStepId = "persist" | "relay" | "publish" | "mark_sent";

type OutboxPhase =
  | "idle"
  | "persisting"
  | "persisted"
  | "relaying"
  | "published"
  | "marking_sent"
  | "confirmed"
  | "done";

type StepStatus = "pending" | "running" | "done";

type StepSnapshot = {
  id: OutboxStepId;
  label: string;
  status: StepStatus;
};

type OutboxSnapshot = {
  runId: string;
  orderId: string;
  phase: OutboxPhase;
  outboxId: string | null;
  brokerId: string | null;
  elapsedMs: number;
  steps: StepSnapshot[];
};

type OutboxAccumulator = {
  runId: string;
  orderId: string;
  phase: OutboxPhase;
  outboxId: string | null;
  brokerId: string | null;
};

type StartResponse = {
  runId: string;
  orderId: string;
  status: string;
};

type WorkflowLineMap = {
  persistCall: number[];
  relayCall: number[];
  publishCall: number[];
  markSentCall: number[];
};

type StepLineMap = Record<OutboxStepId, number[]>;

type DemoProps = {
  workflowCode: string;
  workflowLinesHtml: string[];
  stepCode: string;
  stepLinesHtml: string[];
  workflowLineMap: WorkflowLineMap;
  stepLineMap: StepLineMap;
};

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const ELAPSED_TICK_MS = 120;

const STEP_DEFINITIONS: Array<{ id: OutboxStepId; label: string }> = [
  { id: "persist", label: "Persist Order" },
  { id: "relay", label: "Poll Relay" },
  { id: "publish", label: "Publish Event" },
  { id: "mark_sent", label: "Mark Sent" },
];

const PHASE_TO_STEP: Partial<Record<OutboxPhase, OutboxStepId>> = {
  persisting: "persist",
  persisted: "persist",
  relaying: "relay",
  published: "relay",
  marking_sent: "publish",
  confirmed: "publish",
  done: "mark_sent",
};

const PHASE_RUNNING_STEP: Partial<Record<OutboxPhase, OutboxStepId>> = {
  persisting: "persist",
  relaying: "relay",
  marking_sent: "publish",
  done: "mark_sent",
};

const WORKFLOW_LINE_FOR_PHASE: Record<string, keyof WorkflowLineMap> = {
  persisting: "persistCall",
  persisted: "persistCall",
  relaying: "relayCall",
  published: "relayCall",
  marking_sent: "publishCall",
  confirmed: "publishCall",
  done: "markSentCall",
};

/* ------------------------------------------------------------------ */
/*  Pure helpers                                                       */
/* ------------------------------------------------------------------ */

function createAccumulator(start: StartResponse): OutboxAccumulator {
  return {
    runId: start.runId,
    orderId: start.orderId,
    phase: "idle",
    outboxId: null,
    brokerId: null,
  };
}

function applyEvent(
  acc: OutboxAccumulator,
  event: OutboxEvent
): OutboxAccumulator {
  switch (event.type) {
    case "persisting":
      return { ...acc, phase: "persisting" };
    case "persisted":
      return { ...acc, phase: "persisted", outboxId: event.outboxId };
    case "relaying":
      return { ...acc, phase: "relaying" };
    case "published":
      return { ...acc, phase: "published", brokerId: event.brokerId };
    case "marking_sent":
      return { ...acc, phase: "marking_sent" };
    case "confirmed":
      return { ...acc, phase: "confirmed" };
    case "done":
      return {
        ...acc,
        phase: "done",
        outboxId: event.outboxId,
        brokerId: event.brokerId,
      };
    default:
      return acc;
  }
}

function completedSteps(phase: OutboxPhase): Set<OutboxStepId> {
  const done = new Set<OutboxStepId>();
  const order: OutboxStepId[] = ["persist", "relay", "publish", "mark_sent"];
  const phaseOrder: OutboxPhase[] = [
    "persisted",
    "published",
    "confirmed",
    "done",
  ];

  for (let i = 0; i < phaseOrder.length; i++) {
    if (phaseOrder.indexOf(phase) >= i || phase === "done") {
      // Check if we've passed this step's completion phase
    }
  }

  // More precise: map each completion phase to the step it completes
  if (
    phase === "persisted" ||
    phase === "relaying" ||
    phase === "published" ||
    phase === "marking_sent" ||
    phase === "confirmed" ||
    phase === "done"
  ) {
    done.add("persist");
  }
  if (
    phase === "published" ||
    phase === "marking_sent" ||
    phase === "confirmed" ||
    phase === "done"
  ) {
    done.add("relay");
  }
  if (phase === "confirmed" || phase === "done") {
    done.add("publish");
  }
  if (phase === "done") {
    done.add("mark_sent");
  }

  return done;
}

function toSnapshot(
  acc: OutboxAccumulator,
  startedAtMs: number
): OutboxSnapshot {
  const done = completedSteps(acc.phase);
  const runningStep = PHASE_RUNNING_STEP[acc.phase] ?? null;

  const steps: StepSnapshot[] = STEP_DEFINITIONS.map((def) => ({
    id: def.id,
    label: def.label,
    status: done.has(def.id)
      ? "done"
      : runningStep === def.id
        ? "running"
        : "pending",
  }));

  return {
    runId: acc.runId,
    orderId: acc.orderId,
    phase: acc.phase,
    outboxId: acc.outboxId,
    brokerId: acc.brokerId,
    elapsedMs: Math.max(0, Date.now() - startedAtMs),
    steps,
  };
}

function parseSseChunk(chunk: string): OutboxEvent | null {
  const payload = chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as OutboxEvent;
  } catch {
    return null;
  }
}

function formatElapsedMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function buildExecutionLog(
  snapshot: OutboxSnapshot | null,
  orderId: string
): string[] {
  if (!snapshot) {
    return [
      "Idle: click Start Outbox to begin the workflow.",
      "Steps: persist order → poll relay → publish event → mark sent.",
    ];
  }

  const entries: string[] = [`[0.00s] order ${orderId} queued`];

  const phase = snapshot.phase;

  if (phase === "persisting" || completedSteps(phase).has("persist")) {
    entries.push(
      completedSteps(phase).has("persist")
        ? `[${formatElapsedMs(snapshot.elapsedMs)}] order persisted → outbox: ${snapshot.outboxId}`
        : `[${formatElapsedMs(snapshot.elapsedMs)}] persisting order...`
    );
  }

  if (
    phase === "relaying" ||
    phase === "published" ||
    completedSteps(phase).has("relay")
  ) {
    entries.push(
      completedSteps(phase).has("relay")
        ? `[${formatElapsedMs(snapshot.elapsedMs)}] relay published → broker: ${snapshot.brokerId}`
        : `[${formatElapsedMs(snapshot.elapsedMs)}] relaying to broker...`
    );
  }

  if (
    phase === "marking_sent" ||
    phase === "confirmed" ||
    completedSteps(phase).has("publish")
  ) {
    entries.push(
      completedSteps(phase).has("publish")
        ? `[${formatElapsedMs(snapshot.elapsedMs)}] outbox entry confirmed`
        : `[${formatElapsedMs(snapshot.elapsedMs)}] marking outbox sent...`
    );
  }

  if (phase === "done") {
    entries.push(
      `[${formatElapsedMs(snapshot.elapsedMs)}] workflow complete — all steps confirmed`
    );
  }

  return entries;
}

function buildHighlightState(
  snapshot: OutboxSnapshot | null,
  workflowLineMap: WorkflowLineMap,
  stepLineMap: StepLineMap
): {
  workflowActiveLines: number[];
  stepActiveLines: number[];
  workflowGutterMarks: Record<number, GutterMarkKind>;
  stepGutterMarks: Record<number, GutterMarkKind>;
  tone: HighlightTone;
} {
  const empty = {
    workflowActiveLines: [] as number[],
    stepActiveLines: [] as number[],
    workflowGutterMarks: {} as Record<number, GutterMarkKind>,
    stepGutterMarks: {} as Record<number, GutterMarkKind>,
    tone: "amber" as HighlightTone,
  };

  if (!snapshot || snapshot.phase === "idle") return empty;

  const phase = snapshot.phase;
  const done = completedSteps(phase);
  const workflowGutterMarks: Record<number, GutterMarkKind> = {};
  const stepGutterMarks: Record<number, GutterMarkKind> = {};

  // Mark completed steps with gutter checkmarks
  const stepToWorkflow: Record<OutboxStepId, keyof WorkflowLineMap> = {
    persist: "persistCall",
    relay: "relayCall",
    publish: "publishCall",
    mark_sent: "markSentCall",
  };

  for (const stepId of done) {
    const wfLines = workflowLineMap[stepToWorkflow[stepId]];
    for (const line of wfLines) {
      workflowGutterMarks[line] = "success";
    }
    const sLines = stepLineMap[stepId];
    if (sLines.length > 0) {
      stepGutterMarks[sLines[0]] = "success";
    }
  }

  // Active workflow lines
  const wfKey = WORKFLOW_LINE_FOR_PHASE[phase];
  const workflowActiveLines = wfKey ? workflowLineMap[wfKey] : [];

  // Active step lines
  const activeStep = PHASE_RUNNING_STEP[phase];
  const stepActiveLines = activeStep ? stepLineMap[activeStep] : [];

  // Tone
  let tone: HighlightTone = "amber";
  if (phase === "done") tone = "green";

  return {
    workflowActiveLines,
    stepActiveLines,
    workflowGutterMarks,
    stepGutterMarks,
    tone,
  };
}

/* ------------------------------------------------------------------ */
/*  Pipeline Visualization                                             */
/* ------------------------------------------------------------------ */

const PIPELINE_STAGES: Array<{
  id: string;
  label: string;
  completionPhases: OutboxPhase[];
  activePhases: OutboxPhase[];
}> = [
  {
    id: "pending",
    label: "Pending",
    completionPhases: [],
    activePhases: ["idle"],
  },
  {
    id: "persisted",
    label: "Persisted",
    completionPhases: [
      "persisted",
      "relaying",
      "published",
      "marking_sent",
      "confirmed",
      "done",
    ],
    activePhases: ["persisting"],
  },
  {
    id: "relayed",
    label: "Relayed",
    completionPhases: ["published", "marking_sent", "confirmed", "done"],
    activePhases: ["relaying"],
  },
  {
    id: "published",
    label: "Published",
    completionPhases: ["confirmed", "done"],
    activePhases: ["marking_sent"],
  },
  {
    id: "confirmed",
    label: "Confirmed",
    completionPhases: ["done"],
    activePhases: ["confirmed"],
  },
];

function OutboxPipeline({ phase }: { phase: OutboxPhase }) {
  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Outbox Pipeline
      </p>
      <div className="flex items-center gap-1">
        {PIPELINE_STAGES.map((stage, index) => {
          const isComplete = stage.completionPhases.includes(phase);
          const isActive = stage.activePhases.includes(phase);

          return (
            <div key={stage.id} className="flex items-center gap-1">
              {index > 0 && (
                <svg
                  viewBox="0 0 12 12"
                  className={`h-3 w-3 shrink-0 ${
                    isComplete
                      ? "text-green-700"
                      : isActive
                        ? "text-amber-700"
                        : "text-gray-500/50"
                  }`}
                  aria-hidden="true"
                >
                  <path
                    d="M2 6h8M7 3l3 3-3 3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              <div
                className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isComplete
                    ? "border-green-700/40 bg-green-700/15 text-green-700"
                    : isActive
                      ? "border-amber-700/40 bg-amber-700/15 text-amber-700 animate-pulse"
                      : "border-gray-400/70 bg-background-200 text-gray-900"
                }`}
              >
                {stage.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Status badges                                                      */
/* ------------------------------------------------------------------ */

function PhaseBadge({ phase }: { phase: OutboxPhase }) {
  if (phase === "done") {
    return (
      <span className="rounded-full bg-green-700/20 px-2 py-0.5 text-xs font-medium text-green-700">
        done
      </span>
    );
  }

  if (phase === "idle") {
    return (
      <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-900">
        idle
      </span>
    );
  }

  return (
    <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
      {phase.replace("_", " ")}
    </span>
  );
}

function StepStatusIcon({
  completed,
  active,
}: {
  completed: boolean;
  active: boolean;
}) {
  if (completed) {
    return (
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 text-green-700"
        aria-hidden="true"
      >
        <polyline points="3,8.5 7,12.5 14,4.5" />
      </svg>
    );
  }

  if (active) {
    return (
      <span
        className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-700"
        aria-hidden="true"
      />
    );
  }

  return (
    <span
      className="h-2.5 w-2.5 rounded-full bg-gray-500/70"
      aria-hidden="true"
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Main demo component                                                */
/* ------------------------------------------------------------------ */

export function OutboxDemo({
  workflowCode,
  workflowLinesHtml,
  stepCode,
  stepLinesHtml,
  workflowLineMap,
  stepLineMap,
}: DemoProps) {
  const [orderId, setOrderId] = useState("ORD-1001");
  const [payload, setPayload] = useState("widget x42");
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<OutboxSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const accumulatorRef = useRef<OutboxAccumulator | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);

  const stopElapsedTicker = useCallback(() => {
    if (elapsedRef.current) {
      clearInterval(elapsedRef.current);
      elapsedRef.current = null;
    }
  }, []);

  const startElapsedTicker = useCallback(() => {
    stopElapsedTicker();
    elapsedRef.current = setInterval(() => {
      const startedAtMs = startedAtRef.current;
      if (!startedAtMs) return;

      setSnapshot((prev) => {
        if (!prev || prev.phase === "done") return prev;
        return { ...prev, elapsedMs: Math.max(0, Date.now() - startedAtMs) };
      });
    }, ELAPSED_TICK_MS);
  }, [stopElapsedTicker]);

  useEffect(() => {
    return () => {
      stopElapsedTicker();
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [stopElapsedTicker]);

  const connectToStream = useCallback(
    async (start: StartResponse, signal: AbortSignal) => {
      try {
        const response = await fetch(
          `/api/readable/${encodeURIComponent(start.runId)}`,
          { cache: "no-store", signal }
        );

        if (signal.aborted) return;

        if (!response.ok || !response.body) {
          const data = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(
            data?.error ?? `Stream request failed: ${response.status}`
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const apply = (event: OutboxEvent) => {
          if (signal.aborted || !startedAtRef.current || !accumulatorRef.current)
            return;

          const next = applyEvent(accumulatorRef.current, event);
          accumulatorRef.current = next;
          setSnapshot(toSnapshot(next, startedAtRef.current));

          if (next.phase === "done") {
            stopElapsedTicker();
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.replaceAll("\r\n", "\n").split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const chunk of chunks) {
            if (signal.aborted) return;
            const event = parseSseChunk(chunk);
            if (event) apply(event);
          }
        }

        if (!signal.aborted && buffer.trim()) {
          const event = parseSseChunk(buffer.replaceAll("\r\n", "\n"));
          if (event) apply(event);
        }
      } catch (cause: unknown) {
        if (cause instanceof Error && cause.name === "AbortError") return;
        if (signal.aborted) return;

        setError(
          cause instanceof Error ? cause.message : "Stream connection failed"
        );
        stopElapsedTicker();
      }
    },
    [stopElapsedTicker]
  );

  const handleStart = useCallback(async () => {
    setError(null);
    setSnapshot(null);
    setRunId(null);

    stopElapsedTicker();
    abortRef.current?.abort();
    abortRef.current = null;
    startedAtRef.current = null;
    accumulatorRef.current = null;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/transactional-outbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, payload }),
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? `Start failed: ${response.status}`);
      }

      const data = (await response.json()) as StartResponse;

      if (controller.signal.aborted) return;

      const startedAt = Date.now();
      const acc = createAccumulator(data);
      startedAtRef.current = startedAt;
      accumulatorRef.current = acc;
      setRunId(data.runId);
      setSnapshot(toSnapshot(acc, startedAt));

      startElapsedTicker();
      void connectToStream(data, controller.signal);
    } catch (cause: unknown) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Unknown error");
    }
  }, [orderId, payload, stopElapsedTicker, startElapsedTicker, connectToStream]);

  const handleReset = useCallback(() => {
    stopElapsedTicker();
    abortRef.current?.abort();
    abortRef.current = null;
    startedAtRef.current = null;
    accumulatorRef.current = null;
    setRunId(null);
    setSnapshot(null);
    setError(null);
    setTimeout(() => startButtonRef.current?.focus(), 0);
  }, [stopElapsedTicker]);

  const phase = snapshot?.phase ?? "idle";
  const isRunning = runId !== null && phase !== "done";

  const executionLog = useMemo(
    () => buildExecutionLog(snapshot, orderId),
    [snapshot, orderId]
  );

  const highlights = useMemo(
    () => buildHighlightState(snapshot, workflowLineMap, stepLineMap),
    [snapshot, workflowLineMap, stepLineMap]
  );

  const steps = snapshot?.steps ?? STEP_DEFINITIONS.map((d) => ({ ...d, status: "pending" as const }));

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

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Controls */}
        <div className="space-y-4 rounded-lg border border-gray-400 bg-background-100 p-4">
          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                ref={startButtonRef}
                onClick={() => void handleStart()}
                disabled={isRunning}
                className="cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start Outbox
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

            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="text-xs text-gray-900">
                <span className="mb-1 block font-medium">Order ID</span>
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  disabled={isRunning}
                  className="w-full rounded-md border border-gray-400 bg-background-100 px-2 py-1 font-mono text-xs text-gray-1000 disabled:opacity-50"
                />
              </label>
              <label className="text-xs text-gray-900">
                <span className="mb-1 block font-medium">Payload</span>
                <input
                  type="text"
                  value={payload}
                  onChange={(e) => setPayload(e.target.value)}
                  disabled={isRunning}
                  className="w-full rounded-md border border-gray-400 bg-background-100 px-2 py-1 font-mono text-xs text-gray-1000 disabled:opacity-50"
                />
              </label>
            </div>
          </div>

          <div
            className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2 text-xs text-gray-900"
            role="status"
            aria-live="polite"
          >
            {phase === "idle"
              ? "Ready: click Start Outbox to persist an order and relay it through the outbox."
              : phase === "done"
                ? "Complete: order persisted, relayed, published, and confirmed."
                : `Running: ${phase.replace("_", " ")}...`}
          </div>
        </div>

        {/* Phase & metadata */}
        <div className="space-y-3 rounded-lg border border-gray-400 bg-background-100 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-900">
              Workflow Phase
            </span>
            <PhaseBadge phase={phase} />
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
              <span className="text-gray-900">outboxId</span>
              <code className="font-mono text-xs text-gray-1000">
                {snapshot?.outboxId ?? "—"}
              </code>
            </div>
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">brokerId</span>
              <code className="font-mono text-xs text-gray-1000">
                {snapshot?.brokerId ?? "—"}
              </code>
            </div>
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">Elapsed</span>
              <code className="font-mono text-xs text-gray-1000">
                {snapshot ? formatElapsedMs(snapshot.elapsedMs) : "—"}
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline visualization + step list */}
      <div className="grid gap-4 md:grid-cols-2">
        <OutboxPipeline phase={phase} />

        <div className="rounded-md border border-gray-400 bg-background-100 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-900">
            Step Status
          </p>
          <div className="space-y-2">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`flex items-center justify-between rounded-md border px-3 py-2 transition-colors ${
                  step.status === "done"
                    ? "border-green-700/40 bg-green-700/10"
                    : step.status === "running"
                      ? "border-amber-700/50 bg-amber-700/10"
                      : "border-gray-300 bg-background-100/60 opacity-70"
                }`}
              >
                <div className="flex items-center gap-2">
                  <StepStatusIcon
                    completed={step.status === "done"}
                    active={step.status === "running"}
                  />
                  <span
                    className={`text-xs font-semibold ${
                      step.status === "done"
                        ? "text-green-700"
                        : step.status === "running"
                          ? "text-amber-700"
                          : "text-gray-900"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    step.status === "done"
                      ? "bg-green-700/20 text-green-700"
                      : step.status === "running"
                        ? "bg-amber-700/20 text-amber-700"
                        : "bg-gray-500/10 text-gray-900"
                  }`}
                >
                  {step.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Execution log */}
      <div className="rounded-md border border-gray-400 bg-background-100 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
          Execution Log
        </p>
        <ol className="space-y-1 font-mono text-xs text-gray-900">
          {executionLog.map((entry, index) => (
            <li key={`${entry}-${index}`}>{entry}</li>
          ))}
        </ol>
      </div>

      {/* Code workbench */}
      <OutboxCodeWorkbench
        leftPane={{
          filename: "transactional-outbox.ts",
          label: "workflow",
          code: workflowCode,
          htmlLines: workflowLinesHtml,
          activeLines: highlights.workflowActiveLines,
          gutterMarks: highlights.workflowGutterMarks,
          tone: highlights.tone,
        }}
        rightPane={{
          filename: "transactional-outbox.ts",
          label: "steps",
          code: stepCode,
          htmlLines: stepLinesHtml,
          activeLines: highlights.stepActiveLines,
          gutterMarks: highlights.stepGutterMarks,
          tone: highlights.tone,
        }}
      />
    </div>
  );
}

const demoProps = {
  workflowCode: "",
  workflowLinesHtml: [],
  stepCode: "",
  stepLinesHtml: [],
  workflowLineMap: {},
  stepLineMap: {},
} as unknown as Parameters<typeof OutboxDemo>[0];

export default function TransactionalOutboxNativeDemo() {
  return <OutboxDemo {...demoProps} />;
}
