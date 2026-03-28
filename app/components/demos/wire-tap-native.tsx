// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WireTapCodeWorkbench } from "@/wire-tap/app/components/wire-tap-code-workbench";

type StageName = "validate" | "enrich" | "transform" | "deliver";
type DemoStatus = "idle" | "processing" | "done";
type StageStatus = "pending" | "active" | "tapped" | "done";

type WireTapEvent =
  | { type: "stage_start"; stage: string }
  | { type: "tap_captured"; stage: string; snapshot: Record<string, unknown> }
  | { type: "stage_done"; stage: string; durationMs: number }
  | { type: "done"; auditCount: number; totalMs: number };

type StageState = {
  status: StageStatus;
  snapshot: Record<string, unknown> | null;
  durationMs: number;
};

type WireTapState = {
  status: DemoStatus;
  runId: string | null;
  stages: Record<StageName, StageState>;
  auditCount: number;
  totalMs: number | null;
  events: WireTapEvent[];
  error: string | null;
};

type WireTapLineMap = {
  workflowPipelineLine: number;
  workflowDoneLine: number;
  stepStageStartLine: number;
  stepTapLine: number;
  stepStageDoneLine: number;
};

type DemoProps = {
  workflowCode: string;
  workflowLinesHtml: string[];
  stepCode: string;
  stepLinesHtml: string[];
  lineMap: WireTapLineMap;
};

const STAGES: Array<{ id: StageName; label: string }> = [
  { id: "validate", label: "Validate" },
  { id: "enrich", label: "Enrich" },
  { id: "transform", label: "Transform" },
  { id: "deliver", label: "Deliver" },
];

const DEMO_DEFAULTS = {
  orderId: "ORD-7042",
  item: "Ergonomic Keyboard",
  quantity: 3,
};

function createInitialStages(): Record<StageName, StageState> {
  return {
    validate: { status: "pending", snapshot: null, durationMs: 0 },
    enrich: { status: "pending", snapshot: null, durationMs: 0 },
    transform: { status: "pending", snapshot: null, durationMs: 0 },
    deliver: { status: "pending", snapshot: null, durationMs: 0 },
  };
}

function createInitialState(): WireTapState {
  return {
    status: "idle",
    runId: null,
    stages: createInitialStages(),
    auditCount: 0,
    totalMs: null,
    events: [],
    error: null,
  };
}

function isStageName(value: string): value is StageName {
  return value === "validate" || value === "enrich" || value === "transform" || value === "deliver";
}

function parseSseChunk(chunk: string): WireTapEvent | null {
  const payload = chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as WireTapEvent;
  } catch {
    return null;
  }
}

function stageColor(status: StageStatus): string {
  if (status === "done") return "var(--color-green-700)";
  if (status === "tapped") return "var(--color-cyan-700)";
  if (status === "active") return "var(--color-amber-700)";
  return "var(--color-gray-500)";
}

type LogTone = "default" | "green" | "amber" | "cyan";
type LogEntry = { text: string; tone: LogTone };

function eventToLog(event: WireTapEvent, elapsedMs: number): LogEntry {
  const ts = `${(elapsedMs / 1000).toFixed(2)}s`;

  switch (event.type) {
    case "stage_start":
      return { text: `[${ts}] ${event.stage} processing...`, tone: "default" };
    case "tap_captured":
      return { text: `[${ts}] tap: captured ${event.stage} snapshot`, tone: "cyan" };
    case "stage_done":
      return { text: `[${ts}] ${event.stage} done (${event.durationMs}ms)`, tone: "green" };
    case "done":
      return { text: `[${ts}] complete — ${event.auditCount} taps captured in ${event.totalMs}ms`, tone: "green" };
  }
}

const LOG_TONE_CLASS: Record<LogTone, string> = {
  default: "text-gray-900",
  green: "text-green-700",
  amber: "text-amber-700",
  cyan: "text-cyan-700",
};

function StatusBadge({ status }: { status: DemoStatus }) {
  if (status === "done") {
    return (
      <span className="rounded-full bg-green-700/20 px-2 py-0.5 text-xs font-medium text-green-700">
        done
      </span>
    );
  }

  if (status === "processing") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        processing
      </span>
    );
  }

  return (
    <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-900">
      idle
    </span>
  );
}

