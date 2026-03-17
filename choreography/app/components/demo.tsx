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
  ChoreographyCodeWorkbench,
  type GutterMarkKind,
  type HighlightTone,
} from "./choreography-code-workbench";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ParticipantId =
  | "order-service"
  | "inventory-service"
  | "payment-service"
  | "shipping-service";

type ChoreographyEvent =
  | { type: "event_emitted"; participant: ParticipantId; event: string; correlationId: string; message: string }
  | { type: "event_received"; participant: ParticipantId; event: string; correlationId: string; message: string }
  | { type: "step_started"; participant: ParticipantId; message: string }
  | { type: "step_completed"; participant: ParticipantId; message: string }
  | { type: "step_retrying"; participant: ParticipantId; attempt: number }
  | { type: "compensation_started"; participant: ParticipantId; reason: string; correlationId: string }
  | { type: "compensation_completed"; participant: ParticipantId; message: string; correlationId: string }
  | { type: "sleeping"; participant: ParticipantId; duration: string; reason: string }
  | {
      type: "done";
      correlationId: string;
      outcome: "fulfilled" | "compensated";
      summary: {
        correlationId: string;
        outcome: "fulfilled" | "compensated";
        participantsInvolved: ParticipantId[];
        eventsEmitted: number;
        trackingId: string | null;
        failedService: ParticipantId | null;
      };
    };

type RunStatus = "idle" | "running" | "sleeping" | "completed" | "compensated";

type ParticipantStatus = "pending" | "running" | "completed" | "failed" | "compensating" | "compensated";

type ParticipantSnapshot = {
  id: ParticipantId;
  label: string;
  status: ParticipantStatus;
};

type EventFlowEntry = {
  from: ParticipantId;
  event: string;
  correlationId: string;
};

type ChoreographySnapshot = {
  status: RunStatus;
  participants: ParticipantSnapshot[];
  eventFlow: EventFlowEntry[];
  isSleeping: boolean;
  isTerminal: boolean;
  isCompensating: boolean;
  trackingId: string | null;
  failedService: ParticipantId | null;
};

type ExecutionLogTone = "info" | "warn" | "success" | "event" | "compensation" | "sleep";

type ExecutionLogEntry = {
  id: string;
  tone: ExecutionLogTone;
  message: string;
  elapsedMs: number;
};

export type FlowLineMap = {
  orderServicePlaceOrder: number[];
  inventoryServiceReserve: number[];
  sleepHandoff: number[];
  paymentServiceCharge: number[];
  shippingServiceShip: number[];
  compensationBranch: number[];
  finalizeOutcome: number[];
};

export type ParticipantLineMap = {
  orderService: number[];
  inventoryService: number[];
  paymentService: number[];
  shippingService: number[];
  orderServiceCompensate: number[];
  inventoryServiceCompensate: number[];
  paymentServiceCompensate: number[];
};

// ---------------------------------------------------------------------------
// Event flow graph definition
// ---------------------------------------------------------------------------

type EventNode = {
  id: ParticipantId;
  label: string;
  x: number;
  y: number;
};

type EventEdge = {
  from: ParticipantId;
  to: ParticipantId;
  event: string;
  label?: string;
};

const EVENT_NODES: EventNode[] = [
  { id: "order-service", label: "Order Service", x: 80, y: 40 },
  { id: "inventory-service", label: "Inventory Service", x: 320, y: 40 },
  { id: "payment-service", label: "Payment Service", x: 560, y: 40 },
  { id: "shipping-service", label: "Shipping Service", x: 800, y: 40 },
];

const EVENT_EDGES: EventEdge[] = [
  { from: "order-service", to: "inventory-service", event: "order_placed", label: "order_placed" },
  { from: "inventory-service", to: "payment-service", event: "inventory_reserved", label: "inventory_reserved" },
  { from: "payment-service", to: "shipping-service", event: "payment_processed", label: "payment_processed" },
];

// ---------------------------------------------------------------------------
// Participant definitions
// ---------------------------------------------------------------------------

const PARTICIPANT_DEFINITIONS: Array<{ id: ParticipantId; label: string }> = [
  { id: "order-service", label: "Order Service" },
  { id: "inventory-service", label: "Inventory Service" },
  { id: "payment-service", label: "Payment Service" },
  { id: "shipping-service", label: "Shipping Service" },
];

function createInitialParticipants(): ParticipantSnapshot[] {
  return PARTICIPANT_DEFINITIONS.map((d) => ({
    id: d.id,
    label: d.label,
    status: "pending" as ParticipantStatus,
  }));
}

