"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Priority = "urgent" | "high" | "medium" | "low";

type QueueEvent =
  | { type: "tasks_received"; count: number; priorities: Record<Priority, number> }
  | { type: "sorting"; strategy: string }
  | { type: "sorted"; order: string[] }
  | { type: "processing_task"; taskId: string; priority: Priority; position: number }
  | { type: "task_complete"; taskId: string; priority: Priority; result: string }
  | { type: "done"; processed: number; summary: Record<Priority, number> };

type TaskItem = {
  id: string;
  label: string;
  priority: Priority;
  status: "pending" | "processing" | "done";
};

const SAMPLE_TASKS: TaskItem[] = [
  { id: "TASK-01", label: "Deploy hotfix to production", priority: "urgent", status: "pending" },
  { id: "TASK-02", label: "Review security audit report", priority: "high", status: "pending" },
  { id: "TASK-03", label: "Update API documentation", priority: "medium", status: "pending" },
  { id: "TASK-04", label: "Clean up stale branches", priority: "low", status: "pending" },
  { id: "TASK-05", label: "Patch CVE dependency", priority: "urgent", status: "pending" },
];

function parseSseChunk(rawChunk: string): QueueEvent | null {
  const payload = rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as QueueEvent;
  } catch {
    return null;
  }
}

export function PriorityQueueDemo() {
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>(SAMPLE_TASKS);
  const [sortedOrder, setSortedOrder] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [summary, setSummary] = useState<Record<Priority, number> | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const appendLog = useCallback((line: string) => {
    setLog((current) => [...current, line]);
  }, []);

  const connectStream = useCallback(
    async (targetRunId: string, signal: AbortSignal) => {
      const response = await fetch(`/api/readable/${encodeURIComponent(targetRunId)}`, { signal });

      if (!response.ok || !response.body) {
        throw new Error("Failed to connect to workflow stream");
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
          const event = parseSseChunk(chunk);
          if (!event) continue;

          if (event.type === "tasks_received") {
            appendLog(`received ${event.count} tasks`);
          }

          if (event.type === "sorting") {
            appendLog(`sorting queue via ${event.strategy}`);
          }

          if (event.type === "sorted") {
            setSortedOrder(event.order);
            appendLog(`sorted order: ${event.order.join(" → ")}`);
          }

          if (event.type === "processing_task") {
            setTasks((current) =>
              current.map((task) =>
                task.id === event.taskId ? { ...task, status: "processing" } : task,
              ),
            );
            appendLog(`processing ${event.taskId} (${event.priority})`);
          }

          if (event.type === "task_complete") {
            setTasks((current) =>
              current.map((task) =>
                task.id === event.taskId ? { ...task, status: "done" } : task,
              ),
            );
            appendLog(event.result);
          }

          if (event.type === "done") {
            setStatus("done");
            setSummary(event.summary);
            appendLog(`processed ${event.processed} tasks`);
          }
        }
      }
    },
    [appendLog],
  );

  const handleStart = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRunId(null);
    setStatus("running");
    setError(null);
    setLog([]);
    setSummary(null);
    setSortedOrder([]);
    setTasks(SAMPLE_TASKS.map((task) => ({ ...task, status: "pending" })));

    try {
      const response = await fetch("/api/priority-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: SAMPLE_TASKS.map(({ id, label, priority }) => ({ id, label, priority })),
        }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as {
        runId?: string;
        error?: { message?: string };
      };

      if (!response.ok || !payload.runId) {
        throw new Error(payload.error?.message ?? "Failed to start priority queue");
      }

      setRunId(payload.runId);
      appendLog("workflow started");
      await connectStream(payload.runId, controller.signal);
    } catch (errorValue) {
      if (controller.signal.aborted) return;
      setStatus("error");
      setError(errorValue instanceof Error ? errorValue.message : "Unexpected queue error");
    }
  }, [appendLog, connectStream]);

  const doneCount = useMemo(
    () => tasks.filter((task) => task.status === "done").length,
    [tasks],
  );

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-gray-300 bg-background-100 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="text-sm text-gray-900">
            <div>Run: {runId ?? "not started"}</div>
            <div>Status: {status}</div>
            <div>Completed: {doneCount}/{tasks.length}</div>
          </div>
          <button
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={status === "running"}
            onClick={handleStart}
            type="button"
          >
            {status === "running" ? "Running..." : "Process queue"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {tasks.map((task) => (
          <article key={task.id} className="rounded-xl border border-gray-300 bg-background-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-1000">{task.label}</div>
                <div className="text-xs text-gray-900">{task.id}</div>
              </div>
              <div className="text-right text-xs uppercase tracking-wide text-gray-900">
                <div>{task.priority}</div>
                <div>{task.status}</div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-gray-300 bg-background-100 p-4">
          <h3 className="text-sm font-semibold text-gray-1000">Sorted order</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {(sortedOrder.length > 0 ? sortedOrder : tasks.map((task) => task.id)).map((taskId) => (
              <span key={taskId} className="rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-900">
                {taskId}
              </span>
            ))}
          </div>
          <div className="mt-4 space-y-2 text-sm text-gray-900">
            {log.length > 0 ? log.map((entry, index) => <div key={`${entry}-${index}`}>{entry}</div>) : <div>No events yet.</div>}
          </div>
        </div>
        <div className="rounded-xl border border-gray-300 bg-background-100 p-4 text-sm text-gray-900">
          <h3 className="font-semibold text-gray-1000">Priority summary</h3>
          <div className="mt-3">Urgent: {summary?.urgent ?? 0}</div>
          <div>High: {summary?.high ?? 0}</div>
          <div>Medium: {summary?.medium ?? 0}</div>
          <div>Low: {summary?.low ?? 0}</div>
          <div className="mt-2 text-red-700">{error ?? " "}</div>
        </div>
      </div>
    </section>
  );
}
