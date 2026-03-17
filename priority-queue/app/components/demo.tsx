"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QueueCodeWorkbench } from "./queue-code-workbench";

type Priority = "urgent" | "high" | "medium" | "low";
type RunStatus = "queued" | "sorting" | "processing" | "done";
type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail" | "retry";

type TaskItem = {
  id: string;
  label: string;
  priority: Priority;
};

type QueueEvent =
  | { type: "tasks_received"; count: number; priorities: Record<Priority, number> }
  | { type: "sorting"; strategy: string }
  | { type: "sorted"; order: string[] }
  | { type: "processing_task"; taskId: string; priority: Priority; position: number }
  | { type: "task_complete"; taskId: string; priority: Priority; result: string }
  | { type: "done"; processed: number; summary: Record<Priority, number> };

type QueueAccumulator = {
  runId: string;
  status: RunStatus;
  taskCount: number;
  sortedOrder: string[];
  processedTasks: Array<{ taskId: string; priority: Priority; result: string }>;
  currentTask: { taskId: string; priority: Priority; position: number } | null;
  summary: Record<Priority, number> | null;
};

type QueueSnapshot = QueueAccumulator & {
  elapsedMs: number;
};

type StartResponse = {
  runId: string;
  taskCount: number;
  status: "queued";
};

export type WorkflowLineMap = {
  receive: number[];
  sort: number[];
  process: number[];
  done: number[];
};

export type StepLineMap = {
  sortTasks: number[];
  processTask: number[];
};

type DemoProps = {
  workflowCode: string;
  workflowLinesHtml: string[];
  stepCode: string;
  stepLinesHtml: string[];
  workflowLineMap: WorkflowLineMap;
  stepLineMap: StepLineMap;
};

type HighlightState = {
  workflowActiveLines: number[];
  stepActiveLines: number[];
  workflowGutterMarks: Record<number, GutterMarkKind>;
  stepGutterMarks: Record<number, GutterMarkKind>;
};

const ELAPSED_TICK_MS = 120;

