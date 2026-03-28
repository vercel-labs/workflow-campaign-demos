// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RoutingSlipCodeWorkbench } from "@/routing-slip/components/routing-slip-code-workbench";

type SlipStage = "inventory" | "payment" | "packaging" | "shipping" | "notification";

type SlipEvent =
  | { type: "stage_start"; stage: SlipStage; index: number }
  | { type: "stage_complete"; stage: SlipStage; index: number; message: string; durationMs: number }
  | { type: "done"; totalMs: number; stageCount: number };

type StageState = {
  stage: SlipStage;
  status: "pending" | "running" | "completed";
  message?: string;
  durationMs?: number;
};

type DemoStatus = "idle" | "running" | "completed";
type OrderType = "standard" | "digital";

export type RoutingSlipLineMap = {
  workflowLoopLine: number;
  workflowProcessLine: number;
  workflowReturnLine: number;
  stepDelayLine: number;
  stepReturnLine: number;
  stepMessageLines: Record<SlipStage, number>;
};

type RoutingSlipDemoProps = {
  workflowCode: string;
  workflowLinesHtml: string[];
  stepCode: string;
  stepLinesHtml: string[];
  lineMap: RoutingSlipLineMap;
};

const ORDER_SLIPS: Record<OrderType, SlipStage[]> = {
  standard: ["inventory", "payment", "packaging", "shipping", "notification"],
  digital: ["inventory", "payment", "notification"],
};

const STAGE_LABELS: Record<SlipStage, string> = {
  inventory: "Inventory",
  payment: "Payment",
  packaging: "Packaging",
  shipping: "Shipping",
  notification: "Notification",
};

const SLIP_DESCRIPTION: Record<OrderType, string> = {
  standard: "Inventory → Payment → Packaging → Shipping → Notification",
  digital: "Inventory → Payment → Notification",
};

