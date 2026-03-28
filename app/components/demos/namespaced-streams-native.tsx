// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NamespacedStreamsCodeWorkbench } from "@/namespaced-streams/app/components/namespaced-streams-code-workbench";

type DraftEvent = { type: "chunk"; text: string; idx: number };

type TelemetryEvent =
  | { type: "start"; runId: string; name: string }
  | { type: "tokens"; input: number; output: number }
  | { type: "done"; totalMs: number; totalTokens: number };

type DemoStatus = "idle" | "running" | "completed";

type HighlightTone = "amber" | "violet" | "green" | "red" | "cyan";

type WorkflowLineMap = {
  draftWriteLines: number[];
  telemetryWriteLines: number[];
  telemetryStartLine: number[];
  telemetryDoneLine: number[];
  buildOutlineCall: number[];
  writeSectionsCall: number[];
  returnLine: number[];
};

type StepLineMap = {
  buildOutlineBody: number[];
  writeSectionsBody: number[];
};

type DemoProps = {
  workflowCode: string;
  workflowHtmlLines: string[];
  workflowLineMap: WorkflowLineMap;
  stepCode: string;
  stepHtmlLines: string[];
  stepLineMap: StepLineMap;
};

type DemoState = {
  status: DemoStatus;
  runId: string | null;
  draftEvents: DraftEvent[];
  telemetryEvents: TelemetryEvent[];
  error: string | null;
};

function createInitialState(): DemoState {
  return {
    status: "idle",
    runId: null,
    draftEvents: [],
    telemetryEvents: [],
    error: null,
  };
}

function parseSseChunk<T>(chunk: string): T | null {
  const payload = chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as T;
  } catch {
    return null;
  }
}

function computeTotalTokens(events: TelemetryEvent[]): {
  totalInput: number;
  totalOutput: number;
} {
  let totalInput = 0;
  let totalOutput = 0;
  for (const e of events) {
    if (e.type === "tokens") {
      totalInput += e.input;
      totalOutput += e.output;
    }
  }
  return { totalInput, totalOutput };
}

