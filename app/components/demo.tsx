"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  SagaCodeWorkbench,
  type GutterMarkKind,
  type HighlightTone,
} from "./saga-code-workbench";

type RunStatus = "running" | "rolling_back" | "rolled_back" | "completed";
type StepState =
  | "scheduled"
  | "running"
  | "succeeded"
  | "failed"
  | "skipped"
  | "queued"
  | "compensating"
  | "compensated";

type FailureMode = "none" | "step1" | "step2" | "step3";

type ForwardStepSnapshot = {
  id: string;
  label: string;
  state: StepState;
  order: number;
};

type CompensationSnapshot = {
  id: string;
  label: string;
  forStepId: string;
  forStepLabel: string;
  state: StepState;
  stackPosition: number;
};

type SagaSnapshot = {
  status: RunStatus;
  isTerminal: boolean;
  forwardSteps: ForwardStepSnapshot[];
  compensationStack: CompensationSnapshot[];
  failedStep: number | null;
};

type SagaEvent =
  | { type: "step_running"; step: string; label: string }
  | { type: "step_succeeded"; step: string; label: string }
  | { type: "step_failed"; step: string; label: string; error: string }
  | { type: "step_skipped"; step: string; label: string }
  | { type: "compensation_pushed"; action: string; forStep: string }
  | { type: "rolling_back"; failedStep: number }
  | { type: "compensating"; action: string }
  | { type: "compensated"; action: string }
  | { type: "done"; status: "completed" | "rolled_back" };

type ExecutionLogTone = "info" | "warn" | "success";

type ExecutionLogEntry = {
  id: string;
  tone: ExecutionLogTone;
  message: string;
  elapsedMs: number;
};

export type SagaOrchestratorLineMap = {
  reserveSeatsAwait: number[];
  reserveSeatsPush: number[];
  captureInvoiceAwait: number[];
  captureInvoicePush: number[];
  provisionSeatsAwait: number[];
  sendConfirmationAwait: number[];
  fatalErrorGuard: number[];
  rollbackLoop: number[];
  rollbackPop: number[];
  rollbackRun: number[];
  returnCompleted: number[];
  returnRolledBack: number[];
};

export type SagaStepLineMap = {
  shouldFailCheck: number[];
  throwFatal: number[];
  returnProvisioned: number[];
};

export type SagaCodeHighlightState = {
  caption: string;
  orchestratorActiveLines: Set<number>;
  stepActiveLines: Set<number>;
  orchestratorGutterMarks: Set<number>;
  stepGutterMarks: Set<number>;
};

const FORWARD_PLACEHOLDER: ForwardStepSnapshot[] = [
  { id: "reserveSeats", label: "Reserve seats", state: "scheduled", order: 1 },
  { id: "captureInvoice", label: "Capture invoice", state: "scheduled", order: 2 },
  { id: "provisionSeats", label: "Provision seats", state: "scheduled", order: 3 },
  { id: "sendConfirmation", label: "Send confirmation", state: "scheduled", order: 4 },
];

const STEP_ORDER: Record<string, number> = {
  reserveSeats: 1,
  captureInvoice: 2,
  provisionSeats: 3,
  sendConfirmation: 4,
};

const COMPENSATION_LABELS: Record<string, { label: string; forStepId: string; forStepLabel: string }> = {
  releaseSeats: { label: "Release seats", forStepId: "reserveSeats", forStepLabel: "Reserve seats" },
  refundInvoice: { label: "Refund invoice", forStepId: "captureInvoice", forStepLabel: "Capture invoice" },
  deprovisionSeats: { label: "Deprovision seats", forStepId: "provisionSeats", forStepLabel: "Provision seats" },
};

export const SAGA_DEMO_DEFAULTS = {
  accountId: "acct_acme",
  seats: 5,
  failureMode: "step3",
} as const satisfies {
  accountId: string;
  seats: number;
  failureMode: FailureMode;
};

const FAILURE_MODE_OPTIONS: Array<{ value: FailureMode; label: string }> = [
  { value: "step1", label: "Step 1 - Reserve seats" },
  { value: "step2", label: "Step 2 - Capture invoice" },
  { value: "step3", label: "Step 3 - Provision seats" },
  { value: "none", label: "No failure" },
];