const PRIORITY_COLORS: Record<Priority, string> = {
  urgent: "var(--color-red-700)",
  high: "var(--color-amber-700)",
  medium: "var(--color-blue-700)",
  low: "var(--color-green-700)",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const SAMPLE_TASKS: TaskItem[] = [
  { id: "TASK-01", label: "Deploy hotfix to production", priority: "urgent" },
  { id: "TASK-02", label: "Review security audit report", priority: "high" },
  { id: "TASK-03", label: "Update API documentation", priority: "medium" },
  { id: "TASK-04", label: "Refactor logging module", priority: "low" },
  { id: "TASK-05", label: "Patch CVE-2025-1234", priority: "urgent" },
  { id: "TASK-06", label: "Optimize database queries", priority: "high" },
  { id: "TASK-07", label: "Add unit tests for auth", priority: "medium" },
  { id: "TASK-08", label: "Clean up stale branches", priority: "low" },
];

function parseSseData(rawChunk: string): string {
  return rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
}

function parseQueueEvent(rawChunk: string): QueueEvent | null {
  const payload = parseSseData(rawChunk);
  if (!payload) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;

  const event = parsed as Record<string, unknown>;
  const type = event.type;

  if (type === "tasks_received" && typeof event.count === "number") {
    return { type, count: event.count, priorities: event.priorities as Record<Priority, number> };
  }
  if (type === "sorting" && typeof event.strategy === "string") {
    return { type, strategy: event.strategy };
  }
  if (type === "sorted" && Array.isArray(event.order)) {
    return { type, order: event.order as string[] };
  }
  if (type === "processing_task" && typeof event.taskId === "string" && typeof event.priority === "string" && typeof event.position === "number") {
    return { type, taskId: event.taskId, priority: event.priority as Priority, position: event.position };
  }
  if (type === "task_complete" && typeof event.taskId === "string" && typeof event.priority === "string" && typeof event.result === "string") {
    return { type, taskId: event.taskId, priority: event.priority as Priority, result: event.result };
  }
  if (type === "done" && typeof event.processed === "number") {
    return { type, processed: event.processed, summary: event.summary as Record<Priority, number> };
  }

  return null;
}

function createAccumulator(start: StartResponse): QueueAccumulator {
  return {
    runId: start.runId,
    status: "queued",
    taskCount: start.taskCount,
    sortedOrder: [],
    processedTasks: [],
    currentTask: null,
    summary: null,
  };
}

function applyQueueEvent(current: QueueAccumulator, event: QueueEvent): QueueAccumulator {
  switch (event.type) {
    case "tasks_received":
      return current;
    case "sorting":
      return { ...current, status: "sorting" };
    case "sorted":
      return { ...current, sortedOrder: event.order };
    case "processing_task":
      return {
        ...current,
        status: "processing",
        currentTask: { taskId: event.taskId, priority: event.priority, position: event.position },
      };
    case "task_complete":
      return {
        ...current,
        processedTasks: [...current.processedTasks, { taskId: event.taskId, priority: event.priority, result: event.result }],
        currentTask: null,
      };
    case "done":
      return { ...current, status: "done", summary: event.summary };
  }
}

function toSnapshot(accumulator: QueueAccumulator, startedAtMs: number): QueueSnapshot {
  return {
    ...accumulator,
    elapsedMs: Math.max(0, Date.now() - startedAtMs),
  };
}

const EMPTY_HIGHLIGHT_STATE: HighlightState = {
  workflowActiveLines: [],
  stepActiveLines: [],
  workflowGutterMarks: {},
  stepGutterMarks: {},
};

function buildHighlightState(
  snapshot: QueueSnapshot | null,
  workflowLineMap: WorkflowLineMap,
  stepLineMap: StepLineMap
): HighlightState {
  if (!snapshot) return EMPTY_HIGHLIGHT_STATE;

  const workflowGutterMarks: Record<number, GutterMarkKind> = {};
  const stepGutterMarks: Record<number, GutterMarkKind> = {};

  if (snapshot.status === "sorting") {
    return {
      workflowActiveLines: workflowLineMap.sort,
      stepActiveLines: stepLineMap.sortTasks,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (snapshot.status === "processing") {
    for (const line of workflowLineMap.sort.slice(0, 1)) {
      workflowGutterMarks[line] = "success";
    }
    for (const line of stepLineMap.sortTasks.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }

    return {
      workflowActiveLines: workflowLineMap.process,
      stepActiveLines: stepLineMap.processTask,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (snapshot.status === "done") {
    for (const line of workflowLineMap.done.slice(0, 1)) {
      workflowGutterMarks[line] = "success";
    }
    for (const line of stepLineMap.sortTasks.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }
    for (const line of stepLineMap.processTask.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }

    return {
      workflowActiveLines: [],
      stepActiveLines: [],
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  return EMPTY_HIGHLIGHT_STATE;
}

function highlightToneForSnapshot(snapshot: QueueSnapshot | null): HighlightTone {
  if (!snapshot) return "amber";
  if (snapshot.status === "sorting") return "cyan";
  if (snapshot.status === "processing") return "amber";
  return "green";
}

type LogTone = "default" | "green" | "amber" | "red" | "cyan";
type LogEntry = { text: string; tone: LogTone };

function formatElapsedMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function eventToLogEntry(event: QueueEvent, elapsedMs: number): LogEntry {
  const ts = formatElapsedMs(elapsedMs);

  switch (event.type) {
    case "tasks_received":
      return { text: `[${ts}] ${event.count} tasks received — urgent:${event.priorities.urgent} high:${event.priorities.high} medium:${event.priorities.medium} low:${event.priorities.low}`, tone: "default" };
    case "sorting":
      return { text: `[${ts}] sorting by priority (${event.strategy})...`, tone: "cyan" };
    case "sorted":
      return { text: `[${ts}] sorted order: ${event.order.join(" → ")}`, tone: "cyan" };
    case "processing_task":
      return { text: `[${ts}] [#${event.position}] processing ${event.taskId} (${event.priority})`, tone: "amber" };
    case "task_complete":
      return { text: `[${ts}] ${event.taskId} complete: ${event.result}`, tone: "green" };
    case "done":
      return { text: `[${ts}] done — ${event.processed} tasks processed`, tone: "green" };
  }
}

const IDLE_LOG: LogEntry[] = [
  { text: "Idle: click Run Queue to process tasks by priority.", tone: "default" },
  { text: "Tasks are sorted: urgent → high → medium → low, then processed in order.", tone: "default" },
];

const LOG_TONE_CLASS: Record<LogTone, string> = {
  default: "text-gray-900",
  green: "text-green-700",
  amber: "text-amber-700",
  red: "text-red-700",
  cyan: "text-cyan-700",
};

async function postJson<TResponse>(
  url: string,
  body: unknown,
  signal?: AbortSignal
): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed: ${response.status}`);
  }

  return payload as TResponse;
}

function statusExplanation(
  status: RunStatus | "idle",
  processedCount: number,
  totalCount: number
): string {
  if (status === "idle") {
    return "Waiting to start. Click Run Queue to process tasks by priority.";
  }
  if (status === "sorting") {
    return "Sorting: ordering tasks by priority level (urgent first, low last).";
  }
  if (status === "processing") {
    return `Processing: ${processedCount} of ${totalCount} tasks complete.`;
  }
  return `Completed: all ${totalCount} tasks processed in priority order.`;
}

export function PriorityQueueDemo({
  workflowCode,
  workflowLinesHtml,
  stepCode,
  stepLinesHtml,
  workflowLineMap,
  stepLineMap,
}: DemoProps) {
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<QueueSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<LogEntry[]>(IDLE_LOG);

  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const accumulatorRef = useRef<QueueAccumulator | null>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const hasScrolledRef = useRef(false);

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

  const stopElapsedTicker = useCallback(() => {
    if (!elapsedRef.current) return;
    clearInterval(elapsedRef.current);
    elapsedRef.current = null;
  }, []);

  const startElapsedTicker = useCallback(() => {
    stopElapsedTicker();
    elapsedRef.current = setInterval(() => {
      const startedAtMs = startedAtRef.current;
      if (!startedAtMs) return;
      setSnapshot((previous) => {
        if (!previous || previous.status === "done") return previous;
        return { ...previous, elapsedMs: Math.max(0, Date.now() - startedAtMs) };
      });
    }, ELAPSED_TICK_MS);
  }, [stopElapsedTicker]);

  const ensureAbortController = useCallback((): AbortController => {
    if (!abortRef.current || abortRef.current.signal.aborted) {
      abortRef.current = new AbortController();
    }
    return abortRef.current;
  }, []);

  useEffect(() => {
    return () => {
      stopElapsedTicker();
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [stopElapsedTicker]);

  const connectToReadable = useCallback(
    async (start: StartResponse) => {
      const controller = ensureAbortController();
      const signal = controller.signal;

      try {
        const response = await fetch(
          `/api/readable/${encodeURIComponent(start.runId)}`,
          { cache: "no-store", signal }
        );

        if (signal.aborted) return;

        if (!response.ok || !response.body) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? `Readable stream request failed: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const applyEvent = (event: QueueEvent) => {
          if (signal.aborted || !startedAtRef.current || !accumulatorRef.current) return;
          const elapsedMs = Math.max(0, Date.now() - startedAtRef.current);
          const nextAccumulator = applyQueueEvent(accumulatorRef.current, event);
          accumulatorRef.current = nextAccumulator;
          setSnapshot(toSnapshot(nextAccumulator, startedAtRef.current));
          setEventLog((prev) => [...prev, eventToLogEntry(event, elapsedMs)]);
          if (nextAccumulator.status === "done") {
            stopElapsedTicker();
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const normalized = buffer.replaceAll("\r\n", "\n");
          const chunks = normalized.split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const chunk of chunks) {
            if (signal.aborted) return;
            const event = parseQueueEvent(chunk);
            if (event) applyEvent(event);
          }
        }

        if (!signal.aborted && buffer.trim()) {
          const event = parseQueueEvent(buffer.replaceAll("\r\n", "\n"));
          if (event) applyEvent(event);
        }
      } catch (cause: unknown) {
        if (cause instanceof Error && cause.name === "AbortError") return;
        if (signal.aborted) return;
        const detail = cause instanceof Error ? cause.message : "Readable stream failed";
        setError(detail);
        stopElapsedTicker();
      } finally {
        if (accumulatorRef.current?.status === "done") {
          stopElapsedTicker();
        }
      }
    },
    [ensureAbortController, stopElapsedTicker]
  );

  const handleStart = async () => {
    setError(null);
    setSnapshot(null);
    setRunId(null);
    setEventLog([]);

    stopElapsedTicker();
    abortRef.current?.abort();
    abortRef.current = null;
    startedAtRef.current = null;
    accumulatorRef.current = null;

    try {
      const controller = ensureAbortController();
      const payload = await postJson<StartResponse>(
        "/api/priority-queue",
        { tasks: SAMPLE_TASKS },
        controller.signal
      );
      if (controller.signal.aborted) return;

      const startedAt = Date.now();
      const nextAccumulator = createAccumulator(payload);
      startedAtRef.current = startedAt;
      accumulatorRef.current = nextAccumulator;
      setRunId(payload.runId);
      setSnapshot(toSnapshot(nextAccumulator, startedAt));
      setEventLog([
        { text: `[0.00s] ${payload.taskCount} tasks submitted to priority queue`, tone: "default" },
      ]);

      if (controller.signal.aborted) return;

      startElapsedTicker();
      void connectToReadable(payload);
    } catch (cause: unknown) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      const detail = cause instanceof Error ? cause.message : "Unknown error";
      setError(detail);
    }
  };

  const handleReset = () => {
    stopElapsedTicker();
    abortRef.current?.abort();
    abortRef.current = null;
    startedAtRef.current = null;
    accumulatorRef.current = null;
    setRunId(null);
    setSnapshot(null);
    setError(null);
    setEventLog(IDLE_LOG);
    setTimeout(() => { startButtonRef.current?.focus(); }, 0);
  };

  const effectiveStatus: RunStatus | "idle" = snapshot?.status ?? (runId ? "queued" : "idle");
  const isRunning = runId !== null && snapshot?.status !== "done";

  const highlights = useMemo(
    () => buildHighlightState(snapshot, workflowLineMap, stepLineMap),
    [snapshot, workflowLineMap, stepLineMap]
  );
  const highlightTone = useMemo(
    () => highlightToneForSnapshot(snapshot),
    [snapshot]
  );

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-700/40 bg-red-700/10 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-gray-400 bg-background-100 p-4">
          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
              Task Queue
            </p>
            <ul className="space-y-1.5">
              {SAMPLE_TASKS.map((task) => {
                const isProcessed = snapshot?.processedTasks.some((p) => p.taskId === task.id) ?? false;
                const isCurrent = snapshot?.currentTask?.taskId === task.id;

                return (
                  <li
                    key={task.id}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                      isProcessed
                        ? "border-green-700/40 bg-green-700/10 text-gray-1000"
                        : isCurrent
                          ? "border-amber-700/40 bg-amber-700/10 text-gray-1000"
                          : "border-gray-400/70 bg-background-100 text-gray-900"
                    }`}
                  >
                    <span
                      className="inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${PRIORITY_COLORS[task.priority]} 20%, transparent)`,
                        color: PRIORITY_COLORS[task.priority],
                      }}
                    >
                      {PRIORITY_LABELS[task.priority]}
                    </span>
                    <span className="font-mono text-xs text-gray-900">{task.id}</span>
                    <span className="flex-1">{task.label}</span>
                    {isProcessed && <span className="text-xs text-green-700">done</span>}
                    {isCurrent && <span className="text-xs text-amber-700 animate-pulse">processing</span>}
                  </li>
                );
              })}
            </ul>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                ref={startButtonRef}
                onClick={() => { void handleStart(); }}
                disabled={isRunning}
                className="cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Run Queue
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
          </div>

          <div
            className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2 text-xs text-gray-900"
            role="status"
            aria-live="polite"
          >
            {statusExplanation(
              effectiveStatus,
              snapshot?.processedTasks.length ?? 0,
              snapshot?.taskCount ?? SAMPLE_TASKS.length
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-gray-400 bg-background-100 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-900">
              Queue Status
            </span>
            <RunStatusBadge status={effectiveStatus} />
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
              <span className="text-gray-900">Processed</span>
              <span className="font-mono text-gray-1000">
                {snapshot?.processedTasks.length ?? 0} / {snapshot?.taskCount ?? SAMPLE_TASKS.length}
              </span>
            </div>
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">Current Task</span>
              <span className="font-mono text-gray-1000">
                {snapshot?.currentTask
                  ? `${snapshot.currentTask.taskId} (${snapshot.currentTask.priority})`
                  : "none"}
              </span>
            </div>
          </div>

          {snapshot?.status === "done" && snapshot.summary && (
            <div className="rounded-md border border-green-700/40 bg-green-700/10 px-3 py-2">
              <p className="text-xs text-green-700">
                All tasks processed — urgent:{snapshot.summary.urgent} high:{snapshot.summary.high} medium:{snapshot.summary.medium} low:{snapshot.summary.low}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <PriorityGraph
          processedTasks={snapshot?.processedTasks ?? []}
          currentTask={snapshot?.currentTask ?? null}
          status={effectiveStatus}
        />
        <ProcessedTasksList
          processedTasks={snapshot?.processedTasks ?? []}
          status={effectiveStatus}
        />
      </div>

      <div className="rounded-md border border-gray-400 bg-background-100 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
          Execution Log
        </p>
        <ol className="space-y-1 font-mono text-xs">
          {eventLog.map((entry, index) => (
            <li key={`${entry.text}-${index}`} className={LOG_TONE_CLASS[entry.tone]}>{entry.text}</li>
          ))}
        </ol>
      </div>

      <p className="text-center text-xs italic text-gray-900">
        Priority Queue: sort tasks by urgency and process highest-priority items first.
      </p>

      <QueueCodeWorkbench
        workflowCode={workflowCode}
        workflowLinesHtml={workflowLinesHtml}
        workflowActiveLines={highlights.workflowActiveLines}
        workflowGutterMarks={highlights.workflowGutterMarks}
        stepCode={stepCode}
        stepLinesHtml={stepLinesHtml}
        stepActiveLines={highlights.stepActiveLines}
        stepGutterMarks={highlights.stepGutterMarks}
        tone={highlightTone}
      />
    </div>
  );
}

function PriorityGraph({
  processedTasks,
  currentTask,
  status,
}: {
  processedTasks: Array<{ taskId: string; priority: Priority }>;
  currentTask: { taskId: string; priority: Priority; position: number } | null;
  status: RunStatus | "idle";
}) {
  const priorities: Priority[] = ["urgent", "high", "medium", "low"];

  const processedCounts: Record<Priority, number> = { urgent: 0, high: 0, medium: 0, low: 0 };
  for (const t of processedTasks) {
    processedCounts[t.priority] += 1;
  }

  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Priority Lanes
      </p>

      <svg
        viewBox="0 0 320 200"
        role="img"
        aria-label="Priority queue lanes showing task processing order"
        className="h-auto w-full"
      >
        <rect x={0} y={0} width={320} height={200} fill="var(--color-background-100)" rx={8} />

        {priorities.map((priority, index) => {
          const y = 20 + index * 46;
          const isActive = currentTask?.priority === priority;
          const count = processedCounts[priority];
          const barWidth = Math.min(200, count * 50);

          return (
            <g key={priority}>
              <text
                x={10}
                y={y + 18}
                className={`font-mono text-xs ${isActive ? "fill-gray-1000" : "fill-gray-900"}`}
              >
                {PRIORITY_LABELS[priority]}
              </text>

              <rect
                x={80}
                y={y + 4}
                width={220}
                height={24}
                rx={4}
                fill="var(--color-background-200)"
                stroke={isActive ? PRIORITY_COLORS[priority] : "var(--color-gray-500)"}
                strokeWidth={isActive ? 2 : 1}
              />

              {barWidth > 0 && (
                <rect
                  x={81}
                  y={y + 5}
                  width={barWidth}
                  height={22}
                  rx={3}
                  fill={`color-mix(in srgb, ${PRIORITY_COLORS[priority]} 30%, transparent)`}
                  className="transition-all duration-300"
                />
              )}

              {isActive && (
                <circle
                  cx={81 + barWidth + 10}
                  cy={y + 16}
                  r={4}
                  fill={PRIORITY_COLORS[priority]}
                  className="animate-pulse"
                />
              )}

              <text
                x={305}
                y={y + 18}
                textAnchor="end"
                className={`font-mono text-xs ${count > 0 ? "fill-gray-1000" : "fill-gray-500"}`}
              >
                {count}
              </text>
            </g>
          );
        })}

        {status === "done" && (
          <text
            x={160}
            y={195}
            textAnchor="middle"
            className="font-mono text-xs fill-green-700"
          >
            all tasks processed
          </text>
        )}
      </svg>
    </div>
  );
}

function ProcessedTasksList({
  processedTasks,
  status,
}: {
  processedTasks: Array<{ taskId: string; priority: Priority; result: string }>;
  status: RunStatus | "idle";
}) {
  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Processed Tasks
      </p>
      <ul className="space-y-2">
        {processedTasks.length === 0 ? (
          <li className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2 text-sm text-gray-900">
            {status === "idle" ? "No tasks processed" : "Waiting for tasks to complete..."}
          </li>
        ) : (
          processedTasks.map((task, index) => (
            <li
              key={`${task.taskId}-${index}`}
              className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-300 text-[10px] font-mono text-gray-1000">
                  {index + 1}
                </span>
                <span
                  className="inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${PRIORITY_COLORS[task.priority]} 20%, transparent)`,
                    color: PRIORITY_COLORS[task.priority],
                  }}
                >
                  {PRIORITY_LABELS[task.priority]}
                </span>
                <span className="text-sm text-gray-1000">{task.result}</span>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function RunStatusBadge({ status }: { status: RunStatus | "idle" }) {
  if (status === "done") {
    return (
      <span className="rounded-full bg-green-700/20 px-2 py-0.5 text-xs font-medium text-green-700">
        done
      </span>
    );
  }
  if (status === "sorting") {
    return (
      <span className="rounded-full bg-cyan-700/20 px-2 py-0.5 text-xs font-medium text-cyan-700">
        sorting
      </span>
    );
  }
  if (status === "queued" || status === "processing") {
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
