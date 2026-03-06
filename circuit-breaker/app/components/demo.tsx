"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircuitCodeWorkbench } from "./circuit-code-workbench";

type LifecycleState = "idle" | "running" | "completed" | "failed";
type HighlightTone = "amber" | "cyan" | "green" | "red";

type CircuitStateKind = "closed" | "open" | "half-open";

type CircuitEvent =
  | { type: "request_attempt"; requestNum: number; circuitState: CircuitStateKind }
  | { type: "request_success"; requestNum: number; circuitState: CircuitStateKind }
  | { type: "request_fail"; requestNum: number; circuitState: CircuitStateKind }
  | { type: "circuit_open"; requestNum: number }
  | { type: "cooldown_start"; requestNum: number; cooldownMs: number }
  | { type: "cooldown_end"; requestNum: number }
  | { type: "circuit_half_open"; requestNum: number }
  | { type: "circuit_closed"; requestNum: number }
  | {
      type: "done";
      status: "recovered" | "failed";
      totalRequests: number;
      totalFailures: number;
      circuitOpened: number;
    };

type RequestRuntimeState =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "cooldown";

type RequestSnapshot = {
  requestNum: number;
  state: RequestRuntimeState;
  circuitStateBefore: CircuitStateKind;
  cooldownMs: number;
  remainingCooldownMs: number;
};

type CircuitLogEventKind =
  | "request"
  | "success"
  | "failure"
  | "circuit_open"
  | "cooldown_start"
  | "cooldown_end"
  | "half_open_test"
  | "circuit_closed"
  | "completed"
  | "exhausted";

type CircuitLogEvent = {
  atMs: number;
  requestNum: number;
  kind: CircuitLogEventKind;
  message: string;
};

type CircuitPhaseKind = "request" | "cooldown" | "done";

type CircuitPhase = {
  phase: CircuitPhaseKind;
  requestNum: number | null;
  circuitState: CircuitStateKind;
  cooldownMs: number | null;
};

// Accumulated state from SSE events
type CircuitAccumulator = {
  requests: Map<number, { state: RequestRuntimeState; circuitStateBefore: CircuitStateKind; cooldownMs: number }>;
  currentPhase: CircuitPhase;
  executionLog: CircuitLogEvent[];
  circuitState: CircuitStateKind;
  startMs: number;
  result: {
    totalRequests: number;
    totalFailures: number;
    circuitOpened: number;
    outcome: "recovered" | "failed";
  } | null;
};

type StartResponse = {
  runId: string;
  serviceId: string;
  maxRequests: number;
  failRange: [number, number];
  status: string;
};

type CircuitWorkflowLineMap = {
  callService: number[];
  sleep: number[];
  successReturn: number[];
  failureReturn: number[];
  circuitOpen: number[];
  circuitClosed: number[];
};

type CircuitStepLineMap = {
  callService: number[];
  successReturn: number[];
};

type CircuitBreakerDemoProps = {
  workflowCode: string;
  workflowHtmlLines: string[];
  workflowLineMap: CircuitWorkflowLineMap;
  stepCode: string;
  stepHtmlLines: string[];
  stepLineMap: CircuitStepLineMap;
};

const MAX_REQUESTS = 10;

type FailPreset = {
  label: string;
  range: [number, number] | null;
};

const FAIL_PRESETS: FailPreset[] = [
  { label: "4-6", range: [4, 6] },
  { label: "3-5", range: [3, 5] },
  { label: "None", range: null },
];

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

function createAccumulator(): CircuitAccumulator {
  return {
    requests: new Map(),
    currentPhase: { phase: "request", requestNum: null, circuitState: "closed", cooldownMs: null },
    executionLog: [],
    circuitState: "closed",
    startMs: Date.now(),
    result: null,
  };
}