const FAILURE_MODE_TO_STEP: Record<FailureMode, 1 | 2 | 3 | null> = {
  none: null,
  step1: 1,
  step2: 2,
  step3: 3,
};

export function mapFailureModeToStep(failureMode: FailureMode): 1 | 2 | 3 | null {
  return FAILURE_MODE_TO_STEP[failureMode];
}

const WORKFLOW_LABEL = `"use ${"workflow"}"`;
const STEP_LABEL = `"use ${"step"}"`;
const MAX_LOG_ENTRIES = 40;

const FORWARD_STEP_LINE_KEYS: Record<
  string,
  {
    active: keyof SagaOrchestratorLineMap;
    done: Array<keyof SagaOrchestratorLineMap>;
  }
> = {
  reserveSeats: {
    active: "reserveSeatsAwait",
    done: ["reserveSeatsAwait", "reserveSeatsPush"],
  },
  captureInvoice: {
    active: "captureInvoiceAwait",
    done: ["captureInvoiceAwait", "captureInvoicePush"],
  },
  provisionSeats: {
    active: "provisionSeatsAwait",
    done: ["provisionSeatsAwait"],
  },
  sendConfirmation: {
    active: "sendConfirmationAwait",
    done: ["sendConfirmationAwait"],
  },
};

function addLines(target: Set<number>, lines: number[]): void {
  for (const line of lines) {
    target.add(line);
  }
}

function lineSetToArray(lines: Set<number>): number[] {
  return Array.from(lines).sort((a, b) => a - b);
}

function lineSetToGutterMarks(
  lines: Set<number>,
  kind: GutterMarkKind = "success"
): Record<number, GutterMarkKind> {
  const marks: Record<number, GutterMarkKind> = {};
  for (const line of lines) {
    marks[line] = kind;
  }
  return marks;
}

function mapSagaStatusToHighlightTone(snapshot: SagaSnapshot | null): HighlightTone {
  if (!snapshot) return "amber";

  switch (snapshot.status) {
    case "completed":
      return "green";
    case "rolling_back":
    case "rolled_back":
      return "red";
    case "running":
      return snapshot.failedStep ? "red" : "amber";
  }
}