// ---------------------------------------------------------------------------
// Scenario options
// ---------------------------------------------------------------------------

type Scenario = "happy" | "inventory_fail" | "payment_fail" | "shipping_fail";

const SCENARIO_OPTIONS: Array<{ value: Scenario; label: string; description: string }> = [
  { value: "happy", label: "Happy path", description: "All participants succeed" },
  { value: "inventory_fail", label: "Inventory failure", description: "Inventory fails → compensate order" },
  { value: "payment_fail", label: "Payment failure", description: "Payment fails → compensate inventory & order" },
  { value: "shipping_fail", label: "Shipping failure", description: "Shipping fails → compensate all" },
];

// ---------------------------------------------------------------------------
// Accumulator
// ---------------------------------------------------------------------------

type Accumulator = {
  status: RunStatus;
  participants: Map<ParticipantId, ParticipantSnapshot>;
  eventFlow: EventFlowEntry[];
  isSleeping: boolean;
  isTerminal: boolean;
  isCompensating: boolean;
  trackingId: string | null;
  failedService: ParticipantId | null;
};

function createAccumulator(): Accumulator {
  const participants = new Map<ParticipantId, ParticipantSnapshot>();
  for (const def of PARTICIPANT_DEFINITIONS) {
    participants.set(def.id, { id: def.id, label: def.label, status: "pending" });
  }
  return {
    status: "running",
    participants,
    eventFlow: [],
    isSleeping: false,
    isTerminal: false,
    isCompensating: false,
    trackingId: null,
    failedService: null,
  };
}

function applyEvent(acc: Accumulator, event: ChoreographyEvent): void {
  switch (event.type) {
    case "step_started": {
      const p = acc.participants.get(event.participant);
      if (p && p.status !== "compensating") p.status = "running";
      acc.isSleeping = false;
      break;
    }
    case "step_completed": {
      const p = acc.participants.get(event.participant);
      if (p && p.status !== "compensated") p.status = "completed";
      break;
    }
    case "step_retrying": {
      const p = acc.participants.get(event.participant);
      if (p) p.status = "running";
      break;
    }
    case "event_emitted": {
      acc.eventFlow.push({
        from: event.participant,
        event: event.event,
        correlationId: event.correlationId,
      });
      // If this is a failure event, mark the participant as failed
      if (event.event.endsWith("_failed")) {
        const p = acc.participants.get(event.participant);
        if (p) p.status = "failed";
        acc.failedService = event.participant;
      }
      break;
    }
    case "event_received": {
      const p = acc.participants.get(event.participant);
      if (p && p.status === "pending") p.status = "running";
      break;
    }
    case "compensation_started": {
      acc.isCompensating = true;
      const p = acc.participants.get(event.participant);
      if (p) p.status = "compensating";
      break;
    }
    case "compensation_completed": {
      const p = acc.participants.get(event.participant);
      if (p) p.status = "compensated";
      break;
    }
    case "sleeping": {
      acc.isSleeping = true;
      acc.status = "sleeping";
      break;
    }
    case "done": {
      acc.isTerminal = true;
      acc.status = event.outcome === "compensated" ? "compensated" : "completed";
      if (event.summary.trackingId) {
        acc.trackingId = event.summary.trackingId;
      }
      if (event.summary.failedService) {
        acc.failedService = event.summary.failedService;
      }
      break;
    }
  }
}

