"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ESCodeWorkbench } from "./es-code-workbench";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type CommandType =
  | "CreateOrder"
  | "AuthorizePayment"
  | "ReserveInventory"
  | "ShipOrder"
  | "CancelOrder";

type DomainEvent =
  | { kind: "OrderCreated"; orderId: string; timestamp: number }
  | { kind: "PaymentAuthorized"; orderId: string; amount: number; timestamp: number }
  | { kind: "InventoryReserved"; orderId: string; sku: string; timestamp: number }
  | { kind: "OrderShipped"; orderId: string; trackingId: string; timestamp: number }
  | { kind: "OrderCancelled"; orderId: string; reason: string; timestamp: number };

type Projection = {
  orderId: string;
  status: "none" | "created" | "authorized" | "reserved" | "shipped" | "cancelled";
  paymentAuthorized: boolean;
  inventoryReserved: boolean;
  trackingId: string | null;
};

type ESEvent =
  | { type: "command_endpoint_ready"; aggregateId: string }
  | { type: "command_received"; command: CommandType; aggregateId: string }
  | { type: "event_appended"; event: DomainEvent; index: number }
  | { type: "projection_updated"; projection: Projection }
  | { type: "invalid_command"; command: CommandType; reason: string }
  | { type: "replay_started"; eventCount: number }
  | { type: "replay_progress"; index: number; event: DomainEvent; projection: Projection }
  | { type: "replay_completed"; projection: Projection }
  | { type: "done"; eventLog: DomainEvent[]; projection: Projection };

type LifecycleState = "idle" | "processing" | "replaying" | "done";
type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail";

type LogTone = "default" | "green" | "amber" | "red" | "cyan";
type LogEntry = { text: string; tone: LogTone };

type AccumulatorState = {
  aggregateId: string;
  eventLog: DomainEvent[];
  projection: Projection;
  invalidCommands: Array<{ command: CommandType; reason: string }>;
  replayProjection: Projection | null;
  replayProgress: number;
  replayTotal: number;
};

type StartResponse = {
  runId: string;
  aggregateId: string;
  commands: CommandType[];
  status: string;
};

type WorkflowLineMap = {
  commandLoop: number[];
  replayCall: number[];
  finalizeCall: number[];
};

type StepLineMap = {
  processCommands: number[];
  replayEventLog: number[];
  finalizeAggregate: number[];
};

type DemoProps = {
  workflowCode: string;
  workflowHtmlLines: string[];
  stepCode: string;
  stepHtmlLines: string[];
  workflowLineMap: WorkflowLineMap;
  stepLineMap: StepLineMap;
};

const COMMANDS: Array<{ id: CommandType; label: string }> = [
  { id: "CreateOrder", label: "Create Order" },
  { id: "AuthorizePayment", label: "Authorize Payment" },
  { id: "ReserveInventory", label: "Reserve Inventory" },
  { id: "ShipOrder", label: "Ship Order" },
  { id: "CancelOrder", label: "Cancel Order" },
];

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
    aggregateId: "",
    eventLog: [],
    projection: {
      orderId: "",
      status: "none",
      paymentAuthorized: false,
      inventoryReserved: false,
      trackingId: null,
    },
    invalidCommands: [],
    replayProjection: null,
    replayProgress: 0,
    replayTotal: 0,
  };
}

