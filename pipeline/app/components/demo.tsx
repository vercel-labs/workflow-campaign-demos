"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PipelineCodeWorkbench } from "@/components/pipeline-code-workbench";
import type { PipelineEvent } from "@/workflows/pipeline";

const STEP_NAMES = ["Extract", "Transform", "Validate", "Load"] as const;

type DemoStatus = "idle" | "running" | "completed";

type PipelineDemoState = {
  status: DemoStatus;
  runId: string | null;
  currentStep: number;
  stepProgress: number;
  events: PipelineEvent[];
  error: string | null;
};

type PipelineLineMap = {
  workflowLoopLine: number;
  workflowStepLines: number[];
  workflowDoneLine: number;
  stepStartLine: number;
  stepProgressLine: number;
  stepDoneLine: number;
  stepPipelineDoneLine: number;
};

type PipelineDemoProps = {
  workflowCode: string;
  workflowLinesHtml: string[];
  stepCode: string;
  stepLinesHtml: string[];
  lineMap: PipelineLineMap;
  workflowDirective: string;
  stepDirective: string;
};

function createInitialState(): PipelineDemoState {
  return {
    status: "idle",
    runId: null,
    currentStep: -1,
    stepProgress: 0,
    events: [],
    error: null,
  };
}

function parseSseChunk(chunk: string): PipelineEvent | null {
  const payload = chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) {
    return null;
  }

  try {
    return JSON.parse(payload) as PipelineEvent;
  } catch {
    return null;
  }
}

function stepIndexFromName(step: string): number {
  return STEP_NAMES.indexOf(step as (typeof STEP_NAMES)[number]);
}

function statusCopy(state: PipelineDemoState): string {
  if (state.status === "idle") {
    return "Ready to run the ETL pipeline and stream progress updates.";
  }

  if (state.status === "running") {
    return "Streaming step updates from the pipeline in real time.";
  }

  return "Pipeline finished. Every step emitted updates via a writable stream.";
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
    return <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-amber-700" aria-hidden="true" />;
  }

  return <span className="h-2.5 w-2.5 rounded-full bg-gray-500/70" aria-hidden="true" />;
}