function applyEvent(acc: CircuitAccumulator, event: CircuitEvent): CircuitAccumulator {
  const elapsedMs = Date.now() - acc.startMs;

  switch (event.type) {
    case "request_attempt": {
      acc.requests.set(event.requestNum, {
        state: "running",
        circuitStateBefore: event.circuitState,
        cooldownMs: 0,
      });
      acc.currentPhase = {
        phase: "request",
        requestNum: event.requestNum,
        circuitState: event.circuitState,
        cooldownMs: null,
      };
      acc.executionLog.push({
        atMs: elapsedMs,
        requestNum: event.requestNum,
        kind: "request",
        message: `Request ${event.requestNum} started (circuit: ${event.circuitState})`,
      });
      return { ...acc };
    }

    case "request_success": {
      const req = acc.requests.get(event.requestNum);
      if (req) req.state = "succeeded";
      acc.executionLog.push({
        atMs: elapsedMs,
        requestNum: event.requestNum,
        kind: "success",
        message: `Request ${event.requestNum} succeeded`,
      });
      return { ...acc };
    }

    case "request_fail": {
      const req = acc.requests.get(event.requestNum);
      if (req) req.state = "failed";
      acc.executionLog.push({
        atMs: elapsedMs,
        requestNum: event.requestNum,
        kind: "failure",
        message: `Request ${event.requestNum} failed`,
      });
      return { ...acc };
    }

    case "circuit_open": {
      acc.circuitState = "open";
      acc.executionLog.push({
        atMs: elapsedMs,
        requestNum: event.requestNum,
        kind: "circuit_open",
        message: `Circuit OPEN — consecutive failures hit threshold`,
      });
      return { ...acc };
    }

    case "cooldown_start": {
      acc.currentPhase = {
        phase: "cooldown",
        requestNum: event.requestNum,
        circuitState: "open",
        cooldownMs: event.cooldownMs,
      };
      // Mark next request as cooldown state
      acc.requests.set(event.requestNum, {
        state: "cooldown",
        circuitStateBefore: "open",
        cooldownMs: event.cooldownMs,
      });
      acc.executionLog.push({
        atMs: elapsedMs,
        requestNum: event.requestNum,
        kind: "cooldown_start",
        message: `Circuit OPEN — cooldown sleep('${event.cooldownMs}ms') started`,
      });
      return { ...acc };
    }

    case "cooldown_end": {
      acc.executionLog.push({
        atMs: elapsedMs,
        requestNum: event.requestNum,
        kind: "cooldown_end",
        message: `Cooldown ended — circuit HALF-OPEN`,
      });
      return { ...acc };
    }

    case "circuit_half_open": {
      acc.circuitState = "half-open";
      acc.executionLog.push({
        atMs: elapsedMs,
        requestNum: event.requestNum,
        kind: "half_open_test",
        message: `Half-open test: request ${event.requestNum}`,
      });
      return { ...acc };
    }

    case "circuit_closed": {
      acc.circuitState = "closed";
      acc.executionLog.push({
        atMs: elapsedMs,
        requestNum: event.requestNum,
        kind: "circuit_closed",
        message: `Circuit CLOSED — service recovered`,
      });
      return { ...acc };
    }

    case "done": {
      acc.currentPhase = {
        phase: "done",
        requestNum: null,
        circuitState: acc.circuitState,
        cooldownMs: null,
      };
      acc.result = {
        totalRequests: event.totalRequests,
        totalFailures: event.totalFailures,
        circuitOpened: event.circuitOpened,
        outcome: event.status,
      };
      acc.executionLog.push({
        atMs: elapsedMs,
        requestNum: 0,
        kind: "completed",
        message: `All ${event.totalRequests} requests processed`,
      });
      return { ...acc };
    }

    default:
      return acc;
  }
}