function formatMs(durationMs: number | null): string {
  if (durationMs === null || durationMs < 0) return "0ms";
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function stageIcon(stage: SlipStage, colorClass: string) {
  switch (stage) {
    case "inventory":
      return (
        <svg className={`h-4 w-4 ${colorClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9-4 9 4-9 4-9-4z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10l9 4 9-4V7" />
        </svg>
      );
    case "payment":
      return (
        <svg className={`h-4 w-4 ${colorClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18" />
        </svg>
      );
    case "packaging":
      return (
        <svg className={`h-4 w-4 ${colorClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l8 4-8 4-8-4 8-4z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6v8l8 4 8-4V6" />
        </svg>
      );
    case "shipping":
      return (
        <svg className={`h-4 w-4 ${colorClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h11v8H3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4l3 3v2h-7z" />
          <circle cx="7.5" cy="17.5" r="1.5" />
          <circle cx="17.5" cy="17.5" r="1.5" />
        </svg>
      );
    case "notification":
      return (
        <svg className={`h-4 w-4 ${colorClass}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 17a2 2 0 004 0" />
        </svg>
      );
  }
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

function isSlipEvent(value: unknown): value is SlipEvent {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  return (
    obj.type === "stage_start" ||
    obj.type === "stage_complete" ||
    obj.type === "done"
  );
}

export function RoutingSlipDemo({
  workflowCode,
  workflowLinesHtml,
  stepCode,
  stepLinesHtml,
  lineMap,
}: RoutingSlipDemoProps) {
  const [status, setStatus] = useState<DemoStatus>("idle");
  const [orderType, setOrderType] = useState<OrderType>("standard");
  const [runId, setRunId] = useState<string | null>(null);
  const [stages, setStages] = useState<StageState[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [totalMs, setTotalMs] = useState<number | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const resetDemo = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setRunId(null);
    setStages([]);
    setError(null);
    setTotalMs(null);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const startRun = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = null;

    const slip = ORDER_SLIPS[orderType];
    const orderId = `ORDER-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;

    setError(null);
    setTotalMs(null);
    setStages(slip.map((stage) => ({ stage, status: "pending" })));

    try {
      const response = await fetch("/api/routing-slip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, slip }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          typeof payload?.error === "string" ? payload.error : "Failed to start"
        );
      }

      const payload = (await response.json()) as { runId: string };
      setRunId(payload.runId);
      setStatus("running");

      // Connect to SSE stream
      const controller = new AbortController();
      abortRef.current = controller;
      connectSse(payload.runId, controller.signal);
    } catch (runError) {
      setStatus("idle");
      setRunId(null);
      setStages([]);
      setError(runError instanceof Error ? runError.message : "Failed to start run");
    }
  }, [orderType]);

  const connectSse = useCallback(
    (rid: string, signal: AbortSignal) => {
      (async () => {
        try {
          const res = await fetch(`/api/readable/${encodeURIComponent(rid)}`, { signal });
          if (!res.ok || !res.body) {
            throw new Error("Stream unavailable");
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const chunks = buffer.replaceAll("\r\n", "\n").split("\n\n");
            buffer = chunks.pop() ?? "";

            for (const chunk of chunks) {
              const event = parseSseChunk(chunk);
              if (isSlipEvent(event)) {
                handleEvent(event);
              }
            }
          }

          // Process remaining buffer
          if (buffer.trim()) {
            const event = parseSseChunk(buffer);
            if (isSlipEvent(event)) {
              handleEvent(event);
            }
          }
        } catch (err) {
          if (signal.aborted) return;
          setError(err instanceof Error ? err.message : "Stream error");
          setStatus("idle");
        }
      })();
    },
    []
  );

  const handleEvent = useCallback((event: SlipEvent) => {
    switch (event.type) {
      case "stage_start":
        setStages((prev) =>
          prev.map((s, i) =>
            i === event.index ? { ...s, status: "running" } : s
          )
        );
        break;

      case "stage_complete":
        setStages((prev) =>
          prev.map((s, i) =>
            i === event.index
              ? { ...s, status: "completed", message: event.message, durationMs: event.durationMs }
              : s
          )
        );
        break;

      case "done":
        setTotalMs(event.totalMs);
        setStatus("completed");
        break;
    }
  }, []);

  const activeStage = useMemo(() => {
    return stages.find((s) => s.status === "running")?.stage;
  }, [stages]);

  const activeLines = useMemo(() => {
    if (status === "idle") {
      return { workflow: [] as number[], step: [] as number[] };
    }

    if (status === "completed") {
      return {
        workflow: [lineMap.workflowReturnLine],
        step: [lineMap.stepReturnLine],
      };
    }

    const stepLines = [lineMap.stepDelayLine];
    if (activeStage) {
      const messageLine = lineMap.stepMessageLines[activeStage];
      if (messageLine > 0) stepLines.push(messageLine);
    }

    return {
      workflow: [lineMap.workflowLoopLine, lineMap.workflowProcessLine],
      step: stepLines,
    };
  }, [activeStage, lineMap, status]);

  const gutterMarks = useMemo(() => {
    const workflowMarks: Record<number, boolean> = {};
    const stepMarks: Record<number, boolean> = {};

    if (stages.some((s) => s.status === "completed")) {
      workflowMarks[lineMap.workflowProcessLine] = true;
    }

    if (status === "completed") {
      workflowMarks[lineMap.workflowReturnLine] = true;
      stepMarks[lineMap.stepReturnLine] = true;
    }

    for (const s of stages) {
      if (s.status !== "completed") continue;
      const lineNumber = lineMap.stepMessageLines[s.stage];
      if (lineNumber > 0) stepMarks[lineNumber] = true;
    }

    return { workflow: workflowMarks, step: stepMarks };
  }, [lineMap, stages, status]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-400 bg-background-200 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-gray-900" htmlFor="order-type">
            Order Type
          </label>
          <select
            id="order-type"
            value={orderType}
            onChange={(event) => setOrderType(event.target.value as OrderType)}
            disabled={status === "running"}
            className="min-w-[140px] rounded-md border border-gray-400 bg-background-100 px-2 py-1 text-xs text-gray-1000 outline-none focus:border-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="standard">Standard</option>
            <option value="digital">Digital</option>
          </select>

          <button
            type="button"
            onClick={() => void startRun()}
            disabled={status === "running"}
            className="cursor-pointer rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Process Order
          </button>

          <button
            type="button"
            onClick={resetDemo}
            disabled={status === "idle"}
            className="cursor-pointer rounded-md border border-gray-400 px-3 py-1.5 text-xs font-semibold text-gray-900 transition-colors hover:border-gray-300 hover:text-gray-1000 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset
          </button>

          <span className="font-mono text-xs text-gray-900">{SLIP_DESCRIPTION[orderType]}</span>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-700/50 bg-red-700/10 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      {status === "completed" ? (
        <div className="rounded-md border border-green-700/50 bg-green-700/10 px-3 py-2 text-sm text-green-700">
          Order Fulfilled in {formatMs(totalMs)}.
        </div>
      ) : null}

      <div className="rounded-lg border border-gray-400 bg-background-200 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-1000">Routing Slip Progress</h3>
          <span className="text-xs text-gray-900 font-mono">
            {runId ? `run ${runId}` : "waiting"}
          </span>
        </div>

        <div className="max-h-[250px] space-y-2 overflow-y-auto pr-1">
          {stages.length === 0 ? (
            <div className="rounded-md border border-dashed border-gray-400 px-3 py-2 text-xs text-gray-900">
              Start a run to see stage-by-stage execution.
            </div>
          ) : (
            stages.map((s) => {
              const isRunning = s.status === "running";
              const isCompleted = s.status === "completed";

              const rowClass = isCompleted
                ? "border-green-700/50 bg-green-700/10"
                : isRunning
                  ? "border-amber-700/50 bg-amber-700/10"
                  : "border-gray-400 bg-background-100 opacity-65";

              const iconColor = isCompleted
                ? "text-green-700"
                : isRunning
                  ? "text-amber-700"
                  : "text-gray-900";

              return (
                <div
                  key={s.stage}
                  className={`flex min-h-8 items-center justify-between rounded-md border px-3 py-1.5 text-xs ${rowClass}`}
                >
                  <div className="flex items-center gap-2">
                    {stageIcon(s.stage, iconColor)}
                    <span className="font-medium text-gray-1000">{STAGE_LABELS[s.stage]}</span>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-gray-900">{s.status}</span>
                    {isCompleted ? (
                      <svg
                        className="h-3.5 w-3.5 text-green-700"
                        fill="none"
                        viewBox="0 0 16 16"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3,8.5 7,12.5 14,4.5" />
                      </svg>
                    ) : isRunning ? (
                      <span className="h-2 w-2 animate-pulse rounded-full bg-amber-700" aria-hidden="true" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-gray-500" aria-hidden="true" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <p className="mt-3 text-xs text-gray-900">
          {status === "idle"
            ? "Idle: waiting to start an order."
            : status === "running"
              ? "Running: each stage reads the slip, executes, and hands off to the next."
              : "Completed: every listed stage finished in order."}
        </p>
      </div>

      <RoutingSlipCodeWorkbench
        workflowCode={workflowCode}
        workflowLinesHtml={workflowLinesHtml}
        stepCode={stepCode}
        stepLinesHtml={stepLinesHtml}
        activeLines={activeLines}
        gutterMarks={gutterMarks}
        completed={status === "completed"}
      />
    </div>
  );
}

const demoProps = {
  workflowCode: "",
  workflowLinesHtml: [],
  stepCode: "",
  stepLinesHtml: [],
  lineMap: {},
} as unknown as Parameters<typeof RoutingSlipDemo>[0];

export default function RoutingSlipNativeDemo() {
  return <RoutingSlipDemo {...demoProps} />;
}