export function NamespacedStreamsDemo({
  workflowCode,
  workflowHtmlLines,
  workflowLineMap,
  stepCode,
  stepHtmlLines,
  stepLineMap,
}: DemoProps) {
  const [state, setState] = useState<DemoState>(() => createInitialState());
  const abortRef = useRef<AbortController | null>(null);
  const draftScrollRef = useRef<HTMLDivElement>(null);
  const telemetryScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  // Auto-scroll draft pane
  useEffect(() => {
    const el = draftScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.draftEvents.length]);

  // Auto-scroll telemetry pane
  useEffect(() => {
    const el = telemetryScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.telemetryEvents.length]);

  const applyDraftEvent = useCallback((event: DraftEvent) => {
    setState((prev) => {
      const next = { ...prev, draftEvents: [...prev.draftEvents, event] };
      return next;
    });
  }, []);

  const applyTelemetryEvent = useCallback((event: TelemetryEvent) => {
    setState((prev) => {
      const next = {
        ...prev,
        telemetryEvents: [...prev.telemetryEvents, event],
      };
      if (event.type === "done") {
        next.status = "completed";
      }
      return next;
    });
  }, []);

  const connectSse = useCallback(
    async <T,>(
      url: string,
      onEvent: (e: T) => void,
      signal: AbortSignal
    ) => {
      try {
        const res = await fetch(url, {
          headers: { Accept: "text/event-stream" },
          signal,
        });
        if (signal.aborted) return;
        if (!res.ok || !res.body) return;

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
            const event = parseSseChunk<T>(chunk);
            if (event) onEvent(event);
          }
        }
        if (buffer.trim()) {
          const event = parseSseChunk<T>(buffer.replaceAll("\r\n", "\n"));
          if (event) onEvent(event);
        }
      } catch {
        // Abort or network error - ignore.
      }
    },
    []
  );

  const handleStart = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ ...createInitialState(), status: "running" });

    try {
      const res = await fetch("/api/namespaced-streams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: "Durable Workflows" }),
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? "Failed to start");
      }

      const data = (await res.json()) as { runId: string };
      if (controller.signal.aborted) return;

      setState((prev) => ({ ...prev, runId: data.runId }));

      // Connect to single SSE readable stream and route events by namespace
      void connectSse<{ namespace: string; value: DraftEvent | TelemetryEvent }>(
        `/api/readable/${encodeURIComponent(data.runId)}`,
        (event) => {
          if (event.namespace === "draft") {
            applyDraftEvent(event.value as DraftEvent);
          } else if (event.namespace === "telemetry") {
            applyTelemetryEvent(event.value as TelemetryEvent);
          }
        },
        controller.signal
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      const message =
        error instanceof Error ? error.message : "Failed to start";
      setState((prev) => ({ ...prev, status: "idle", error: message }));
    }
  }, [applyDraftEvent, applyTelemetryEvent, connectSse]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(createInitialState());
  }, []);

  // Compute the last telemetry event for determining phase
  const lastTelemetryType = useMemo(() => {
    if (state.telemetryEvents.length === 0) return null;
    return state.telemetryEvents[state.telemetryEvents.length - 1].type;
  }, [state.telemetryEvents]);

  const lastDraftIdx = useMemo(() => {
    if (state.draftEvents.length === 0) return -1;
    return state.draftEvents[state.draftEvents.length - 1].idx;
  }, [state.draftEvents]);

  // Determine which phase we are in for code highlighting
  const phase = useMemo<
    "idle" | "telemetry_start" | "outline" | "sections" | "telemetry_done" | "completed"
  >(() => {
    if (state.status === "idle") return "idle";
    if (state.status === "completed") return "completed";

    // Running phase determination based on event arrival
    if (state.draftEvents.length === 0 && state.telemetryEvents.length === 0) {
      return "telemetry_start";
    }
    if (
      state.telemetryEvents.length > 0 &&
      state.draftEvents.length === 0
    ) {
      return "telemetry_start";
    }
    if (lastDraftIdx === 0 && state.draftEvents.length <= 1) {
      return "outline";
    }
    if (lastTelemetryType === "done") {
      return "telemetry_done";
    }
    return "sections";
  }, [state.status, state.draftEvents.length, state.telemetryEvents.length, lastDraftIdx, lastTelemetryType]);

  // Code workbench state
  const codeState = useMemo(() => {
    const wfMarks: Record<number, "success" | "fail"> = {};
    const stepMarks: Record<number, "success" | "fail"> = {};

    let workflowActiveLines: number[] = [];
    let stepActiveLines: number[] = [];
    let workflowTone: HighlightTone = "amber";
    let stepTone: HighlightTone = "amber";

    if (phase === "idle") {
      return {
        workflowActiveLines: [],
        stepActiveLines: [],
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
        workflowTone: "amber" as HighlightTone,
        stepTone: "amber" as HighlightTone,
      };
    }

    if (phase === "telemetry_start") {
      workflowActiveLines = workflowLineMap.telemetryStartLine;
      workflowTone = "violet";
      stepTone = "violet";
    } else if (phase === "outline") {
      // buildOutline step is running, draft.write happening
      workflowActiveLines = workflowLineMap.buildOutlineCall;
      stepActiveLines = stepLineMap.buildOutlineBody;
      workflowTone = "amber";
      stepTone = "green";

      // Mark telemetry start line as done
      for (const ln of workflowLineMap.telemetryStartLine) wfMarks[ln] = "success";
    } else if (phase === "sections") {
      // writeSections step, alternating draft.write and telemetry.write
      const lastDraftArrived = state.draftEvents.length > 1;
      const lastTelemetryArrived =
        state.telemetryEvents.length > 1 &&
        state.telemetryEvents[state.telemetryEvents.length - 1].type === "tokens";

      if (lastTelemetryArrived && !lastDraftArrived) {
        workflowActiveLines = workflowLineMap.telemetryWriteLines;
        workflowTone = "violet";
      } else {
        workflowActiveLines = workflowLineMap.draftWriteLines;
        workflowTone = "amber";
      }

      stepActiveLines = stepLineMap.writeSectionsBody;
      stepTone = "green";

      // Mark prior phases as done
      for (const ln of workflowLineMap.telemetryStartLine) wfMarks[ln] = "success";
      for (const ln of workflowLineMap.buildOutlineCall) wfMarks[ln] = "success";
      for (const ln of stepLineMap.buildOutlineBody) stepMarks[ln] = "success";
    } else if (phase === "telemetry_done" || phase === "completed") {
      workflowActiveLines = workflowLineMap.returnLine;
      workflowTone = "green";
      stepTone = "green";

      // Mark everything as done
      for (const ln of workflowLineMap.telemetryStartLine) wfMarks[ln] = "success";
      for (const ln of workflowLineMap.buildOutlineCall) wfMarks[ln] = "success";
      for (const ln of workflowLineMap.draftWriteLines) wfMarks[ln] = "success";
      for (const ln of workflowLineMap.telemetryWriteLines) wfMarks[ln] = "success";
      for (const ln of workflowLineMap.writeSectionsCall) wfMarks[ln] = "success";
      for (const ln of workflowLineMap.telemetryDoneLine) wfMarks[ln] = "success";
      for (const ln of workflowLineMap.returnLine) wfMarks[ln] = "success";
      for (const ln of stepLineMap.buildOutlineBody) stepMarks[ln] = "success";
      for (const ln of stepLineMap.writeSectionsBody) stepMarks[ln] = "success";
    }

    return {
      workflowActiveLines,
      stepActiveLines,
      workflowGutterMarks: wfMarks,
      stepGutterMarks: stepMarks,
      workflowTone,
      stepTone,
    };
  }, [phase, state.draftEvents.length, state.telemetryEvents, workflowLineMap, stepLineMap]);

  const tokenSummary = useMemo(
    () => computeTotalTokens(state.telemetryEvents),
    [state.telemetryEvents]
  );

  const isRunning = state.status === "running";
  const isCompleted = state.status === "completed";

  return (
    <div className="space-y-4">
      {state.error && (
        <div
          role="alert"
          className="rounded-lg border border-red-700/40 bg-red-700/10 px-4 py-3 text-sm text-red-700"
        >
          {state.error}
        </div>
      )}

      {/* Controls */}
      <div className="rounded-lg border border-gray-400/70 bg-background-100 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleStart}
            disabled={isRunning}
            className="min-h-10 cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Generate Post
          </button>
          {state.status !== "idle" && (
            <button
              type="button"
              onClick={handleReset}
              className="min-h-10 cursor-pointer rounded-md border border-gray-400 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:border-gray-300 hover:text-gray-1000"
            >
              Reset
            </button>
          )}
          <span className="text-xs font-mono text-gray-900">
            Topic: &quot;Durable Workflows&quot;
          </span>
        </div>
        <p className="mt-2 text-xs text-gray-900">
          {state.status === "idle"
            ? "Ready to generate. Two namespaced streams will update simultaneously."
            : isRunning
              ? "Streaming draft content and telemetry from two namespaces..."
              : "Generation complete. Both streams delivered independently."}
        </p>
      </div>

      {/* Two-pane stream visualization */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* Draft stream pane */}
        <div className="flex flex-col rounded-lg border border-gray-400/60 bg-background-200 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-gray-300 px-3 py-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isRunning && state.draftEvents.length > 0
                  ? "bg-green-700 animate-pulse"
                  : isCompleted
                    ? "bg-green-700"
                    : "bg-gray-500/70"
              }`}
              aria-hidden="true"
            />
            <span className="text-xs font-semibold text-gray-1000">
              draft
            </span>
            <span className="ml-auto rounded-full border border-gray-400 px-2 py-0.5 text-xs font-mono text-gray-900">
              namespace
            </span>
          </div>
          <div
            ref={draftScrollRef}
            className="max-h-[200px] min-h-[120px] overflow-y-auto p-3"
          >
            {state.draftEvents.length === 0 ? (
              <p className="text-xs text-gray-900">
                Waiting for draft chunks...
              </p>
            ) : (
              <div className="space-y-2">
                {state.draftEvents.map((event) => (
                  <div
                    key={event.idx}
                    className="animate-[fadeIn_0.3s_ease-in] rounded border border-gray-300/60 bg-background-100 px-3 py-2"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded bg-green-700/20 px-1.5 py-0.5 text-xs font-mono font-semibold text-green-700">
                        chunk {event.idx}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-xs font-mono leading-relaxed text-gray-1000">
                      {event.text}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Telemetry stream pane */}
        <div className="flex flex-col rounded-lg border border-gray-400/60 bg-background-200 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-gray-300 px-3 py-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isRunning && state.telemetryEvents.length > 0
                  ? "bg-violet-700 animate-pulse"
                  : isCompleted
                    ? "bg-violet-700"
                    : "bg-gray-500/70"
              }`}
              aria-hidden="true"
            />
            <span className="text-xs font-semibold text-gray-1000">
              telemetry
            </span>
            <span className="ml-auto rounded-full border border-gray-400 px-2 py-0.5 text-xs font-mono text-gray-900">
              namespace
            </span>
          </div>
          <div
            ref={telemetryScrollRef}
            className="max-h-[200px] min-h-[120px] overflow-y-auto p-3"
          >
            {state.telemetryEvents.length === 0 ? (
              <p className="text-xs text-gray-900">
                Waiting for telemetry events...
              </p>
            ) : (
              <div className="space-y-1.5">
                {state.telemetryEvents.map((event, i) => (
                  <TelemetryRow key={i} event={event} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Run info bar */}
      {state.runId && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-400/60 bg-background-200 px-3 py-2">
          <span className="text-xs text-gray-900">Run ID:</span>
          <span className="text-xs font-mono text-gray-1000">
            {state.runId}
          </span>
          {isCompleted && (
            <>
              <span className="text-xs text-gray-900">|</span>
              <span className="text-xs text-gray-900">Tokens:</span>
              <span className="text-xs font-mono tabular-nums text-gray-1000">
                {tokenSummary.totalInput + tokenSummary.totalOutput}
              </span>
              <span className="text-xs text-gray-900">|</span>
              <span className="inline-flex items-center rounded-full border border-green-700/40 bg-green-700/15 px-2 py-0.5 text-xs font-semibold text-green-700">
                Completed
              </span>
            </>
          )}
        </div>
      )}

      {/* Code workbench */}
      <NamespacedStreamsCodeWorkbench
        workflowCode={workflowCode}
        workflowHtmlLines={workflowHtmlLines}
        workflowActiveLines={codeState.workflowActiveLines}
        workflowGutterMarks={codeState.workflowGutterMarks}
        workflowTone={codeState.workflowTone}
        stepCode={stepCode}
        stepHtmlLines={stepHtmlLines}
        stepActiveLines={codeState.stepActiveLines}
        stepGutterMarks={codeState.stepGutterMarks}
        stepTone={codeState.stepTone}
      />
    </div>
  );
}

function TelemetryRow({ event }: { event: TelemetryEvent }) {
  if (event.type === "start") {
    return (
      <div className="flex items-center gap-2 rounded border border-violet-700/30 bg-violet-700/10 px-2.5 py-1.5">
        <span className="h-2 w-2 rounded-full bg-violet-700" aria-hidden="true" />
        <span className="text-xs font-semibold text-violet-700">START</span>
        <span className="text-xs font-mono text-gray-1000 truncate">
          {event.name}
        </span>
        <span className="ml-auto text-xs font-mono text-gray-900 truncate">
          {event.runId.slice(0, 20)}...
        </span>
      </div>
    );
  }

  if (event.type === "tokens") {
    const total = event.input + event.output;
    const inputPct = total > 0 ? Math.round((event.input / total) * 100) : 50;

    return (
      <div className="flex items-center gap-2 rounded border border-gray-300/60 bg-background-100 px-2.5 py-1.5">
        <span className="h-2 w-2 rounded-full bg-amber-700" aria-hidden="true" />
        <span className="text-xs font-semibold text-amber-700">TOKENS</span>
        <span className="text-xs font-mono tabular-nums text-gray-1000">
          {event.input} in / {event.output} out
        </span>
        <div className="ml-auto flex h-1.5 w-16 overflow-hidden rounded-full bg-gray-700/60">
          <div
            className="h-full bg-cyan-700"
            style={{ width: `${inputPct}%` }}
          />
          <div
            className="h-full bg-amber-700"
            style={{ width: `${100 - inputPct}%` }}
          />
        </div>
      </div>
    );
  }

  if (event.type === "done") {
    return (
      <div className="flex items-center gap-2 rounded border border-green-700/30 bg-green-700/10 px-2.5 py-1.5">
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-3.5 w-3.5 text-green-700"
          aria-hidden="true"
        >
          <polyline points="3,8.5 7,12.5 14,4.5" />
        </svg>
        <span className="text-xs font-semibold text-green-700">DONE</span>
        <span className="text-xs font-mono tabular-nums text-gray-1000">
          {event.totalTokens} tokens in {(event.totalMs / 1000).toFixed(1)}s
        </span>
      </div>
    );
  }

  return null;
}

const demoProps = {
  workflowCode: "",
  workflowHtmlLines: [],
  workflowLineMap: {},
  stepCode: "",
  stepHtmlLines: [],
  stepLineMap: {},
} as unknown as Parameters<typeof NamespacedStreamsDemo>[0];

export default function NamespacedStreamsNativeDemo() {
  return <NamespacedStreamsDemo {...demoProps} />;
}