export function getSagaCodeHighlightState(input: {
  snapshot: SagaSnapshot | null;
  orchestratorLineMap: SagaOrchestratorLineMap;
  stepLineMap: SagaStepLineMap;
}): SagaCodeHighlightState {
  const { snapshot, orchestratorLineMap, stepLineMap } = input;

  const orchestratorActiveLines = new Set<number>();
  const stepActiveLines = new Set<number>();
  const orchestratorGutterMarks = new Set<number>();
  const stepGutterMarks = new Set<number>();

  if (!snapshot) {
    return {
      caption: "Start a run to trace forward execution and compensation unwind.",
      orchestratorActiveLines,
      stepActiveLines,
      orchestratorGutterMarks,
      stepGutterMarks,
    };
  }

  for (const step of snapshot.forwardSteps) {
    const lineKey = FORWARD_STEP_LINE_KEYS[step.id];
    if (!lineKey) continue;

    if (step.state === "succeeded") {
      for (const key of lineKey.done) {
        addLines(orchestratorGutterMarks, orchestratorLineMap[key]);
      }
    }

    if (step.state === "running") {
      addLines(orchestratorActiveLines, orchestratorLineMap[lineKey.active]);
    }
  }

  const provisionStep = snapshot.forwardSteps.find((step) => step.id === "provisionSeats");
  const failedForwardStep = snapshot.forwardSteps.find((step) => step.state === "failed");

  if (provisionStep?.state === "succeeded") {
    addLines(stepGutterMarks, stepLineMap.returnProvisioned);
  }

  if (failedForwardStep) {
    const failedStepLineKey = FORWARD_STEP_LINE_KEYS[failedForwardStep.id];
    if (failedStepLineKey) {
      addLines(orchestratorActiveLines, orchestratorLineMap[failedStepLineKey.active]);
    }
    addLines(orchestratorActiveLines, orchestratorLineMap.fatalErrorGuard);
    addLines(stepActiveLines, stepLineMap.shouldFailCheck);
    addLines(stepActiveLines, stepLineMap.throwFatal);
  }

  const hasCompensations = snapshot.compensationStack.length > 0;
  const compensationIsRunning = snapshot.compensationStack.some(
    (step) => step.state === "compensating"
  );
  const compensationDoneCount = snapshot.compensationStack.filter(
    (step) => step.state === "compensated"
  ).length;

  if (compensationDoneCount > 0) {
    addLines(orchestratorGutterMarks, orchestratorLineMap.rollbackPop);
    addLines(orchestratorGutterMarks, orchestratorLineMap.rollbackRun);
  }

  if (snapshot.status === "rolling_back") {
    addLines(orchestratorActiveLines, orchestratorLineMap.fatalErrorGuard);
    addLines(orchestratorActiveLines, orchestratorLineMap.rollbackLoop);

    if (hasCompensations && compensationIsRunning) {
      addLines(orchestratorActiveLines, orchestratorLineMap.rollbackPop);
      addLines(orchestratorActiveLines, orchestratorLineMap.rollbackRun);
    }
  }

  if (snapshot.status === "rolled_back") {
    addLines(orchestratorGutterMarks, orchestratorLineMap.fatalErrorGuard);
    addLines(orchestratorGutterMarks, orchestratorLineMap.rollbackLoop);
    addLines(orchestratorGutterMarks, orchestratorLineMap.rollbackPop);
    addLines(orchestratorGutterMarks, orchestratorLineMap.rollbackRun);
    addLines(orchestratorGutterMarks, orchestratorLineMap.returnRolledBack);
  }

  if (snapshot.status === "completed") {
    addLines(orchestratorGutterMarks, orchestratorLineMap.sendConfirmationAwait);
    addLines(orchestratorGutterMarks, orchestratorLineMap.returnCompleted);
  }

  let caption = "Forward execution in progress.";

  if (snapshot.status === "running") {
    const runningStep = snapshot.forwardSteps.find((step) => step.state === "running");
    if (runningStep) {
      caption = `${runningStep.label} is currently executing.`;
    }

    if (failedForwardStep) {
      caption = "FatalError -> triggers compensation stack unwind (LIFO).";
    }
  }

  if (snapshot.status === "rolling_back" || snapshot.status === "rolled_back") {
    caption = "FatalError -> triggers compensation stack unwind (LIFO).";
  }

  if (snapshot.status === "completed") {
    caption = "No FatalError occurred. Saga completed without compensation.";
  }

  return {
    caption,
    orchestratorActiveLines,
    stepActiveLines,
    orchestratorGutterMarks,
    stepGutterMarks,
  };
}

// --- SSE accumulator ---

type Accumulator = {
  status: RunStatus;
  isTerminal: boolean;
  forwardSteps: Map<string, ForwardStepSnapshot>;
  compensationStack: CompensationSnapshot[];
  compensationActions: Set<string>;
  failedStep: number | null;
};

function createAccumulator(): Accumulator {
  const forwardSteps = new Map<string, ForwardStepSnapshot>();
  for (const s of FORWARD_PLACEHOLDER) {
    forwardSteps.set(s.id, { ...s });
  }
  return {
    status: "running",
    isTerminal: false,
    forwardSteps,
    compensationStack: [],
    compensationActions: new Set(),
    failedStep: null,
  };
}