function applyEvent(acc: AccumulatorState, event: ESEvent): AccumulatorState {
  switch (event.type) {
    case "command_endpoint_ready":
      return { ...acc, aggregateId: event.aggregateId };

    case "command_received":
      return acc;

    case "event_appended":
      return { ...acc, eventLog: [...acc.eventLog, event.event] };

    case "projection_updated":
      return { ...acc, projection: event.projection };

    case "invalid_command":
      return {
        ...acc,
        invalidCommands: [
          ...acc.invalidCommands,
          { command: event.command, reason: event.reason },
        ],
      };

    case "replay_started":
      return { ...acc, replayTotal: event.eventCount, replayProgress: 0 };

    case "replay_progress":
      return {
        ...acc,
        replayProgress: event.index + 1,
        replayProjection: event.projection,
      };

    case "replay_completed":
      return { ...acc, replayProjection: event.projection };

    case "done":
      return acc;

    default:
      return acc;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function EventSourcingDemo({
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
    { text: "Idle: select commands and click Start Aggregate.", tone: "default" },
  ]);

  const [selectedCommands, setSelectedCommands] = useState<CommandType[]>([
    "CreateOrder",
    "AuthorizePayment",
    "ReserveInventory",
    "ShipOrder",
  ]);

  const accRef = useRef<AccumulatorState>(createAccumulator());
  const [snapshot, setSnapshot] = useState<AccumulatorState | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasScrolledRef = useRef(false);

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

  /* -- Connect to SSE stream -- */
  const connectSse = useCallback(
    async (targetRunId: string, signal: AbortSignal) => {
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
            const event = parsed as ESEvent;

            const updated = applyEvent(accRef.current, event);
            accRef.current = updated;
            setSnapshot({ ...updated });

            const ts = formatElapsedMs(Date.now() - startMs);
            const logEntry = eventToLogEntry(event, ts);
            if (logEntry) {
              setEventLog((prev) => [...prev, logEntry]);
            }

            if (event.type === "command_endpoint_ready") {
              setLifecycle("processing");
            }

            if (event.type === "replay_started") {
              setLifecycle("replaying");
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
    [stopElapsedTimer]
  );

  const handleStart = useCallback(async () => {
    setError(null);
    abortRef.current?.abort();
    abortRef.current = null;
    stopElapsedTimer();

    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;

    try {
      const res = await fetch("/api/event-sourcing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aggregateId: `order-${Date.now()}`,
          commands: selectedCommands,
        }),
        signal,
      });

      const payload = (await res.json()) as StartResponse;
      if (!res.ok) {
        throw new Error((payload as unknown as { error?: string }).error ?? `Request failed (${res.status})`);
      }
      if (signal.aborted) return;

      setRunId(payload.runId);
      setLifecycle("processing");
      setElapsedMs(0);
      setEventLog([
        { text: `[0.00s] aggregate ${payload.aggregateId} started`, tone: "default" },
        { text: `[0.00s] processing ${payload.commands.length} commands`, tone: "default" },
      ]);

      void connectSse(payload.runId, signal);
    } catch (startError) {
      if (signal.aborted || (startError instanceof Error && startError.name === "AbortError")) return;
      setError(startError instanceof Error ? startError.message : "Failed to start");
      setLifecycle("idle");
    }
  }, [connectSse, stopElapsedTimer, selectedCommands]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopElapsedTimer();
    setLifecycle("idle");
    setRunId(null);
    setSnapshot(null);
    setElapsedMs(0);
    setError(null);
    setEventLog([
      { text: "Idle: select commands and click Start Aggregate.", tone: "default" },
    ]);
    accRef.current = createAccumulator();
    setTimeout(() => startButtonRef.current?.focus(), 0);
  }, [stopElapsedTimer]);

  const toggleCommand = useCallback((cmd: CommandType) => {
    setSelectedCommands((prev) => {
      if (prev.includes(cmd)) return prev.filter((c) => c !== cmd);
      return [...prev, cmd];
    });
  }, []);

  const isRunning = lifecycle === "processing" || lifecycle === "replaying";

  /* -- Phase explanation -- */
  const phaseExplainer = useMemo(() => {
    if (lifecycle === "idle") return "Select commands and click Start Aggregate to run the workflow.";
    if (lifecycle === "processing") {
      const appended = snapshot?.eventLog.length ?? 0;
      const rejected = snapshot?.invalidCommands.length ?? 0;
      return `Processing commands: ${appended} events appended, ${rejected} rejected.`;
    }
    if (lifecycle === "replaying") {
      const progress = snapshot?.replayProgress ?? 0;
      const total = snapshot?.replayTotal ?? 0;
      return `Replaying event log: ${progress}/${total} events replayed.`;
    }
    if (lifecycle === "done" && snapshot) {
      return `Done: ${snapshot.eventLog.length} events, projection status: ${snapshot.projection.status}.`;
    }
    return "Run complete.";
  }, [lifecycle, snapshot]);

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

    if (lifecycle === "processing") {
      return {
        tone: "amber" as HighlightTone,
        workflowActiveLines: workflowLineMap.commandLoop,
        stepActiveLines: stepLineMap.processCommands,
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    if (lifecycle === "replaying") {
      return {
        tone: "cyan" as HighlightTone,
        workflowActiveLines: workflowLineMap.replayCall,
        stepActiveLines: stepLineMap.replayEventLog,
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    // done
    const hasInvalid = snapshot.invalidCommands.length > 0;
    for (const ln of workflowLineMap.commandLoop) wfMarks[ln] = hasInvalid ? "fail" : "success";
    for (const ln of workflowLineMap.replayCall) wfMarks[ln] = "success";
    for (const ln of stepLineMap.processCommands) stepMarks[ln] = hasInvalid ? "fail" : "success";
    for (const ln of stepLineMap.replayEventLog) stepMarks[ln] = "success";

    return {
      tone: (hasInvalid ? "red" : "green") as HighlightTone,
      workflowActiveLines: workflowLineMap.finalizeCall,
      stepActiveLines: stepLineMap.finalizeAggregate,
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
            disabled={isRunning || selectedCommands.length === 0}
            className="min-h-10 cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start Aggregate
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
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-900">Commands</span>
          {COMMANDS.map((cmd) => {
            const isSelected = selectedCommands.includes(cmd.id);
            return (
              <button
                key={cmd.id}
                type="button"
                disabled={isRunning}
                onClick={() => toggleCommand(cmd.id)}
                className={`cursor-pointer rounded px-2 py-0.5 text-xs font-mono transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  isSelected
                    ? "bg-cyan-700/20 text-cyan-700 border border-cyan-700/40"
                    : "bg-background-200 text-gray-900 border border-gray-400/70"
                }`}
              >
                {cmd.label}
              </button>
            );
          })}
        </div>
        <div className="mt-1 px-1 text-[11px] text-gray-900">
          Toggle commands to include in the batch. Invalid sequences will be rejected.
        </div>
      </div>

      {/* Status + Event Log */}
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
              <span className="text-gray-900">Events Appended</span>
              <span className="font-mono text-gray-1000">{snapshot?.eventLog.length ?? 0}</span>
            </div>
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">Projection Status</span>
              <ProjectionBadge status={snapshot?.projection.status ?? "none"} />
            </div>
          </div>

          {(snapshot?.invalidCommands.length ?? 0) > 0 && (
            <div className="rounded-md border border-red-700/40 bg-red-700/5 px-3 py-2">
              <p className="text-xs font-semibold text-red-700 mb-1">Rejected Commands</p>
              {snapshot!.invalidCommands.map((ic, i) => (
                <p key={i} className="text-xs text-red-700">
                  {ic.command}: {ic.reason}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-400/70 bg-background-100 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
            Event Graph
          </p>
          <EventGraph
            events={snapshot?.eventLog ?? []}
            projection={snapshot?.projection ?? null}
            lifecycle={lifecycle}
            replayProgress={snapshot?.replayProgress ?? 0}
          />
        </div>
      </div>

      {/* Execution Log */}
      <div className="rounded-md border border-gray-400 bg-background-100 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
          Execution Log
        </p>
        <ExecutionLog entries={eventLog} />
      </div>

      <p className="text-center text-xs italic text-gray-900">
        Append events now, rebuild state later — event sourcing with durable workflows
      </p>

      {/* Code Workbench */}
      <ESCodeWorkbench
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

function eventToLogEntry(event: ESEvent, ts: string): LogEntry | null {
  switch (event.type) {
    case "command_endpoint_ready":
      return { text: `[${ts}] command endpoint ready — aggregate ${event.aggregateId}`, tone: "default" };
    case "command_received":
      return { text: `[${ts}] command received: ${event.command}`, tone: "cyan" };
    case "event_appended":
      return { text: `[${ts}] event appended: ${event.event.kind} (index ${event.index})`, tone: "green" };
    case "projection_updated":
      return { text: `[${ts}] projection updated: status=${event.projection.status}`, tone: "green" };
    case "invalid_command":
      return { text: `[${ts}] rejected: ${event.command} — ${event.reason}`, tone: "red" };
    case "replay_started":
      return { text: `[${ts}] replay started — ${event.eventCount} events to replay`, tone: "cyan" };
    case "replay_progress":
      return { text: `[${ts}] replay #${event.index + 1}: ${event.event.kind} → status=${event.projection.status}`, tone: "amber" };
    case "replay_completed":
      return { text: `[${ts}] replay completed — projection: ${event.projection.status}`, tone: "green" };
    case "done":
      return { text: `[${ts}] done — ${event.eventLog.length} events, final status: ${event.projection.status}`, tone: "green" };
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

function ExecutionLog({ entries }: { entries: LogEntry[] }) {
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

function ProjectionBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    none: "bg-gray-500/10 text-gray-900",
    created: "bg-cyan-700/20 text-cyan-700",
    authorized: "bg-amber-700/20 text-amber-700",
    reserved: "bg-blue-700/20 text-blue-700",
    shipped: "bg-green-700/20 text-green-700",
    cancelled: "bg-red-700/20 text-red-700",
  };

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? colors.none}`}>
      {status}
    </span>
  );
}

const EVENT_KIND_SHORT: Record<string, string> = {
  OrderCreated: "Created",
  PaymentAuthorized: "Paid",
  InventoryReserved: "Reserved",
  OrderShipped: "Shipped",
  OrderCancelled: "Cancelled",
};

function eventKindColor(kind: string): string {
  if (kind === "OrderCreated") return "var(--color-cyan-700)";
  if (kind === "PaymentAuthorized") return "var(--color-amber-700)";
  if (kind === "InventoryReserved") return "var(--color-blue-700)";
  if (kind === "OrderShipped") return "var(--color-green-700)";
  if (kind === "OrderCancelled") return "var(--color-red-700)";
  return "var(--color-gray-500)";
}

function EventGraph({
  events,
  projection,
  lifecycle,
  replayProgress,
}: {
  events: DomainEvent[];
  projection: Projection | null;
  lifecycle: LifecycleState;
  replayProgress: number;
}) {
  const maxEvents = 5;
  const displayEvents = events.slice(0, maxEvents);
  const nodeSpacing = 52;
  const startX = 30;
  const y = 60;
  const projX = startX + maxEvents * nodeSpacing + 30;
  const svgWidth = projX + 70;

  return (
    <svg
      viewBox={`0 0 ${svgWidth} 120`}
      role="img"
      aria-label="Event sourcing timeline graph"
      className="h-auto w-full"
    >
      <rect x={0} y={0} width={svgWidth} height={120} fill="var(--color-background-100)" rx={8} />

      {/* Connecting lines (behind nodes) */}
      {displayEvents.map((event, i) => {
        if (i === 0) return null;
        const x = startX + i * nodeSpacing;
        const color = eventKindColor(event.kind);
        const isReplaying = lifecycle === "replaying" && i === replayProgress - 1;
        return (
          <line
            key={`line-${i}`}
            x1={startX + (i - 1) * nodeSpacing}
            y1={y}
            x2={x}
            y2={y}
            stroke={color}
            strokeWidth={2}
            strokeDasharray={isReplaying ? "4 3" : undefined}
            className={isReplaying ? "animate-pulse" : undefined}
          />
        );
      })}

      {/* Event nodes (on top of lines) */}
      {displayEvents.map((event, i) => {
        const x = startX + i * nodeSpacing;
        const color = eventKindColor(event.kind);
        const isReplayed = lifecycle === "replaying" && i < replayProgress;

        return (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              r={16}
              fill="var(--color-background-200)"
              stroke={color}
              strokeWidth={isReplayed ? 3 : 2}
            />
            <text
              x={x}
              y={y + 4}
              textAnchor="middle"
              className="fill-gray-1000 font-mono"
              style={{ fontSize: "9px" }}
            >
              {EVENT_KIND_SHORT[event.kind] ?? event.kind.slice(0, 4)}
            </text>
            <text
              x={x}
              y={y + 30}
              textAnchor="middle"
              className="fill-gray-900 font-mono"
              style={{ fontSize: "8px" }}
            >
              #{i + 1}
            </text>
          </g>
        );
      })}

      {/* Empty slots */}
      {Array.from({ length: maxEvents - displayEvents.length }).map((_, i) => {
        const x = startX + (displayEvents.length + i) * nodeSpacing;
        return (
          <g key={`empty-${i}`}>
            <circle
              cx={x}
              cy={y}
              r={16}
              fill="none"
              stroke="var(--color-gray-500)"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          </g>
        );
      })}

      {/* Arrow to projection */}
      {displayEvents.length > 0 && (
        <line
          x1={startX + (displayEvents.length - 1) * nodeSpacing + 18}
          y1={y}
          x2={projX - 22}
          y2={y}
          stroke={
            lifecycle === "done"
              ? "var(--color-green-700)"
              : "var(--color-gray-500)"
          }
          strokeWidth={2}
          strokeDasharray={lifecycle === "replaying" ? "4 3" : undefined}
          markerEnd="url(#arrowhead)"
        />
      )}

      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon
            points="0 0, 8 3, 0 6"
            fill={lifecycle === "done" ? "var(--color-green-700)" : "var(--color-gray-500)"}
          />
        </marker>
      </defs>

      {/* Projection node */}
      <rect
        x={projX - 20}
        y={y - 18}
        width={40}
        height={36}
        rx={6}
        fill="var(--color-background-200)"
        stroke={
          lifecycle === "done"
            ? "var(--color-green-700)"
            : lifecycle !== "idle"
              ? "var(--color-amber-700)"
              : "var(--color-gray-500)"
        }
        strokeWidth={2}
      />
      <text
        x={projX}
        y={y + 4}
        textAnchor="middle"
        className="font-mono font-semibold"
        style={{ fontSize: "8px" }}
        fill={
          lifecycle === "done"
            ? "var(--color-green-700)"
            : lifecycle !== "idle"
              ? "var(--color-amber-700)"
              : "var(--color-gray-500)"
        }
      >
        {projection?.status ?? "none"}
      </text>

      {/* Labels */}
      <text x={startX} y={16} className="fill-gray-900 font-mono" style={{ fontSize: "9px" }}>
        Event Log
      </text>
      <text x={projX - 12} y={16} className="fill-gray-900 font-mono" style={{ fontSize: "9px" }}>
        Projection
      </text>
    </svg>
  );
}
