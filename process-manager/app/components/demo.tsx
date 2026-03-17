"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ProcessManagerCodeWorkbench,
  type GutterMarkKind,
  type HighlightTone,
} from "./process-manager-code-workbench";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OrderState =
  | "received"
  | "payment_validated"
  | "payment_failed"
  | "inventory_checked"
  | "inventory_reserved"
  | "backordered"
  | "shipped"
  | "delivery_confirmed"
  | "completed"
  | "cancelled";

type ProcessManagerEvent =
  | { type: "state_transition"; from: OrderState; to: OrderState; step: string }
  | { type: "step_started"; step: string; message: string }
  | { type: "step_completed"; step: string; message: string }
  | { type: "step_retrying"; step: string; attempt: number }
  | { type: "branch_taken"; step: string; branch: string; reason: string }
  | { type: "sleeping"; step: string; duration: string; reason: string }
  | {
      type: "done";
      orderId: string;
      finalState: OrderState;
      summary: {
        orderId: string;
        finalState: OrderState;
        stateTransitions: number;
        paymentMethod: string;
        itemCount: number;
        trackingId: string | null;
      };
    };

type RunStatus = "idle" | "running" | "sleeping" | "completed" | "cancelled";

type StepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

type StepSnapshot = {
  id: string;
  label: string;
  status: StepStatus;
};

type TransitionSnapshot = {
  from: OrderState;
  to: OrderState;
  step: string;
};

type ProcessManagerSnapshot = {
  status: RunStatus;
  currentState: OrderState;
  steps: StepSnapshot[];
  transitions: TransitionSnapshot[];
  isSleeping: boolean;
  isTerminal: boolean;
  trackingId: string | null;
};

type ExecutionLogTone = "info" | "warn" | "success" | "branch" | "sleep";

type ExecutionLogEntry = {
  id: string;
  tone: ExecutionLogTone;
  message: string;
  elapsedMs: number;
};

export type OrchestratorLineMap = {
  initializeOrder: number[];
  validatePayment: number[];
  paymentFailedBranch: number[];
  cancelOrder: number[];
  checkInventory: number[];
  backorderBranch: number[];
  sleepBackorder: number[];
  recheckInventory: number[];
  reserveInventory: number[];
  shipOrder: number[];
  confirmDelivery: number[];
  completeOrder: number[];
};

export type StepLineMap = {
  initializeOrder: number[];
  validatePayment: number[];
  checkInventory: number[];
  recheckInventory: number[];
  reserveInventory: number[];
  shipOrder: number[];
  confirmDelivery: number[];
  completeOrder: number[];
  cancelOrder: number[];
};

// ---------------------------------------------------------------------------
// State machine graph definition
// ---------------------------------------------------------------------------

type StateNode = {
  id: OrderState;
  label: string;
  x: number;
  y: number;
};

type StateEdge = {
  from: OrderState;
  to: OrderState;
  label?: string;
};

const STATE_NODES: StateNode[] = [
  { id: "received", label: "Received", x: 80, y: 30 },
  { id: "payment_validated", label: "Payment OK", x: 220, y: 30 },
  { id: "payment_failed", label: "Payment Failed", x: 220, y: 110 },
  { id: "inventory_checked", label: "Inventory OK", x: 370, y: 30 },
  { id: "backordered", label: "Backordered", x: 370, y: 110 },
  { id: "inventory_reserved", label: "Reserved", x: 520, y: 30 },
  { id: "shipped", label: "Shipped", x: 650, y: 30 },
  { id: "delivery_confirmed", label: "Delivered", x: 780, y: 30 },
  { id: "completed", label: "Completed", x: 910, y: 30 },
  { id: "cancelled", label: "Cancelled", x: 350, y: 110 },
];