function toSnapshot(acc: Accumulator): ChoreographySnapshot {
  return {
    status: acc.status,
    participants: Array.from(acc.participants.values()),
    eventFlow: [...acc.eventFlow],
    isSleeping: acc.isSleeping,
    isTerminal: acc.isTerminal,
    isCompensating: acc.isCompensating,
    trackingId: acc.trackingId,
    failedService: acc.failedService,
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
  flowActiveLines: number[];
  participantActiveLines: number[];
  flowGutterMarks: Record<number, GutterMarkKind>;
  participantGutterMarks: Record<number, GutterMarkKind>;
  tone: HighlightTone;
};

function getHighlightState(
  snapshot: ChoreographySnapshot | null,
  flowLineMap: FlowLineMap,
  participantLineMap: ParticipantLineMap,
): HighlightState {
  const empty: HighlightState = {
    caption: "Start a run to trace event-driven choreography across participants.",
    flowActiveLines: [],
    participantActiveLines: [],
    flowGutterMarks: {},
    participantGutterMarks: {},
    tone: "amber",
  };

  if (!snapshot) return empty;

  const fActive = new Set<number>();
  const pActive = new Set<number>();
  const fMarks: Record<number, GutterMarkKind> = {};
  const pMarks: Record<number, GutterMarkKind> = {};

  const addF = (lines: number[]) => {
    for (const l of lines) fActive.add(l);
  };
  const addP = (lines: number[]) => {
    for (const l of lines) pActive.add(l);
  };
  const markF = (lines: number[], kind: GutterMarkKind) => {
    for (const l of lines) fMarks[l] = kind;
  };
  const markP = (lines: number[], kind: GutterMarkKind) => {
    for (const l of lines) pMarks[l] = kind;
  };

  const PARTICIPANT_MAP: Record<
    ParticipantId,
    {
      fKey: keyof FlowLineMap;
      pKey: keyof ParticipantLineMap;
    }
  > = {
    "order-service": { fKey: "orderServicePlaceOrder", pKey: "orderService" },
    "inventory-service": { fKey: "inventoryServiceReserve", pKey: "inventoryService" },
    "payment-service": { fKey: "paymentServiceCharge", pKey: "paymentService" },
    "shipping-service": { fKey: "shippingServiceShip", pKey: "shippingService" },
  };

  let caption = "Choreography in progress — events flowing between participants.";
  let tone: HighlightTone = "amber";

  for (const participant of snapshot.participants) {
    const map = PARTICIPANT_MAP[participant.id];
    if (!map) continue;

    if (participant.status === "completed") {
      markF(flowLineMap[map.fKey], "success");
      markP(participantLineMap[map.pKey], "success");
    }

    if (participant.status === "running") {
      addF(flowLineMap[map.fKey]);
      addP(participantLineMap[map.pKey]);
      caption = `${participant.label} is processing.`;
    }

    if (participant.status === "failed") {
      markF(flowLineMap[map.fKey], "fail");
      markP(participantLineMap[map.pKey], "fail");
    }

    if (participant.status === "compensating" || participant.status === "compensated") {
      const compKey = `${participant.id.replace("-service", "Service")}Compensate` as keyof ParticipantLineMap;
      if (participantLineMap[compKey]) {
        if (participant.status === "compensating") {
          addP(participantLineMap[compKey]);
        } else {
          markP(participantLineMap[compKey], "fail");
        }
      }
    }
  }

  if (snapshot.isCompensating) {
    addF(flowLineMap.compensationBranch);
    tone = "red";
    caption = snapshot.failedService
      ? `${snapshot.failedService} failed — compensating upstream participants.`
      : "Compensation in progress.";
  }

  if (snapshot.isSleeping) {
    addF(flowLineMap.sleepHandoff);
    tone = "cyan";
    caption = "Sleeping — awaiting async event handoff between participants.";
  }

  if (snapshot.status === "completed") {
    tone = "green";
    caption = snapshot.trackingId
      ? `Order fulfilled. Tracking: ${snapshot.trackingId}`
      : "Order fulfilled successfully.";
    addF(flowLineMap.finalizeOutcome);
    markF(flowLineMap.finalizeOutcome, "success");
  }

  if (snapshot.status === "compensated") {
    tone = "red";
    caption = snapshot.failedService
      ? `Compensated — ${snapshot.failedService} triggered rollback.`
      : "Order compensated.";
    addF(flowLineMap.finalizeOutcome);
    markF(flowLineMap.finalizeOutcome, "fail");
  }

  return {
    caption,
    flowActiveLines: Array.from(fActive).sort((a, b) => a - b),
    participantActiveLines: Array.from(pActive).sort((a, b) => a - b),
    flowGutterMarks: fMarks,
    participantGutterMarks: pMarks,
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

export function ChoreographyDemo({
  flowCode,
  flowHtmlLines,
  flowLineMap,
  participantCode,
  participantHtmlLines,
  participantLineMap,
}: {
  flowCode: string;
  flowHtmlLines: string[];
  flowLineMap: FlowLineMap;
  participantCode: string;
  participantHtmlLines: string[];
  participantLineMap: ParticipantLineMap;
}) {
  const [scenario, setScenario] = useState<Scenario>("happy");
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ChoreographySnapshot | null>(null);
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
      setExecutionLog((prev) => {
        const next = [...prev, entry];
        return next.slice(-MAX_LOG_ENTRIES);
      });
    },
    [],
  );

  useEffect(() => {
    const el = logScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
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

      const processEvent = (event: ChoreographyEvent) => {
        const ms = elapsed();

        switch (event.type) {
          case "step_started":
            appendLog("info", `[${event.participant}] ${event.message}`, ms);
            break;
          case "step_completed":
            appendLog("success", `[${event.participant}] ${event.message}`, ms);
            break;
          case "step_retrying":
            appendLog("warn", `[${event.participant}] Retrying (attempt ${event.attempt})`, ms);
            break;
          case "event_emitted":
            appendLog("event", `[${event.participant}] Emitted: ${event.event}`, ms);
            break;
          case "event_received":
            appendLog("event", `[${event.participant}] Received: ${event.event}`, ms);
            break;
          case "compensation_started":
            appendLog("compensation", `[${event.participant}] Compensating: ${event.reason}`, ms);
            break;
          case "compensation_completed":
            appendLog("compensation", `[${event.participant}] ${event.message}`, ms);
            break;
          case "sleeping":
            appendLog("sleep", `[${event.participant}] Sleeping ${event.duration}: ${event.reason}`, ms);
            break;
          case "done":
            appendLog(
              event.outcome === "compensated" ? "warn" : "success",
              `Done → ${event.outcome}${event.summary.trackingId ? ` (${event.summary.trackingId})` : ""}`,
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
              processEvent(parsed as ChoreographyEvent);
            }
          }
        }

        if (buffer.trim()) {
          const parsed = parseSseChunk(buffer);
          if (parsed && typeof parsed === "object" && "type" in parsed) {
            processEvent(parsed as ChoreographyEvent);
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

    const failServiceMap: Record<Scenario, string | null> = {
      happy: null,
      inventory_fail: "inventory",
      payment_fail: "payment",
      shipping_fail: "shipping",
    };

    try {
      const res = await fetch("/api/choreography", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: `ORD-${Date.now().toString(36).toUpperCase()}`,
          items: [
            { name: "Widget A", qty: 2 },
            { name: "Widget B", qty: 1 },
            { name: "Widget C", qty: 3 },
          ],
          failService: failServiceMap[scenario],
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

      appendLog("info", `Run started — correlation ${data.orderId}`, 0);
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
    () => getHighlightState(snapshot, flowLineMap, participantLineMap),
    [snapshot, flowLineMap, participantLineMap],
  );

  const firedEvents = useMemo(() => {
    if (!snapshot) return new Set<string>();
    const fired = new Set<string>();
    for (const e of snapshot.eventFlow) {
      fired.add(`${e.from}:${e.event}`);
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
      <StepCard step={1} title="Start Choreography" state={snapshot ? "done" : "active"}>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            ref={startButtonRef}
            onClick={handleStart}
            disabled={isLocked}
            className="cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isStarting ? "Starting..." : "Start"}
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

      {/* Step 2: Event Flow */}
      <StepCard
        step={2}
        title="Event Flow"
        state={!snapshot ? "pending" : snapshot.isTerminal ? "done" : "active"}
      >
        <p
          className="mb-4 text-sm text-gray-900"
          role="status"
          aria-live="polite"
        >
          {snapshot
            ? `${snapshot.eventFlow.length} event${snapshot.eventFlow.length !== 1 ? "s" : ""} emitted${snapshot.isCompensating ? " — compensating" : ""}`
            : "Waiting to start"}
        </p>

        <EventFlowGraph
          snapshot={snapshot}
          firedEvents={firedEvents}
        />

        {/* Participant list */}
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {(snapshot?.participants ?? createInitialParticipants()).map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded border border-gray-400/40 px-3 py-2"
            >
              <span className="text-sm text-gray-1000">{p.label}</span>
              <ParticipantStatusPill status={p.status} />
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
          aria-label="Choreography execution log"
        >
          {executionLog.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-900">
              Start a choreography to stream event-by-event execution updates.
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
      <ChoreographyCodeWorkbench
        leftPane={{
          filename: "workflows/choreography.ts",
          label: WORKFLOW_LABEL,
          code: flowCode,
          htmlLines: flowHtmlLines,
          activeLines: highlightState.flowActiveLines,
          gutterMarks: highlightState.flowGutterMarks,
          tone: highlightState.tone,
        }}
        rightPane={{
          filename: "workflows/participants.ts",
          label: STEP_LABEL,
          code: participantCode,
          htmlLines: participantHtmlLines,
          activeLines: highlightState.participantActiveLines,
          gutterMarks: highlightState.participantGutterMarks,
          tone: highlightState.tone,
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event Flow Graph (SVG)
// ---------------------------------------------------------------------------

function EventFlowGraph({
  snapshot,
  firedEvents,
}: {
  snapshot: ChoreographySnapshot | null;
  firedEvents: Set<string>;
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-gray-400/40 bg-background-100 p-2">
      <svg
        viewBox="0 0 1000 100"
        className="w-full"
        style={{ minWidth: 700 }}
        aria-label="Event-driven choreography flow"
        role="img"
      >
        <defs>
          <marker
            id="arrow"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="currentColor" className="text-gray-500" />
          </marker>
          <marker
            id="arrow-active"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="currentColor" className="text-teal-700" />
          </marker>
          <marker
            id="arrow-red"
            markerWidth="8"
            markerHeight="6"
            refX="8"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="currentColor" className="text-red-700" />
          </marker>
        </defs>

        {/* Edges */}
        {EVENT_EDGES.map((edge) => {
          const from = EVENT_NODES.find((n) => n.id === edge.from);
          const to = EVENT_NODES.find((n) => n.id === edge.to);
          if (!from || !to) return null;

          const edgeKey = `${edge.from}:${edge.event}`;
          const isFired = firedEvents.has(edgeKey);

          let strokeClass = "text-gray-500/40";
          let marker = "url(#arrow)";
          if (isFired) {
            strokeClass = "text-teal-700";
            marker = "url(#arrow-active)";
          }

          const midX = (from.x + 110 + to.x) / 2;
          const midY = from.y + 10;

          return (
            <g key={edgeKey}>
              <line
                x1={from.x + 110}
                y1={from.y + 18}
                x2={to.x - 8}
                y2={to.y + 18}
                stroke="currentColor"
                className={`${strokeClass} transition-colors duration-300`}
                strokeWidth={isFired ? 2 : 1}
                markerEnd={marker}
              />
              {edge.label ? (
                <text
                  x={midX}
                  y={midY}
                  textAnchor="middle"
                  className={`text-[9px] transition-colors duration-300 ${isFired ? "fill-teal-700" : "fill-gray-500"}`}
                  style={{ fontFamily: "var(--font-geist-mono, monospace)" }}
                >
                  {edge.label}
                </text>
              ) : null}
            </g>
          );
        })}

        {/* Nodes */}
        {EVENT_NODES.map((node) => {
          const participantStatus = snapshot?.participants.find(
            (p) => p.id === node.id,
          )?.status;

          const isCurrent = participantStatus === "running";
          const isCompleted = participantStatus === "completed";
          const isFailed = participantStatus === "failed";
          const isCompensating = participantStatus === "compensating";
          const isCompensated = participantStatus === "compensated";

          let fillClass = "fill-background-200";
          let strokeClass = "stroke-gray-500/40";
          let textClass = "fill-gray-900";

          if (isCurrent) {
            fillClass = "fill-teal-700/20";
            strokeClass = "stroke-teal-700";
            textClass = "fill-teal-700";
          } else if (isCompleted) {
            fillClass = "fill-teal-700/10";
            strokeClass = "stroke-teal-700/60";
            textClass = "fill-gray-1000";
          } else if (isFailed) {
            fillClass = "fill-red-700/20";
            strokeClass = "stroke-red-700";
            textClass = "fill-red-700";
          } else if (isCompensating) {
            fillClass = "fill-amber-700/20";
            strokeClass = "stroke-amber-700";
            textClass = "fill-amber-700";
          } else if (isCompensated) {
            fillClass = "fill-red-700/10";
            strokeClass = "stroke-red-700/60";
            textClass = "fill-red-700";
          }

          return (
            <g key={node.id}>
              <rect
                x={node.x}
                y={node.y + 2}
                width={110}
                height={32}
                rx={6}
                className={`${fillClass} ${strokeClass} transition-colors duration-300`}
                strokeWidth={isCurrent ? 2 : 1}
              />
              <text
                x={node.x + 55}
                y={node.y + 22}
                textAnchor="middle"
                className={`${textClass} text-[10px] font-medium transition-colors duration-300`}
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
    case "compensated":
      return "border-red-700/40 bg-red-700/10 text-red-700";
  }
}

function ParticipantStatusPill({ status }: { status: ParticipantStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-xs tabular-nums ${participantBadgeClass(
        status,
      )}`}
    >
      {status}
    </span>
  );
}

function participantBadgeClass(status: ParticipantStatus): string {
  switch (status) {
    case "pending":
      return "border-gray-500/60 bg-gray-500/10 text-gray-900";
    case "running":
      return "border-amber-700/50 bg-amber-700/20 text-amber-700";
    case "completed":
      return "border-green-700/50 bg-green-700/20 text-green-700";
    case "failed":
      return "border-red-700/50 bg-red-700/10 text-red-700";
    case "compensating":
      return "border-amber-700/50 bg-amber-700/20 text-amber-700";
    case "compensated":
      return "border-red-700/50 bg-red-700/10 text-red-700";
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
    case "event":
      return "text-violet-700";
    case "compensation":
      return "text-red-700";
    case "sleep":
      return "text-cyan-700";
  }
}