export function PipelineDemo({
  workflowCode,
  workflowLinesHtml,
  stepCode,
  stepLinesHtml,
  lineMap,
  workflowDirective,
  stepDirective,
}: PipelineDemoProps) {
  const [state, setState] = useState<PipelineDemoState>(() => createInitialState());
  const [totalMs, setTotalMs] = useState<number | null>(null);
  const [resetKey, setResetKey] = useState(0);

  const abortRef = useRef<AbortController | null>(null);

  const completedSteps = useMemo(() => {
    const done = new Set<number>();
    for (const event of state.events) {
      if (event.type === "step_done") {
        done.add(event.index);
      }
    }
    return done;
  }, [state.events]);

  const completedCount = completedSteps.size;

  const activeLines = useMemo(() => {
    if (state.status === "idle") {
      return { workflow: [] as number[], step: [] as number[] };
    }

    if (state.status === "completed") {
      return {
        workflow:
          lineMap.workflowDoneLine > 0 ? [lineMap.workflowDoneLine] : [],
        step: lineMap.stepPipelineDoneLine > 0 ? [lineMap.stepPipelineDoneLine] : [],
      };
    }

    const activeStepLine =
      state.stepProgress >= 100
        ? lineMap.stepDoneLine
        : state.stepProgress > 0
          ? lineMap.stepProgressLine
          : lineMap.stepStartLine;

    return {
      workflow:
        lineMap.workflowLoopLine > 0 ? [lineMap.workflowLoopLine] : [],
      step: activeStepLine > 0 ? [activeStepLine] : [],
    };
  }, [lineMap, state.status, state.stepProgress]);

  const activeTones = useMemo(() => {
    if (state.error) {
      return { workflow: "failure", step: "failure" } as const;
    }

    if (state.status === "completed") {
      return { workflow: "success", step: "success" } as const;
    }

    if (state.status === "running" && state.currentStep < 0) {
      return { workflow: "waiting", step: "waiting" } as const;
    }

    return { workflow: "active", step: "active" } as const;
  }, [state.currentStep, state.error, state.status]);

  const gutterMarks = useMemo(() => {
    const marks: Record<number, "success" | "fail"> = {};

    for (const event of state.events) {
      if (event.type !== "step_done") {
        continue;
      }

      const line = lineMap.workflowStepLines[event.index];
      if (line && line > 0) {
        marks[line] = "success";
      }
    }

    if (state.error && lineMap.workflowLoopLine > 0) {
      marks[lineMap.workflowLoopLine] = "fail";
    }

    return marks;
  }, [lineMap.workflowLoopLine, lineMap.workflowStepLines, state.error, state.events]);

  const latestMessage = useMemo(() => {
    for (let i = state.events.length - 1; i >= 0; i -= 1) {
      const event = state.events[i];
      if (event.type === "step_progress") {
        return event.message;
      }
    }

    return "";
  }, [state.events]);

  const applyEvent = useCallback((event: PipelineEvent) => {
    setState((prev) => {
      const next: PipelineDemoState = {
        ...prev,
        events: [...prev.events, event],
      };

      switch (event.type) {
        case "step_start": {
          next.currentStep = event.index;
          next.stepProgress = 0;
          next.status = "running";
          break;
        }
        case "step_progress": {
          const idx = stepIndexFromName(event.step);
          if (idx >= 0) {
            next.currentStep = idx;
          }
          next.stepProgress = event.percent;
          next.status = "running";
          break;
        }
        case "step_done": {
          next.currentStep = event.index;
          next.stepProgress = 100;
          next.status = "running";
          break;
        }
        case "pipeline_done": {
          next.currentStep = STEP_NAMES.length - 1;
          next.stepProgress = 100;
          next.status = "completed";
          break;
        }
        default: {
          break;
        }
      }

      return next;
    });

    if (event.type === "pipeline_done") {
      setTotalMs(event.totalMs);
    }
  }, []);

  const connectToStream = useCallback(
    async (runId: string, signal: AbortSignal) => {
      try {
        const response = await fetch(
          `/api/readable/${encodeURIComponent(runId)}`,
          {
            method: "GET",
            headers: { Accept: "text/event-stream" },
            signal,
          }
        );

        if (signal.aborted) {
          return;
        }

        if (!response.ok || !response.body) {
          let message = "Failed to connect to stream";
          try {
            const data = (await response.json()) as { error?: string };
            if (data.error) {
              message = data.error;
            }
          } catch {
            // Ignore invalid JSON errors.
          }
          throw new Error(message);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.replaceAll("\r\n", "\n").split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const chunk of chunks) {
            const event = parseSseChunk(chunk);
            if (event) {
              applyEvent(event);
            }
          }
        }

        if (buffer.trim().length > 0) {
          const event = parseSseChunk(buffer.replaceAll("\r\n", "\n"));
          if (event) {
            applyEvent(event);
          }
        }
      } catch (error) {
        if (signal.aborted) {
          return;
        }

        const message =
          error instanceof Error ? error.message : "Stream connection failed";

        setState((prev) => ({
          ...prev,
          status: prev.status === "completed" ? "completed" : "idle",
          error: message,
        }));
      }
    },
    [applyEvent]
  );

  const handleStart = useCallback(async () => {
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    setTotalMs(null);
    setState({
      ...createInitialState(),
      status: "running",
    });

    try {
      const response = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: `doc-${Date.now()}` }),
        signal: controller.signal,
      });

      if (controller.signal.aborted) {
        return;
      }

      if (!response.ok) {
        let message = "Failed to start pipeline";
        try {
          const data = (await response.json()) as { error?: string };
          if (data.error) {
            message = data.error;
          }
        } catch {
          // Ignore invalid JSON errors.
        }
        throw new Error(message);
      }

      const data = (await response.json()) as { runId: string };

      if (controller.signal.aborted) {
        return;
      }

      setState((prev) => ({
        ...prev,
        runId: data.runId,
      }));

      void connectToStream(data.runId, controller.signal);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }

      const message =
        error instanceof Error ? error.message : "Failed to start pipeline";

      setState((prev) => ({
        ...prev,
        status: "idle",
        error: message,
      }));
    }
  }, [connectToStream]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setTotalMs(null);
    setState(createInitialState());
    setResetKey((value) => value + 1);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-400 bg-background-200 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleStart}
            disabled={state.status === "running"}
            className="cursor-pointer rounded-md bg-blue-700 px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start Pipeline
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="cursor-pointer rounded-md border border-gray-400 px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:border-gray-300 hover:text-gray-1000"
          >
            Reset
          </button>
          <span className="text-xs font-mono text-gray-900">
            Run ID: {state.runId ?? "—"}
          </span>
        </div>

        <p className="mt-3 text-xs text-gray-900">{statusCopy(state)}</p>
        {latestMessage ? (
          <p className="mt-1 text-xs font-mono text-gray-900">{latestMessage}</p>
        ) : null}
        {state.error ? (
          <p className="mt-2 text-xs text-red-700">{state.error}</p>
        ) : null}

        {state.status === "completed" && totalMs !== null ? (
          <div className="mt-3 inline-flex items-center rounded-full border border-green-700/40 bg-green-700/15 px-3 py-1 text-xs font-semibold text-green-700">
            Pipeline Complete in {totalMs}ms
          </div>
        ) : null}

        <div className="mt-4 max-h-[250px] space-y-2 overflow-y-auto pr-1">
          {STEP_NAMES.map((stepName, index) => {
            const completed = completedSteps.has(index);
            const active =
              state.status === "running" &&
              state.currentStep === index &&
              !completed;
            const progress = completed
              ? 100
              : active
                ? state.stepProgress
                : 0;

            return (
              <div
                key={stepName}
                className={`rounded-md border px-3 py-2 transition-colors ${
                  completed
                    ? "border-green-700/40 bg-green-700/10"
                    : active
                      ? "border-amber-700/50 bg-amber-700/10"
                      : "border-gray-300 bg-background-100/60 opacity-70"
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <StepStatusIcon completed={completed} active={active} />
                    <span
                      className={`text-xs font-semibold ${
                        completed
                          ? "text-green-700"
                          : active
                            ? "text-amber-700"
                            : "text-gray-900"
                      }`}
                    >
                      {stepName}
                    </span>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-gray-900">
                    {progress}%
                  </span>
                </div>

                <div className="h-1.5 w-full rounded-full bg-gray-700/60">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-200 ${
                      completed ? "bg-green-700" : active ? "bg-amber-700" : "bg-gray-500"
                    }`}
                    style={{ width: `${progress}%` }}
                    aria-hidden="true"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-gray-900">
          {completedCount}/{STEP_NAMES.length} steps completed
        </p>
      </div>

      <PipelineCodeWorkbench
        workflowLinesHtml={workflowLinesHtml}
        stepLinesHtml={stepLinesHtml}
        workflowCode={workflowCode}
        stepCode={stepCode}
        workflowDirective={workflowDirective}
        stepDirective={stepDirective}
        activeLines={activeLines}
        activeTones={activeTones}
        gutterMarks={gutterMarks}
        resetKey={resetKey}
      />
    </div>
  );
}