function StageBadge({ status }: { status: StageStatus }) {
  if (status === "done") {
    return (
      <span className="rounded-full bg-green-700/20 px-2 py-0.5 text-xs font-medium text-green-700">
        done
      </span>
    );
  }

  if (status === "tapped") {
    return (
      <span className="rounded-full bg-cyan-700/20 px-2 py-0.5 text-xs font-medium text-cyan-700">
        tapped
      </span>
    );
  }

  if (status === "active") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        active
      </span>
    );
  }

  return (
    <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-900">
      pending
    </span>
  );
}

export function WireTapDemo({
  workflowCode,
  workflowLinesHtml,
  stepCode,
  stepLinesHtml,
  lineMap,
}: DemoProps) {
  const [state, setState] = useState<WireTapState>(() => createInitialState());
  const [eventLog, setEventLog] = useState<LogEntry[]>([
    { text: "Idle: click Process Order to start the run.", tone: "default" },
    { text: "Each stage taps a message snapshot to the audit channel.", tone: "default" },
  ]);

  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number>(0);

  const activeStage = useMemo((): StageName | null => {
    for (const { id } of STAGES) {
      const s = state.stages[id];
      if (s.status === "active" || s.status === "tapped") return id;
    }
    return null;
  }, [state.stages]);

  const completedCount = useMemo(
    () => STAGES.filter(({ id }) => state.stages[id].status === "done").length,
    [state.stages]
  );

  const activeLines = useMemo(() => {
    if (state.status === "idle") return { workflow: [] as number[], step: [] as number[] };

    if (state.status === "done") {
      return {
        workflow: lineMap.workflowDoneLine > 0 ? [lineMap.workflowDoneLine] : [],
        step: [],
      };
    }

    // Find current stage status to determine step highlight
    const currentStage = activeStage ? state.stages[activeStage] : null;
    let stepLine = lineMap.stepStageStartLine;
    if (currentStage?.status === "tapped") stepLine = lineMap.stepTapLine;

    return {
      workflow: lineMap.workflowPipelineLine > 0 ? [lineMap.workflowPipelineLine] : [],
      step: stepLine > 0 ? [stepLine] : [],
    };
  }, [state.status, state.stages, activeStage, lineMap]);

  const activeTones = useMemo(() => {
    if (state.error) return { workflow: "failure", step: "failure" } as const;
    if (state.status === "done") return { workflow: "success", step: "success" } as const;
    if (state.status === "processing") return { workflow: "active", step: "active" } as const;
    return { workflow: "waiting", step: "waiting" } as const;
  }, [state.error, state.status]);

  const gutterMarks = useMemo(() => {
    const marks: Record<number, "success"> = {};
    if (state.status === "done" && lineMap.workflowDoneLine > 0) {
      marks[lineMap.workflowDoneLine] = "success";
    }
    return marks;
  }, [state.status, lineMap.workflowDoneLine]);

  const applyEvent = useCallback((event: WireTapEvent) => {
    const elapsedMs = Date.now() - startedAtRef.current;
    setEventLog((prev) => [...prev, eventToLog(event, elapsedMs)]);

    setState((prev) => {
      const next: WireTapState = { ...prev, events: [...prev.events, event] };
      const stages = { ...prev.stages };

      if (event.type === "stage_start" && isStageName(event.stage)) {
        stages[event.stage] = { ...stages[event.stage], status: "active" };
        next.stages = stages;
      } else if (event.type === "tap_captured" && isStageName(event.stage)) {
        stages[event.stage] = {
          ...stages[event.stage],
          status: "tapped",
          snapshot: event.snapshot,
        };
        next.stages = stages;
      } else if (event.type === "stage_done" && isStageName(event.stage)) {
        stages[event.stage] = {
          ...stages[event.stage],
          status: "done",
          durationMs: event.durationMs,
        };
        next.stages = stages;
      } else if (event.type === "done") {
        next.status = "done";
        next.auditCount = event.auditCount;
        next.totalMs = event.totalMs;
      }

      return next;
    });
  }, []);

  const connectToStream = useCallback(
    async (runId: string, signal: AbortSignal) => {
      try {
        const response = await fetch(
          `/api/readable/${encodeURIComponent(runId)}`,
          { cache: "no-store", signal }
        );

        if (signal.aborted) return;

        if (!response.ok || !response.body) {
          const data = await response.json().catch(() => null) as { error?: string } | null;
          throw new Error(data?.error ?? `Stream failed: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.replaceAll("\r\n", "\n").split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const chunk of chunks) {
            if (signal.aborted) return;
            const event = parseSseChunk(chunk);
            if (event) applyEvent(event);
          }
        }

        if (!signal.aborted && buffer.trim()) {
          const event = parseSseChunk(buffer.replaceAll("\r\n", "\n"));
          if (event) applyEvent(event);
        }
      } catch (error) {
        if (signal.aborted) return;
        if (error instanceof Error && error.name === "AbortError") return;

        setState((prev) => ({
          ...prev,
          status: prev.status === "done" ? "done" : "idle",
          error: error instanceof Error ? error.message : "Stream failed",
        }));
      }
    },
    [applyEvent]
  );

  const handleStart = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ ...createInitialState(), status: "processing" });
    setEventLog([]);
    startedAtRef.current = Date.now();

    try {
      const response = await fetch("/api/wire-tap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(DEMO_DEFAULTS),
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error ?? `Start failed: ${response.status}`);
      }

      const data = (await response.json()) as { runId: string };

      if (controller.signal.aborted) return;

      setState((prev) => ({ ...prev, runId: data.runId }));
      setEventLog([
        { text: `[0.00s] order ${DEMO_DEFAULTS.orderId} queued`, tone: "default" },
        { text: "[0.00s] wire tap attached to 4 processing stages", tone: "cyan" },
      ]);

      void connectToStream(data.runId, controller.signal);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof Error && error.name === "AbortError") return;

      setState((prev) => ({
        ...prev,
        status: "idle",
        error: error instanceof Error ? error.message : "Failed to start",
      }));
    }
  }, [connectToStream]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(createInitialState());
    setEventLog([
      { text: "Idle: click Process Order to start the run.", tone: "default" },
      { text: "Each stage taps a message snapshot to the audit channel.", tone: "default" },
    ]);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const isRunning = state.status === "processing";

  return (
    <div className="space-y-6">
      {state.error && (
        <div
          role="alert"
          className="rounded-lg border border-red-700/40 bg-red-700/10 px-4 py-3 text-sm text-red-700"
        >
          {state.error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-gray-400 bg-background-100 p-4">
          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => { void handleStart(); }}
                disabled={isRunning}
                className="cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Process Order
              </button>

              <button
                type="button"
                onClick={handleReset}
                disabled={!state.runId}
                className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                  state.runId
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
            {state.status === "idle" && "Waiting to start. Click Process Order to run the workflow."}
            {state.status === "processing" && activeStage && `Processing: ${activeStage} stage active — wire tap capturing message snapshot.`}
            {state.status === "processing" && !activeStage && "Processing order through pipeline stages..."}
            {state.status === "done" && `Completed: ${state.auditCount} wire tap snapshots captured across all stages.`}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-gray-400 bg-background-100 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-900">
              Workflow Phase
            </span>
            <StatusBadge status={state.status} />
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">runId</span>
              <code className="font-mono text-xs text-gray-1000">
                {state.runId ?? "not started"}
              </code>
            </div>
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">Stages Completed</span>
              <span className="font-mono text-gray-1000">
                {completedCount}/{STAGES.length}
              </span>
            </div>
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">Audit Taps</span>
              <span className="font-mono text-gray-1000">
                {state.auditCount || completedCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <WireTapGraph stages={state.stages} status={state.status} />
        <StageStatusList stages={state.stages} />
      </div>

      <div className="rounded-md border border-gray-400 bg-background-100 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
          Execution Log
        </p>
        <ol className="space-y-1 font-mono text-xs">
          {eventLog.map((entry, index) => (
            <li key={`${entry.text}-${index}`} className={LOG_TONE_CLASS[entry.tone]}>
              {entry.text}
            </li>
          ))}
        </ol>
      </div>

      <p className="text-center text-xs italic text-gray-900">
        Wire Tap: each processing stage copies a message snapshot to the audit channel without altering the main flow.
      </p>

      <WireTapCodeWorkbench
        workflowCode={workflowCode}
        workflowLinesHtml={workflowLinesHtml}
        stepCode={stepCode}
        stepLinesHtml={stepLinesHtml}
        activeLines={activeLines}
        activeTones={activeTones}
        gutterMarks={gutterMarks}
      />
    </div>
  );
}

function WireTapGraph({
  stages,
  status,
}: {
  stages: Record<StageName, StageState>;
  status: DemoStatus;
}) {
  const stageNodes: Array<{ id: StageName; x: number; y: number; label: string }> = [
    { id: "validate", x: 80, y: 65, label: "Validate" },
    { id: "enrich", x: 180, y: 65, label: "Enrich" },
    { id: "transform", x: 280, y: 65, label: "Transform" },
    { id: "deliver", x: 380, y: 65, label: "Deliver" },
  ];

  const tapY = 175;

  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Wire Tap Flow
      </p>

      <svg
        viewBox="0 0 460 220"
        role="img"
        aria-label="Wire tap message flow graph"
        className="h-auto w-full"
      >
        <rect x={0} y={0} width={460} height={220} fill="var(--color-background-100)" rx={8} />

        {/* Main pipeline arrows */}
        {stageNodes.map((node, i) => {
          if (i === 0) return null;
          const prev = stageNodes[i - 1];
          return (
            <line
              key={`arrow-${node.id}`}
              x1={prev.x + 22}
              y1={prev.y}
              x2={node.x - 22}
              y2={node.y}
              stroke="var(--color-gray-500)"
              strokeWidth={2}
              markerEnd="url(#arrowhead)"
            />
          );
        })}

        {/* Tap lines to audit channel */}
        {stageNodes.map((node) => {
          const s = stages[node.id];
          const tapped = s.status === "tapped" || s.status === "done";
          return (
            <line
              key={`tap-${node.id}`}
              x1={node.x}
              y1={node.y + 22}
              x2={node.x}
              y2={tapY - 14}
              stroke={tapped ? "var(--color-cyan-700)" : "var(--color-gray-500)"}
              strokeWidth={1.5}
              strokeDasharray={tapped ? undefined : "4 3"}
              opacity={tapped ? 1 : 0.4}
            />
          );
        })}

        {/* Stage nodes */}
        {stageNodes.map((node) => {
          const s = stages[node.id];
          const color = stageColor(s.status);

          return (
            <g key={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                r={20}
                fill="var(--color-background-200)"
                stroke={color}
                strokeWidth={2.5}
              />
              <text
                x={node.x}
                y={node.y + 4}
                textAnchor="middle"
                className="fill-gray-1000 font-mono text-[10px]"
              >
                {node.label.slice(0, 3).toUpperCase()}
              </text>
            </g>
          );
        })}

        {/* Audit channel bar */}
        <rect
          x={50}
          y={tapY - 12}
          width={360}
          height={24}
          rx={6}
          fill="var(--color-background-200)"
          stroke="var(--color-cyan-700)"
          strokeWidth={1.5}
          opacity={0.7}
        />
        <text
          x={230}
          y={tapY + 4}
          textAnchor="middle"
          className="fill-cyan-700 font-mono text-[10px] font-semibold"
        >
          AUDIT CHANNEL (wire tap)
        </text>

        {/* Tap dots on audit bar */}
        {stageNodes.map((node) => {
          const s = stages[node.id];
          const tapped = s.status === "tapped" || s.status === "done";
          if (!tapped) return null;
          return (
            <circle
              key={`dot-${node.id}`}
              cx={node.x}
              cy={tapY}
              r={4}
              fill="var(--color-cyan-700)"
            />
          );
        })}

        {/* Hub indicator */}
        <text
          x={230}
          y={210}
          textAnchor="middle"
          className={`font-mono text-[10px] font-semibold ${
            status === "done" ? "fill-green-700" : status === "processing" ? "fill-amber-700" : "fill-gray-500"
          }`}
        >
          {status === "done" ? "ALL TAPS CAPTURED" : status === "processing" ? "TAPPING..." : "READY"}
        </text>

        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="var(--color-gray-500)" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}

function StageStatusList({ stages }: { stages: Record<StageName, StageState> }) {
  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Stage Results
      </p>
      <ul className="space-y-2">
        {STAGES.map(({ id, label }) => {
          const stage = stages[id];
          return (
            <li
              key={id}
              className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm text-gray-1000">{label}</span>
                <StageBadge status={stage.status} />
              </div>
              {stage.snapshot && (
                <p className="mt-1 truncate text-xs text-cyan-700 font-mono">
                  tap: {JSON.stringify(stage.snapshot).slice(0, 80)}
                  {JSON.stringify(stage.snapshot).length > 80 ? "..." : ""}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const demoProps = {
  workflowCode: "",
  workflowLinesHtml: [],
  stepCode: "",
  stepLinesHtml: [],
  lineMap: {},
} as unknown as Parameters<typeof WireTapDemo>[0];

export default function WireTapNativeDemo() {
  return <WireTapDemo {...demoProps} />;
}