function applyEvent(acc: Accumulator, event: SagaEvent): void {
  switch (event.type) {
    case "step_running": {
      const step = acc.forwardSteps.get(event.step);
      if (step) step.state = "running";
      break;
    }
    case "step_succeeded": {
      const step = acc.forwardSteps.get(event.step);
      if (step) step.state = "succeeded";
      break;
    }
    case "step_failed": {
      const step = acc.forwardSteps.get(event.step);
      if (step) step.state = "failed";
      acc.failedStep = STEP_ORDER[event.step] ?? null;
      acc.status = "rolling_back";
      break;
    }
    case "step_skipped": {
      const step = acc.forwardSteps.get(event.step);
      if (step) step.state = "skipped";
      break;
    }
    case "compensation_pushed": {
      const meta = COMPENSATION_LABELS[event.action];
      if (meta && !acc.compensationActions.has(event.action)) {
        acc.compensationActions.add(event.action);
        acc.compensationStack.unshift({
          id: event.action,
          label: meta.label,
          forStepId: meta.forStepId,
          forStepLabel: meta.forStepLabel,
          state: "queued",
          stackPosition: acc.compensationStack.length + 1,
        });
        // Re-number stack positions (top = highest number)
        for (let i = 0; i < acc.compensationStack.length; i++) {
          acc.compensationStack[i].stackPosition = acc.compensationStack.length - i;
        }
      }
      break;
    }
    case "rolling_back": {
      acc.status = "rolling_back";
      acc.failedStep = event.failedStep;
      break;
    }
    case "compensating": {
      const comp = acc.compensationStack.find((c) => c.id === event.action);
      if (comp) comp.state = "compensating";
      acc.status = "rolling_back";
      break;
    }
    case "compensated": {
      const comp = acc.compensationStack.find((c) => c.id === event.action);
      if (comp) comp.state = "compensated";
      break;
    }
    case "done": {
      acc.status = event.status;
      acc.isTerminal = true;
      break;
    }
  }
}

function toSnapshot(acc: Accumulator): SagaSnapshot {
  return {
    status: acc.status,
    isTerminal: acc.isTerminal,
    forwardSteps: Array.from(acc.forwardSteps.values()).sort((a, b) => a.order - b.order),
    compensationStack: [...acc.compensationStack],
    failedStep: acc.failedStep,
  };
}

// --- SSE parser ---

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

// --- Component ---