const STATE_EDGES: StateEdge[] = [
  { from: "received", to: "payment_validated" },
  { from: "received", to: "payment_failed", label: "fail" },
  { from: "payment_failed", to: "cancelled" },
  { from: "payment_validated", to: "inventory_checked" },
  { from: "payment_validated", to: "backordered", label: "backorder" },
  { from: "backordered", to: "inventory_checked", label: "recheck" },
  { from: "inventory_checked", to: "inventory_reserved" },
  { from: "inventory_reserved", to: "shipped" },
  { from: "shipped", to: "delivery_confirmed" },
  { from: "delivery_confirmed", to: "completed" },
];

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEP_DEFINITIONS: Array<{ id: string; label: string }> = [
  { id: "initializeOrder", label: "Initialize Order" },
  { id: "validatePayment", label: "Validate Payment" },
  { id: "checkInventory", label: "Check Inventory" },
  { id: "recheckInventory", label: "Recheck Inventory" },
  { id: "reserveInventory", label: "Reserve Inventory" },
  { id: "shipOrder", label: "Ship Order" },
  { id: "confirmDelivery", label: "Confirm Delivery" },
  { id: "completeOrder", label: "Complete Order" },
  { id: "cancelOrder", label: "Cancel Order" },
];

function createInitialSteps(): StepSnapshot[] {
  return STEP_DEFINITIONS.map((d) => ({
    id: d.id,
    label: d.label,
    status: "pending" as StepStatus,
  }));
}

// ---------------------------------------------------------------------------
// Scenario options
// ---------------------------------------------------------------------------

type Scenario = "happy" | "payment_fail" | "backorder";

const SCENARIO_OPTIONS: Array<{ value: Scenario; label: string; description: string }> = [
  { value: "happy", label: "Happy path", description: "All steps succeed" },
  { value: "payment_fail", label: "Payment failure", description: "Payment declined → cancel" },
  { value: "backorder", label: "Backorder wait", description: "Out of stock → sleep → recheck" },
];

// ---------------------------------------------------------------------------
// Accumulator
// ---------------------------------------------------------------------------

type Accumulator = {
  status: RunStatus;
  currentState: OrderState;
  steps: Map<string, StepSnapshot>;
  transitions: TransitionSnapshot[];
  isSleeping: boolean;
  isTerminal: boolean;
  trackingId: string | null;
};

function createAccumulator(): Accumulator {
  const steps = new Map<string, StepSnapshot>();
  for (const def of STEP_DEFINITIONS) {
    steps.set(def.id, { id: def.id, label: def.label, status: "pending" });
  }
  return {
    status: "running",
    currentState: "received",
    steps,
    transitions: [],
    isSleeping: false,
    isTerminal: false,
    trackingId: null,
  };
}

function applyEvent(acc: Accumulator, event: ProcessManagerEvent): void {
  switch (event.type) {
    case "step_started": {
      const step = acc.steps.get(event.step);
      if (step) step.status = "running";
      acc.isSleeping = false;
      break;
    }
    case "step_completed": {
      const step = acc.steps.get(event.step);
      if (step) step.status = "completed";
      break;
    }
    case "step_retrying": {
      const step = acc.steps.get(event.step);
      if (step) step.status = "running";
      break;
    }
    case "state_transition": {
      acc.currentState = event.to;
      acc.transitions.push({
        from: event.from,
        to: event.to,
        step: event.step,
      });
      break;
    }
    case "branch_taken": {
      if (event.branch === "payment_failed") {
        const step = acc.steps.get("validatePayment");
        if (step) step.status = "failed";
        // Skip steps that won't run
        for (const id of [
          "checkInventory",
          "recheckInventory",
          "reserveInventory",
          "shipOrder",
          "confirmDelivery",
          "completeOrder",
        ]) {
          const s = acc.steps.get(id);
          if (s && s.status === "pending") s.status = "skipped";
        }
      }
      break;
    }
    case "sleeping": {
      acc.isSleeping = true;
      acc.status = "sleeping";
      break;
    }
    case "done": {
      acc.isTerminal = true;
      acc.status =
        event.finalState === "cancelled" ? "cancelled" : "completed";
      if (event.summary.trackingId) {
        acc.trackingId = event.summary.trackingId;
      }
      break;
    }
  }
}