export function CircuitBreakerDemo({
  workflowCode,
  workflowHtmlLines,
  workflowLineMap,
  stepCode,
  stepHtmlLines,
  stepLineMap,
}: CircuitBreakerDemoProps) {
  const [failPresetIndex, setFailPresetIndex] = useState(0);

  const [lifecycle, setLifecycle] = useState<LifecycleState>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Accumulated state from SSE events
  const accRef = useRef<CircuitAccumulator>(createAccumulator());
  const [snapshot, setSnapshot] = useState<CircuitAccumulator | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopElapsedTimer = useCallback(() => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      stopElapsedTimer();
    };
  }, [stopElapsedTimer]);

  const connectSse = useCallback(
    async (targetRunId: string, signal: AbortSignal) => {
      const acc = createAccumulator();
      accRef.current = acc;
      setSnapshot({ ...acc });

      // Start elapsed timer
      stopElapsedTimer();
      elapsedTimerRef.current = setInterval(() => {
        if (!signal.aborted) {
          setElapsedMs(Date.now() - accRef.current.startMs);
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
            if (parsed && typeof parsed === "object" && "type" in parsed) {
              const event = parsed as CircuitEvent;
              const updated = applyEvent(accRef.current, event);
              accRef.current = updated;
              setSnapshot({ ...updated });

              if (event.type === "done") {
                if (!signal.aborted) {
                  setLifecycle("completed");
                  stopElapsedTimer();
                  setElapsedMs(Date.now() - accRef.current.startMs);
                }
                return;
              }
            }
          }
        }

        // Stream ended without done event
        if (!signal.aborted && lifecycle === "running") {
          setLifecycle("completed");
          stopElapsedTimer();
        }
      } catch (err) {
        if (signal.aborted || (err instanceof Error && err.name === "AbortError")) {
          return;
        }
        setLifecycle("failed");
        stopElapsedTimer();
        setError(err instanceof Error ? err.message : "Failed to read stream");
      }
    },
    [lifecycle, stopElapsedTimer]
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
    abortRef.current?.abort();
    abortRef.current = null;
    stopElapsedTimer();

    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;

    const preset = FAIL_PRESETS[failPresetIndex];

    try {
      const res = await fetch("/api/circuit-breaker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: "payment-api",
          maxRequests: MAX_REQUESTS,
          failRange: preset.range ?? undefined,
        }),
        signal,
      });

      const payload = (await res.json()) as StartResponse;

      if (!res.ok) {
        throw new Error((payload as unknown as { error?: string }).error ?? `Request failed (${res.status})`);
      }

      if (signal.aborted) return;

      setRunId(payload.runId);
      setLifecycle("running");
      setElapsedMs(0);

      // Connect to SSE stream
      void connectSse(payload.runId, signal);
    } catch (startError) {
      if (signal.aborted || (startError instanceof Error && startError.name === "AbortError")) {
        return;
      }
      setError(startError instanceof Error ? startError.message : "Failed to start");
      setLifecycle("idle");
    }
  }, [connectSse, failPresetIndex, stopElapsedTimer]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopElapsedTimer();
    setLifecycle("idle");
    setRunId(null);
    setSnapshot(null);
    setElapsedMs(0);
    setError(null);
    accRef.current = createAccumulator();
    setTimeout(() => {
      startButtonRef.current?.focus();
    }, 0);
  }, [stopElapsedTimer]);

  const isRunning = lifecycle === "running";

  // Build request snapshots from accumulator
  const requests: RequestSnapshot[] = useMemo(() => {
    if (!snapshot) return [];
    const result: RequestSnapshot[] = [];
    for (let i = 1; i <= MAX_REQUESTS; i++) {
      const req = snapshot.requests.get(i);
      if (req) {
        result.push({
          requestNum: i,
          state: req.state,
          circuitStateBefore: req.circuitStateBefore,
          cooldownMs: req.cooldownMs,
          remainingCooldownMs: 0,
        });
      } else {
        result.push({
          requestNum: i,
          state: "pending",
          circuitStateBefore: "closed",
          cooldownMs: 0,
          remainingCooldownMs: 0,
        });
      }
    }
    return result;
  }, [snapshot]);

  const phaseExplainer = useMemo(() => {
    if (!snapshot) {
      return "Waiting to start a run.";
    }

    if (snapshot.currentPhase.phase === "request" && lifecycle === "running") {
      const state = snapshot.currentPhase.circuitState;
      const prefix = state === "half-open" ? "Half-open test: " : "";
      return `${prefix}Request ${snapshot.currentPhase.requestNum} executing callPaymentService() in a step. Circuit: ${state}.`;
    }

    if (snapshot.currentPhase.phase === "cooldown" && lifecycle === "running") {
      return `Circuit OPEN — sleep('${formatDurationLabel(snapshot.currentPhase.cooldownMs ?? 0)}') cooldown in progress. Zero compute while waiting.`;
    }

    if (lifecycle === "completed" && snapshot.result) {
      if (snapshot.result.outcome === "recovered") {
        return `Circuit recovered. ${snapshot.result.totalRequests} requests, ${snapshot.result.totalFailures} failures, circuit opened ${snapshot.result.circuitOpened} time(s).`;
      }
      return `Run completed. ${snapshot.result.totalRequests} requests, ${snapshot.result.totalFailures} failures.`;
    }

    if (lifecycle === "failed") {
      return `Run failed.`;
    }

    return "Run is active.";
  }, [snapshot, lifecycle]);

  type GutterMarkKind = "success" | "fail";

  const codeState = useMemo(() => {
    const wfMarks: Record<number, GutterMarkKind> = {};
    const stepMarks: Record<number, GutterMarkKind> = {};

    if (snapshot) {
      const lastSuccess = [...snapshot.executionLog].reverse().find((e) => e.kind === "success");
      const lastFailure = [...snapshot.executionLog].reverse().find((e) => e.kind === "failure");
      let lastRequestIdx = -1;
      let lastFailIdx = -1;
      for (let i = snapshot.executionLog.length - 1; i >= 0; i--) {
        if (lastRequestIdx === -1 && snapshot.executionLog[i].kind === "request") lastRequestIdx = i;
        if (lastFailIdx === -1 && snapshot.executionLog[i].kind === "failure") lastFailIdx = i;
        if (lastRequestIdx !== -1 && lastFailIdx !== -1) break;
      }

      if (lastSuccess && (!lastFailure || lastSuccess.atMs > lastFailure.atMs)) {
        for (const ln of workflowLineMap.callService) wfMarks[ln] = "success";
        for (const ln of stepLineMap.callService) stepMarks[ln] = "success";
      } else if (lastFailIdx > lastRequestIdx) {
        for (const ln of workflowLineMap.callService) wfMarks[ln] = "fail";
        for (const ln of stepLineMap.callService) stepMarks[ln] = "fail";
      }

      const hasCooldown = snapshot.executionLog.some(
        (e) => e.kind === "cooldown_start" || e.kind === "cooldown_end"
      );
      if (hasCooldown) {
        for (const ln of workflowLineMap.sleep) wfMarks[ln] = "success";
      }

      const hasCircuitOpen = snapshot.executionLog.some((e) => e.kind === "circuit_open");
      if (hasCircuitOpen) {
        for (const ln of workflowLineMap.circuitOpen) wfMarks[ln] = "fail";
      }

      const hasCircuitClosed = snapshot.executionLog.some((e) => e.kind === "circuit_closed");
      if (hasCircuitClosed) {
        for (const ln of workflowLineMap.circuitClosed) wfMarks[ln] = "success";
      }

      if (lifecycle === "completed") {
        if (snapshot.result?.outcome === "recovered") {
          for (const ln of workflowLineMap.successReturn) wfMarks[ln] = "success";
          for (const ln of stepLineMap.successReturn) stepMarks[ln] = "success";
        } else {
          for (const ln of workflowLineMap.failureReturn) wfMarks[ln] = "fail";
        }
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

    if (snapshot.currentPhase.phase === "request" && lifecycle === "running") {
      return {
        tone: "amber" as HighlightTone,
        workflowActiveLines: workflowLineMap.callService,
        stepActiveLines: stepLineMap.callService,
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    if (snapshot.currentPhase.phase === "cooldown" && lifecycle === "running") {
      return {
        tone: "cyan" as HighlightTone,
        workflowActiveLines: workflowLineMap.sleep,
        stepActiveLines: [] as number[],
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    if (lifecycle === "completed") {
      if (snapshot.result?.outcome === "recovered") {
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
    }

    return {
      tone: "red" as HighlightTone,
      workflowActiveLines: workflowLineMap.failureReturn,
      stepActiveLines: [] as number[],
      workflowGutterMarks: wfMarks,
      stepGutterMarks: stepMarks,
    };
  }, [snapshot, lifecycle, stepLineMap, workflowLineMap]);

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
            Send Requests
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
            <span className="text-xs text-gray-900">Fail requests</span>
            <select
              aria-label="Fail request range"
              value={failPresetIndex}
              onChange={(event) =>
                setFailPresetIndex(Number.parseInt(event.target.value, 10))
              }
              disabled={isRunning}
              className="h-8 w-16 rounded border border-gray-400 bg-background-100 px-1 text-center text-sm font-mono tabular-nums text-gray-1000 transition-colors focus:border-gray-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {FAIL_PRESETS.map((preset, index) => (
                <option key={preset.label} value={index}>
                  {preset.label}
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
          <div className="grid grid-cols-1 gap-2 lg:h-full lg:grid-cols-[1fr_auto_1fr]">
            <RequestLadder
              requests={requests}
              currentPhase={snapshot?.currentPhase.phase ?? null}
            />
            <CircuitStateIndicator
              circuitState={snapshot?.circuitState ?? "closed"}
              isRunning={isRunning}
            />
            <ExecutionLog
              elapsedMs={elapsedMs}
              events={snapshot?.executionLog ?? []}
            />
          </div>
        </div>
      </div>

      <p className="text-center text-xs italic text-gray-900">
        sleep() → durable cooldown with zero compute while circuit is open
      </p>

      <CircuitCodeWorkbench
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

function CircuitStateIndicator({
  circuitState,
  isRunning,
}: {
  circuitState: CircuitStateKind;
  isRunning: boolean;
}) {
  const stateConfig = {
    closed: {
      bg: "bg-green-700/20",
      border: "border-green-700/40",
      dot: "bg-green-700",
      text: "text-green-700",
      label: "CLOSED",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    open: {
      bg: "bg-red-700/20",
      border: "border-red-700/40",
      dot: "bg-red-700",
      text: "text-red-700",
      label: "OPEN",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
    "half-open": {
      bg: "bg-amber-700/20",
      border: "border-amber-700/40",
      dot: "bg-amber-700",
      text: "text-amber-700",
      label: "HALF-OPEN",
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01" />
        </svg>
      ),
    },
  } as const;

  const config = stateConfig[circuitState];

  return (
    <div className="flex flex-col items-center justify-center gap-1.5 px-3">
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-full border-2 ${config.border} ${config.bg} ${config.text} ${isRunning ? "animate-pulse" : ""} transition-colors duration-500`}
        aria-label={`Circuit state: ${config.label}`}
      >
        {config.icon}
      </div>
      <span className={`text-xs font-semibold uppercase tracking-wider ${config.text}`}>
        {config.label}
      </span>
    </div>
  );
}

function RequestLadder({
  requests,
  currentPhase,
}: {
  requests: RequestSnapshot[];
  currentPhase: CircuitPhaseKind | null;
}) {
  if (requests.length === 0 || requests.every((r) => r.state === "pending")) {
    return (
      <div className="h-full min-h-0 rounded-lg border border-gray-400/60 bg-background-200 p-2 text-xs text-gray-900">
        No requests yet.
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto rounded-lg border border-gray-400/60 bg-background-200 p-2">
      <div className="space-y-1">
        {requests.map((req) => {
          if (req.state === "pending") return null;
          const statusTone = requestTone(req.state);
          const stateLabel = req.circuitStateBefore !== "closed"
            ? ` (${req.circuitStateBefore})`
            : "";

          return (
            <article
              key={req.requestNum}
              className={`rounded-md border px-2 py-1.5 ${statusTone.cardClass}`}
              aria-label={`Request ${req.requestNum}`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${statusTone.dotClass}`}
                  aria-hidden="true"
                />
                <p className="text-sm font-medium text-gray-1000">
                  Req {req.requestNum}{stateLabel}
                </p>
                <span
                  className={`rounded-full border px-1.5 py-0.5 text-xs font-semibold uppercase leading-none ${statusTone.badgeClass}`}
                >
                  {req.state}
                </span>
                {req.cooldownMs > 0 && (
                  <p className="ml-auto text-xs font-mono tabular-nums text-cyan-700">
                    cooldown({formatDurationLabel(req.cooldownMs)})
                    {req.state === "cooldown" && currentPhase === "cooldown" ? " *" : ""}
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
  events: CircuitLogEvent[];
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
                className={`w-20 shrink-0 text-xs font-semibold uppercase ${tone.labelClass}`}
              >
                {event.kind.replace("_", " ")}
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

function requestTone(state: RequestRuntimeState): {
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
    case "cooldown":
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

function eventTone(kind: CircuitLogEventKind): {
  dotClass: string;
  labelClass: string;
} {
  switch (kind) {
    case "request":
      return {
        dotClass: "bg-blue-700",
        labelClass: "text-blue-700",
      };
    case "success":
      return {
        dotClass: "bg-green-700",
        labelClass: "text-green-700",
      };
    case "failure":
      return {
        dotClass: "bg-red-700",
        labelClass: "text-red-700",
      };
    case "circuit_open":
      return {
        dotClass: "bg-red-700",
        labelClass: "text-red-700",
      };
    case "cooldown_start":
      return {
        dotClass: "bg-cyan-700",
        labelClass: "text-cyan-700",
      };
    case "cooldown_end":
      return {
        dotClass: "bg-amber-700",
        labelClass: "text-amber-700",
      };
    case "half_open_test":
      return {
        dotClass: "bg-amber-700",
        labelClass: "text-amber-700",
      };
    case "circuit_closed":
      return {
        dotClass: "bg-green-700",
        labelClass: "text-green-700",
      };
    case "completed":
      return {
        dotClass: "bg-green-700",
        labelClass: "text-green-700",
      };
    case "exhausted":
      return {
        dotClass: "bg-red-700",
        labelClass: "text-red-700",
      };
    default:
      return {
        dotClass: "bg-gray-500",
        labelClass: "text-gray-900",
      };
  }
}