export function SagaDemo({
  orchestratorCode,
  orchestratorHtmlLines,
  orchestratorLineMap,
  stepCode,
  stepHtmlLines,
  stepLineMap,
}: {
  orchestratorCode: string;
  orchestratorHtmlLines: string[];
  orchestratorLineMap: SagaOrchestratorLineMap;
  stepCode: string;
  stepHtmlLines: string[];
  stepLineMap: SagaStepLineMap;
}) {
  const [failureMode, setFailureMode] = useState<FailureMode>(
    SAGA_DEMO_DEFAULTS.failureMode
  );

  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SagaSnapshot | null>(null);
  const [executionLog, setExecutionLog] = useState<ExecutionLogEntry[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const logScrollRef = useRef<HTMLDivElement | null>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const hasScrolledRef = useRef(false);
  const startTimeRef = useRef<number>(0);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const appendLog = useCallback(
    (tone: ExecutionLogTone, message: string, ms: number) => {
      const entry: ExecutionLogEntry = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        tone,
        message,
        elapsedMs: ms,
      };

      setExecutionLog((previous) => {
        const next = [...previous, entry];
        return next.slice(-MAX_LOG_ENTRIES);
      });
    },
    []
  );

  useEffect(() => {
    const logElement = logScrollRef.current;
    if (!logElement) return;
    logElement.scrollTop = logElement.scrollHeight;
  }, [executionLog.length]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, []);

  const elapsed = useCallback(() => {
    return startTimeRef.current ? Date.now() - startTimeRef.current : 0;
  }, []);

  const startTicker = useCallback(() => {
    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 50);
  }, []);

  const stopTicker = useCallback(() => {
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    setElapsedMs(Date.now() - startTimeRef.current);
  }, []);

  const connectSse = useCallback(
    async (targetRunId: string, signal: AbortSignal) => {
      const acc = createAccumulator();

      const processEvent = (event: SagaEvent) => {
        const ms = elapsed();

        // Log the event
        switch (event.type) {
          case "step_running":
            appendLog("info", `${event.label} running`, ms);
            break;
          case "step_succeeded":
            appendLog("success", `${event.label} succeeded`, ms);
            break;
          case "step_failed":
            appendLog("warn", `${event.label} failed with FatalError`, ms);
            break;
          case "step_skipped":
            appendLog("info", `${event.label} skipped`, ms);
            break;
          case "compensation_pushed":
            break;
          case "rolling_back":
            appendLog("warn", `Rolling back from step ${event.failedStep}`, ms);
            break;
          case "compensating":
            appendLog("warn", `${COMPENSATION_LABELS[event.action]?.label ?? event.action} compensating`, ms);
            break;
          case "compensated":
            appendLog("success", `${COMPENSATION_LABELS[event.action]?.label ?? event.action} compensated`, ms);
            break;
          case "done":
            appendLog(
              event.status === "completed" ? "success" : "warn",
              `Status -> ${event.status}`,
              ms
            );
            break;
        }

        applyEvent(acc, event);
        setSnapshot(toSnapshot(acc));
      };

      try {
        const res = await fetch(`/api/readable/${encodeURIComponent(targetRunId)}`, { signal });
        if (!res.ok || !res.body) {
          setError("Stream unavailable");
          return;
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
            if (parsed && typeof parsed === "object" && "type" in parsed) {
              processEvent(parsed as SagaEvent);
            }
          }
        }

        // Process remaining buffer
        if (buffer.trim()) {
          const parsed = parseSseChunk(buffer);
          if (parsed && typeof parsed === "object" && "type" in parsed) {
            processEvent(parsed as SagaEvent);
          }
        }
      } catch (err) {
        if (signal.aborted) return;
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Stream failed");
      } finally {
        stopTicker();
      }
    },
    [appendLog, elapsed, stopTicker]
  );

  const handleStart = async () => {
    setError(null);
    setExecutionLog([]);
    setSnapshot(null);
    setElapsedMs(0);
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setIsStarting(true);

    const signal = abortRef.current.signal;

    try {
      const res = await fetch("/api/saga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: SAGA_DEMO_DEFAULTS.accountId,
          seats: SAGA_DEMO_DEFAULTS.seats,
          failAtStep: mapFailureModeToStep(failureMode),
        }),
        signal,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? "Start failed");
        setIsStarting(false);
        return;
      }

      if (signal.aborted) return;

      setRunId(data.runId);
      setIsStarting(false);
      startTimeRef.current = Date.now();
      startTicker();

      appendLog("info", `Run started for ${SAGA_DEMO_DEFAULTS.accountId} with ${SAGA_DEMO_DEFAULTS.seats} seats.`, 0);

      connectSse(data.runId, signal);
    } catch (startError) {
      if (signal.aborted) return;
      if (startError instanceof Error && startError.name === "AbortError") return;
      setError(startError instanceof Error ? startError.message : "Start failed");
      setIsStarting(false);
    }
  };

  const handleReset = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (tickerRef.current) {
      clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
    startTimeRef.current = 0;
    setRunId(null);
    setSnapshot(null);
    setExecutionLog([]);
    setError(null);
    setElapsedMs(0);
    setFailureMode(SAGA_DEMO_DEFAULTS.failureMode);
    setIsStarting(false);
    setTimeout(() => {
      startButtonRef.current?.focus();
    }, 0);
  };

  const isActiveRun = Boolean(runId) && snapshot !== null && !snapshot.isTerminal;
  const isLocked = isStarting || isActiveRun;

  const forwardSteps = snapshot?.forwardSteps ?? FORWARD_PLACEHOLDER;
  const compensationStack = snapshot?.compensationStack ?? [];

  const rollbackLabel = useMemo(() => {
    if (!snapshot) return "Waiting to start";

    switch (snapshot.status) {
      case "running":
        if (snapshot.failedStep) {
          return `FatalError thrown at step ${snapshot.failedStep}. Preparing rollback.`;
        }
        return "Forward execution in progress. Compensation stack is being built.";
      case "rolling_back":
        return `Rollback in progress. Unwinding stack in LIFO order after step ${snapshot.failedStep}.`;
      case "rolled_back":
        return "Rollback complete. Invoice refunded and seats released in reverse order.";
      case "completed":
        return "Upgrade completed. No rollback was needed.";
    }
  }, [snapshot]);

  const highlightState = useMemo(
    () =>
      getSagaCodeHighlightState({
        snapshot,
        orchestratorLineMap,
        stepLineMap,
      }),
    [snapshot, orchestratorLineMap, stepLineMap]
  );
  const workbenchTone = useMemo(
    () => mapSagaStatusToHighlightTone(snapshot),
    [snapshot]
  );

  return (
    <div className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-700/40 bg-red-700/10 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      <StepCard step={1} title="Run Saga" state={snapshot ? "done" : "active"}>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            ref={startButtonRef}
            onClick={handleStart}
            disabled={isLocked}
            className="cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-700/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isStarting ? "Starting..." : "Run Saga"}
          </button>

          <div className="inline-flex items-center gap-2 rounded-md border border-gray-400 bg-background-100 px-2.5 py-1.5">
            <label
              htmlFor="failureMode"
              className="shrink-0 text-xs font-medium text-gray-900"
            >
              Fail at
            </label>
            <select
              id="failureMode"
              value={failureMode}
              onChange={(event) => setFailureMode(event.target.value as FailureMode)}
              disabled={isLocked}
              className="rounded border border-gray-400 bg-background-100 px-2 py-1 font-mono text-xs text-gray-1000 transition-colors focus:border-gray-300 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-700/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {FAILURE_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleReset}
            disabled={isStarting}
            className="cursor-pointer rounded-md border border-gray-400 px-4 py-2 text-sm text-gray-900 transition-colors hover:border-gray-300 hover:text-gray-1000 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-700/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset
          </button>

          <div className="ml-auto flex items-center gap-3" role="status" aria-live="polite">
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 font-mono text-xs ${statusPillClass(
                snapshot?.status ?? "running"
              )}`}
            >
              {snapshot?.status ?? "idle"}
            </span>
            <span className="text-sm text-gray-900 tabular-nums">
              elapsed {elapsedMs}ms
            </span>
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-900">
          Defaults: <span className="font-mono">{SAGA_DEMO_DEFAULTS.accountId}</span>{" "}
          with <span className="font-mono">{SAGA_DEMO_DEFAULTS.seats}</span> seats.
        </p>
      </StepCard>

      <StepCard
        step={2}
        title="Forward Execution + Compensation Stack"
        state={!snapshot ? "pending" : snapshot.isTerminal ? "done" : "active"}
      >
        <p className="mb-4 text-sm text-gray-900" role="status" aria-live="polite">
          {rollbackLabel}
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-md border border-gray-400/60 bg-background-100/50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-1000">Forward steps</h3>
            <ul className="space-y-2" role="list">
              {forwardSteps.map((step) => (
                <li
                  key={step.id}
                  className="flex items-center justify-between rounded border border-gray-400/40 px-3 py-2"
                >
                  <span className="text-sm text-gray-1000">
                    <span className="mr-2 font-mono text-gray-900">{step.order}.</span>
                    {step.label}
                  </span>
                  <StatePill state={step.state} />
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-md border border-gray-400/60 bg-background-100/50 p-4">
            <h3 className="mb-1 text-sm font-semibold text-gray-1000">
              Compensation stack (top executes first)
            </h3>
            <p className="mb-3 text-xs text-gray-900">
              Handlers are pushed as forward steps succeed. FatalError unwinds in reverse order.
            </p>
            {compensationStack.length === 0 ? (
              <p className="rounded border border-gray-400/40 px-3 py-2 text-sm text-gray-900">
                No compensation handlers queued yet.
              </p>
            ) : (
              <ul className="space-y-2" role="list">
                {compensationStack.map((step) => (
                  <li
                    key={`${step.id}-${step.stackPosition}`}
                    className="flex items-center justify-between rounded border border-gray-400/40 px-3 py-2"
                  >
                    <div className="text-sm text-gray-1000">
                      <div>{step.label}</div>
                      <div className="font-mono text-xs text-gray-900">
                        compensates {step.forStepId}
                      </div>
                    </div>
                    <StatePill state={step.state} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </StepCard>

      <StepCard
        step={3}
        title="Execution Log"
        state={!snapshot ? "pending" : snapshot.isTerminal ? "done" : "active"}
      >
        <div
          ref={logScrollRef}
          tabIndex={0}
          className="max-h-[240px] overflow-y-auto rounded-md border border-gray-300 bg-background-100"
          role="log"
          aria-live="polite"
          aria-label="Saga execution log"
        >
          {executionLog.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-900">
              Start a run to stream step-by-step execution updates.
            </p>
          ) : (
            <ul className="divide-y divide-gray-300" role="list">
              {executionLog.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <span className={`text-sm ${logTextClass(entry.tone)}`}>{entry.message}</span>
                  <span className="shrink-0 font-mono text-xs text-gray-900 tabular-nums">
                    +{entry.elapsedMs}ms
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </StepCard>

      <p className="text-center text-xs italic text-gray-900">{highlightState.caption}</p>

      <SagaCodeWorkbench
        leftPane={{
          filename: "workflows/upgrade-seats-saga.ts",
          label: WORKFLOW_LABEL,
          code: orchestratorCode,
          htmlLines: orchestratorHtmlLines,
          activeLines: lineSetToArray(highlightState.orchestratorActiveLines),
          gutterMarks: lineSetToGutterMarks(highlightState.orchestratorGutterMarks),
          tone: workbenchTone,
        }}
        rightPane={{
          filename: "workflows/provision-seats.step.ts",
          label: STEP_LABEL,
          code: stepCode,
          htmlLines: stepHtmlLines,
          activeLines: lineSetToArray(highlightState.stepActiveLines),
          gutterMarks: lineSetToGutterMarks(highlightState.stepGutterMarks),
          tone: workbenchTone,
        }}
      />
    </div>
  );
}

type CardState = "active" | "done" | "pending";

function StepCard({
  step,
  title,
  state,
  children,
}: {
  step: number;
  title: string;
  state: CardState;
  children: ReactNode;
}) {
  return (
    <div
      className={`relative rounded-lg border px-5 pb-5 pt-8 transition-colors ${
        state === "pending"
          ? "border-gray-400/40 opacity-50"
          : state === "done"
            ? "border-gray-400/40"
            : "border-gray-400"
      }`}
    >
      <div className="absolute -top-3 left-4 flex items-center gap-2.5 bg-background-200 px-2">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
            state === "done"
              ? "bg-green-700 text-white"
              : state === "active"
                ? "bg-violet-700 text-white"
                : "bg-gray-900 text-background-100"
          }`}
        >
          {state === "done" ? (
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            step
          )}
        </span>
        <span className="text-sm font-medium text-gray-1000">{title}</span>
      </div>
      {children}
    </div>
  );
}