function toSnapshot(acc: Accumulator): ProcessManagerSnapshot {
  return {
    status: acc.status,
    currentState: acc.currentState,
    steps: Array.from(acc.steps.values()),
    transitions: [...acc.transitions],
    isSleeping: acc.isSleeping,
    isTerminal: acc.isTerminal,
    trackingId: acc.trackingId,
  };
}

// ---------------------------------------------------------------------------
// SSE parser
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Highlight state
// ---------------------------------------------------------------------------

type HighlightState = {
  caption: string;
  orchestratorActiveLines: number[];
  stepActiveLines: number[];
  orchestratorGutterMarks: Record<number, GutterMarkKind>;
  stepGutterMarks: Record<number, GutterMarkKind>;
  tone: HighlightTone;
};

function getHighlightState(
  snapshot: ProcessManagerSnapshot | null,
  orchestratorLineMap: OrchestratorLineMap,
  stepLineMap: StepLineMap,
): HighlightState {
  const empty: HighlightState = {
    caption: "Start a run to trace the order fulfillment state machine.",
    orchestratorActiveLines: [],
    stepActiveLines: [],
    orchestratorGutterMarks: {},
    stepGutterMarks: {},
    tone: "amber",
  };

  if (!snapshot) return empty;

  const oActive = new Set<number>();
  const sActive = new Set<number>();
  const oMarks: Record<number, GutterMarkKind> = {};
  const sMarks: Record<number, GutterMarkKind> = {};

  const addO = (lines: number[]) => {
    for (const l of lines) oActive.add(l);
  };
  const addS = (lines: number[]) => {
    for (const l of lines) sActive.add(l);
  };
  const markO = (lines: number[], kind: GutterMarkKind) => {
    for (const l of lines) oMarks[l] = kind;
  };
  const markS = (lines: number[], kind: GutterMarkKind) => {
    for (const l of lines) sMarks[l] = kind;
  };

  // Map step ids to orchestrator + step line map keys
  const STEP_MAP: Record<
    string,
    {
      oKey: keyof OrchestratorLineMap;
      sKey: keyof StepLineMap;
    }
  > = {
    initializeOrder: { oKey: "initializeOrder", sKey: "initializeOrder" },
    validatePayment: { oKey: "validatePayment", sKey: "validatePayment" },
    checkInventory: { oKey: "checkInventory", sKey: "checkInventory" },
    recheckInventory: { oKey: "recheckInventory", sKey: "recheckInventory" },
    reserveInventory: { oKey: "reserveInventory", sKey: "reserveInventory" },
    shipOrder: { oKey: "shipOrder", sKey: "shipOrder" },
    confirmDelivery: { oKey: "confirmDelivery", sKey: "confirmDelivery" },
    completeOrder: { oKey: "completeOrder", sKey: "completeOrder" },
    cancelOrder: { oKey: "cancelOrder", sKey: "cancelOrder" },
  };

  let caption = "Order fulfillment in progress.";
  let tone: HighlightTone = "amber";

  // Mark completed steps with gutter marks
  for (const step of snapshot.steps) {
    const map = STEP_MAP[step.id];
    if (!map) continue;

    if (step.status === "completed") {
      markO(orchestratorLineMap[map.oKey], "success");
      markS(stepLineMap[map.sKey], "success");
    }

    if (step.status === "running") {
      addO(orchestratorLineMap[map.oKey]);
      addS(stepLineMap[map.sKey]);
      caption = `${step.label} is executing.`;
    }

    if (step.status === "failed") {
      markO(orchestratorLineMap[map.oKey], "fail");
      markS(stepLineMap[map.sKey], "fail");
    }
  }

  // Highlight branches
  const hasBranch = (branch: string) =>
    snapshot.transitions.some(
      (t) =>
        (branch === "payment_failed" && t.to === "payment_failed") ||
        (branch === "backordered" && t.to === "backordered"),
    );

  if (hasBranch("payment_failed")) {
    addO(orchestratorLineMap.paymentFailedBranch);
    addO(orchestratorLineMap.cancelOrder);
    tone = "red";
    caption = "Payment failed → cancelling order.";
  }

  if (hasBranch("backordered")) {
    addO(orchestratorLineMap.backorderBranch);
    if (snapshot.isSleeping) {
      addO(orchestratorLineMap.sleepBackorder);
      tone = "cyan";
      caption = "Backordered → sleeping 5s before recheck.";
    }
  }

  if (snapshot.status === "completed") {
    tone = "green";
    caption = snapshot.trackingId
      ? `Order completed. Tracking: ${snapshot.trackingId}`
      : "Order completed successfully.";
    addO(orchestratorLineMap.completeOrder);
    markO(orchestratorLineMap.completeOrder, "success");
  }

  if (snapshot.status === "cancelled") {
    tone = "red";
    caption = "Order cancelled due to payment failure.";
    addO(orchestratorLineMap.cancelOrder);
    markO(orchestratorLineMap.cancelOrder, "fail");
  }

  return {
    caption,
    orchestratorActiveLines: Array.from(oActive).sort((a, b) => a - b),
    stepActiveLines: Array.from(sActive).sort((a, b) => a - b),
    orchestratorGutterMarks: oMarks,
    stepGutterMarks: sMarks,
    tone,
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORKFLOW_LABEL = `"use ${"workflow"}"`;
const STEP_LABEL = `"use ${"step"}"`;
const MAX_LOG_ENTRIES = 50;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProcessManagerDemo({
  orchestratorCode,
  orchestratorHtmlLines,
  orchestratorLineMap,
  stepCode,
  stepHtmlLines,
  stepLineMap,
}: {
  orchestratorCode: string;
  orchestratorHtmlLines: string[];
  orchestratorLineMap: OrchestratorLineMap;
  stepCode: string;
  stepHtmlLines: string[];
  stepLineMap: StepLineMap;
}) {
  const [scenario, setScenario] = useState<Scenario>("happy");
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ProcessManagerSnapshot | null>(null);
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

  // Scroll to demo on first run
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
      setExecutionLog((prev) => {
        const next = [...prev, entry];
        return next.slice(-MAX_LOG_ENTRIES);
      });
    },
    [],
  );

  // Auto-scroll log
  useEffect(() => {
    const el = logScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [executionLog.length]);

  // Cleanup on unmount
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

      const processEvent = (event: ProcessManagerEvent) => {
        const ms = elapsed();

        switch (event.type) {
          case "step_started":
            appendLog("info", event.message, ms);
            break;
          case "step_completed":
            appendLog("success", event.message, ms);
            break;
          case "step_retrying":
            appendLog("warn", `Retrying ${event.step} (attempt ${event.attempt})`, ms);
            break;
          case "state_transition":
            appendLog("info", `${event.from} → ${event.to}`, ms);
            break;
          case "branch_taken":
            appendLog("branch", `Branch: ${event.reason}`, ms);
            break;
          case "sleeping":
            appendLog("sleep", `Sleeping ${event.duration}: ${event.reason}`, ms);
            break;
          case "done":
            appendLog(
              event.finalState === "cancelled" ? "warn" : "success",
              `Done → ${event.finalState}${event.summary.trackingId ? ` (${event.summary.trackingId})` : ""}`,
              ms,
            );
            break;
        }

        applyEvent(acc, event);
        setSnapshot(toSnapshot(acc));
      };

      try {
        const res = await fetch(
          `/api/readable/${encodeURIComponent(targetRunId)}`,
          { signal },
        );
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
              processEvent(parsed as ProcessManagerEvent);
            }
          }
        }

        if (buffer.trim()) {
          const parsed = parseSseChunk(buffer);
          if (parsed && typeof parsed === "object" && "type" in parsed) {
            processEvent(parsed as ProcessManagerEvent);
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
    [appendLog, elapsed, stopTicker],
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
      const res = await fetch("/api/process-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: `ORD-${Date.now().toString(36).toUpperCase()}`,
          items: ["Widget A", "Widget B", "Widget C"],
          paymentMethod: "credit_card",
          simulatePaymentFail: scenario === "payment_fail",
          simulateBackorder: scenario === "backorder",
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

      appendLog("info", `Run started — order ${data.orderId}`, 0);
      connectSse(data.runId, signal);
    } catch (startError) {
      if (signal.aborted) return;
      if (startError instanceof Error && startError.name === "AbortError")
        return;
      setError(
        startError instanceof Error ? startError.message : "Start failed",
      );
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
    setScenario("happy");
    setIsStarting(false);
    setTimeout(() => {
      startButtonRef.current?.focus();
    }, 0);
  };

  const isActiveRun =
    Boolean(runId) && snapshot !== null && !snapshot.isTerminal;
  const isLocked = isStarting || isActiveRun;

  const highlightState = useMemo(
    () => getHighlightState(snapshot, orchestratorLineMap, stepLineMap),
    [snapshot, orchestratorLineMap, stepLineMap],
  );

  // State machine graph derived data
  const visitedStates = useMemo(() => {
    if (!snapshot) return new Set<OrderState>();
    const visited = new Set<OrderState>();
    for (const t of snapshot.transitions) {
      visited.add(t.from);
      visited.add(t.to);
    }
    return visited;
  }, [snapshot]);

  const firedEdges = useMemo(() => {
    if (!snapshot) return new Set<string>();
    const fired = new Set<string>();
    for (const t of snapshot.transitions) {
      fired.add(`${t.from}->${t.to}`);
    }
    return fired;
  }, [snapshot]);

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

      {/* Step 1: Dispatch */}
      <StepCard step={1} title="Dispatch Order" state={snapshot ? "done" : "active"}>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            ref={startButtonRef}
            onClick={handleStart}
            disabled={isLocked}
            className="cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isStarting ? "Starting..." : "Dispatch"}
          </button>

          <div className="inline-flex items-center gap-2 rounded-md border border-gray-400 bg-background-100 px-2.5 py-1.5">
            <label
              htmlFor="scenario"
              className="shrink-0 text-xs font-medium text-gray-900"
            >
              Scenario
            </label>
            <select
              id="scenario"
              value={scenario}
              onChange={(e) => setScenario(e.target.value as Scenario)}
              disabled={isLocked}
              className="rounded border border-gray-400 bg-background-100 px-2 py-1 font-mono text-xs text-gray-1000 transition-colors focus:border-gray-300 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {SCENARIO_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleReset}
            disabled={isStarting}
            className="cursor-pointer rounded-md border border-gray-400 px-4 py-2 text-sm text-gray-900 transition-colors hover:border-gray-300 hover:text-gray-1000 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset
          </button>

          <div
            className="ml-auto flex items-center gap-3"
            role="status"
            aria-live="polite"
          >
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 font-mono text-xs ${statusPillClass(
                snapshot?.status ?? "idle",
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
          Scenario:{" "}
          <span className="font-mono">
            {SCENARIO_OPTIONS.find((o) => o.value === scenario)?.description}
          </span>
        </p>
      </StepCard>

      {/* Step 2: State Machine */}
      <StepCard
        step={2}
        title="State Machine"
        state={!snapshot ? "pending" : snapshot.isTerminal ? "done" : "active"}
      >
        <p
          className="mb-4 text-sm text-gray-900"
          role="status"
          aria-live="polite"
        >
          {snapshot
            ? `Current state: ${snapshot.currentState} (${snapshot.transitions.length} transition${snapshot.transitions.length !== 1 ? "s" : ""})`
            : "Waiting to start"}
        </p>

        <StateMachineGraph
          currentState={snapshot?.currentState ?? null}
          visitedStates={visitedStates}
          firedEdges={firedEdges}
          isSleeping={snapshot?.isSleeping ?? false}
        />

        {/* Step list */}
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {(snapshot?.steps ?? createInitialSteps()).map((step) => (
            <div
              key={step.id}
              className="flex items-center justify-between rounded border border-gray-400/40 px-3 py-2"
            >
              <span className="text-sm text-gray-1000">{step.label}</span>
              <StepStatusPill status={step.status} />
            </div>
          ))}
        </div>
      </StepCard>

      {/* Step 3: Execution Log */}
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
          aria-label="Process manager execution log"
        >
          {executionLog.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-900">
              Dispatch an order to stream step-by-step execution updates.
            </p>
          ) : (
            <ul className="divide-y divide-gray-300" role="list">
              {executionLog.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between gap-4 px-4 py-2.5"
                >
                  <span className={`text-sm ${logTextClass(entry.tone)}`}>
                    {entry.message}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-gray-900 tabular-nums">
                    +{entry.elapsedMs}ms
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </StepCard>

      {/* Caption */}
      <p className="text-center text-xs italic text-gray-900">
        {highlightState.caption}
      </p>

      {/* Code Workbench */}
      <ProcessManagerCodeWorkbench
        leftPane={{
          filename: "workflows/process-manager.ts",
          label: WORKFLOW_LABEL,
          code: orchestratorCode,
          htmlLines: orchestratorHtmlLines,
          activeLines: highlightState.orchestratorActiveLines,
          gutterMarks: highlightState.orchestratorGutterMarks,
          tone: highlightState.tone,
        }}
        rightPane={{
          filename: "workflows/steps.ts",
          label: STEP_LABEL,
          code: stepCode,
          htmlLines: stepHtmlLines,
          activeLines: highlightState.stepActiveLines,
          gutterMarks: highlightState.stepGutterMarks,
          tone: highlightState.tone,
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// State Machine Graph (SVG)
// ---------------------------------------------------------------------------

function StateMachineGraph({
  currentState,
  visitedStates,
  firedEdges,
  isSleeping,
}: {
  currentState: OrderState | null;
  visitedStates: Set<OrderState>;
  firedEdges: Set<string>;
  isSleeping: boolean;
}) {
  const nodeMap = useMemo(() => {
    const map = new Map<string, StateNode>();
    for (const n of STATE_NODES) map.set(n.id, n);
    return map;
  }, []);

  return (
    <div className="overflow-x-auto rounded-md border border-gray-400/40 bg-background-100 p-2">
      <svg
        viewBox="0 0 1000 150"
        className="w-full"
        style={{ minWidth: 700 }}
        aria-label="Order fulfillment state machine"
        role="img"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="currentColor" className="text-gray-500" />
          </marker>
          <marker
            id="arrowhead-active"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="currentColor" className="text-teal-700" />
          </marker>
          <marker
            id="arrowhead-red"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="currentColor" className="text-red-700" />
          </marker>
          <marker
            id="arrowhead-cyan"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="currentColor" className="text-cyan-700" />
          </marker>
        </defs>

        {/* Edges */}
        {STATE_EDGES.map((edge) => {
          const from = nodeMap.get(edge.from);
          const to = nodeMap.get(edge.to);
          if (!from || !to) return null;

          const edgeKey = `${edge.from}->${edge.to}`;
          const isFired = firedEdges.has(edgeKey);
          const isError =
            isFired &&
            (edge.to === "payment_failed" || edge.to === "cancelled");
          const isSleep =
            isFired &&
            (edge.to === "backordered" ||
              (edge.from === "backordered" && isSleeping));

          let strokeClass = "text-gray-500/40";
          let marker = "url(#arrowhead)";
          if (isFired) {
            if (isError) {
              strokeClass = "text-red-700";
              marker = "url(#arrowhead-red)";
            } else if (isSleep) {
              strokeClass = "text-cyan-700";
              marker = "url(#arrowhead-cyan)";
            } else {
              strokeClass = "text-teal-700";
              marker = "url(#arrowhead-active)";
            }
          }

          // Simple line for horizontal edges, curved for vertical
          const sameRow = Math.abs(from.y - to.y) < 20;
          const dx = to.x - from.x;

          if (sameRow) {
            return (
              <line
                key={edgeKey}
                x1={from.x + 50}
                y1={from.y + 18}
                x2={to.x - 8}
                y2={to.y + 18}
                stroke="currentColor"
                className={`${strokeClass} transition-colors duration-300`}
                strokeWidth={isFired ? 2 : 1}
                markerEnd={marker}
              />
            );
          }

          // Curved path for diagonal edges
          const mx = from.x + dx * 0.5;
          const path = `M${from.x + 50},${from.y + 18} C${mx},${from.y + 18} ${mx},${to.y + 18} ${to.x - 8},${to.y + 18}`;

          return (
            <path
              key={edgeKey}
              d={path}
              fill="none"
              stroke="currentColor"
              className={`${strokeClass} transition-colors duration-300`}
              strokeWidth={isFired ? 2 : 1}
              markerEnd={marker}
            />
          );
        })}

        {/* Nodes */}
        {STATE_NODES.map((node) => {
          const isCurrent = currentState === node.id;
          const isVisited = visitedStates.has(node.id);
          const isError =
            node.id === "payment_failed" || node.id === "cancelled";
          const isSleepNode = node.id === "backordered";

          let fillClass = "fill-background-200";
          let strokeClass = "stroke-gray-500/40";
          let textClass = "fill-gray-900";

          if (isCurrent) {
            if (isError) {
              fillClass = "fill-red-700/20";
              strokeClass = "stroke-red-700";
              textClass = "fill-red-700";
            } else if (isSleepNode && isSleeping) {
              fillClass = "fill-cyan-700/20";
              strokeClass = "stroke-cyan-700";
              textClass = "fill-cyan-700";
            } else {
              fillClass = "fill-teal-700/20";
              strokeClass = "stroke-teal-700";
              textClass = "fill-teal-700";
            }
          } else if (isVisited) {
            if (isError) {
              fillClass = "fill-red-700/10";
              strokeClass = "stroke-red-700/60";
              textClass = "fill-red-700";
            } else {
              fillClass = "fill-teal-700/10";
              strokeClass = "stroke-teal-700/60";
              textClass = "fill-gray-1000";
            }
          }

          return (
            <g key={node.id}>
              <rect
                x={node.x - 2}
                y={node.y + 2}
                width={104}
                height={32}
                rx={6}
                className={`${fillClass} ${strokeClass} transition-colors duration-300`}
                strokeWidth={isCurrent ? 2 : 1}
              />
              <text
                x={node.x + 50}
                y={node.y + 22}
                textAnchor="middle"
                className={`${textClass} text-[11px] font-medium transition-colors duration-300`}
                style={{ fontFamily: "var(--font-geist-mono, monospace)" }}
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

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

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
                ? "bg-teal-700 text-white"
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
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
    case "idle":
      return "border-gray-500/60 bg-gray-500/10 text-gray-900";
    case "running":
      return "border-amber-700/40 bg-amber-700/20 text-amber-700";
    case "sleeping":
      return "border-cyan-700/40 bg-cyan-700/20 text-cyan-700";
    case "completed":
      return "border-green-700/40 bg-green-700/20 text-green-700";
    case "cancelled":
      return "border-red-700/40 bg-red-700/10 text-red-700";
  }
}

function StepStatusPill({ status }: { status: StepStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-xs tabular-nums ${stepBadgeClass(
        status,
      )}`}
    >
      {status}
    </span>
  );
}

function stepBadgeClass(status: StepStatus): string {
  switch (status) {
    case "pending":
      return "border-gray-500/60 bg-gray-500/10 text-gray-900";
    case "running":
      return "border-amber-700/50 bg-amber-700/20 text-amber-700";
    case "completed":
      return "border-green-700/50 bg-green-700/20 text-green-700";
    case "failed":
      return "border-red-700/50 bg-red-700/10 text-red-700";
    case "skipped":
      return "border-gray-500/60 bg-gray-500/10 text-gray-900";
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
    case "branch":
      return "text-red-700";
    case "sleep":
      return "text-cyan-700";
  }
}