function statusPillClass(status: RunStatus): string {
  switch (status) {
    case "running":
      return "border border-amber-700/40 bg-amber-700/20 text-amber-700";
    case "rolling_back":
      return "border border-red-700/40 bg-red-700/10 text-red-700";
    case "rolled_back":
      return "border border-red-700/30 bg-red-700/10 text-red-700";
    case "completed":
      return "border border-green-700/40 bg-green-700/20 text-green-700";
  }
}

function StatePill({ state }: { state: StepState }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-xs tabular-nums ${stateBadgeClass(
        state
      )}`}
    >
      {state}
    </span>
  );
}

function stateBadgeClass(state: StepState): string {
  switch (state) {
    case "scheduled":
      return "border-gray-500/60 bg-gray-500/10 text-gray-900";
    case "running":
      return "border-amber-700/50 bg-amber-700/20 text-amber-700";
    case "succeeded":
      return "border-green-700/50 bg-green-700/20 text-green-700";
    case "failed":
      return "border-red-700/50 bg-red-700/10 text-red-700";
    case "skipped":
      return "border-gray-500/60 bg-gray-500/10 text-gray-900";
    case "queued":
      return "border-blue-700/50 bg-blue-700/10 text-blue-700";
    case "compensating":
      return "border-red-700/50 bg-red-700/10 text-red-700";
    case "compensated":
      return "border-green-700/50 bg-green-700/20 text-green-700";
  }
}

function logTextClass(tone: ExecutionLogTone): string {
  switch (tone) {
    case "info":
      return "text-gray-900";
    case "warn":
      return "text-amber-700";
    case "success":
      return "text-green-700";
  }
}
