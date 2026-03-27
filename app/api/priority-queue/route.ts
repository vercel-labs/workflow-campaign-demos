import { start } from "workflow/api";
import {
  priorityQueueFlow,
  type Priority,
  type TaskItem,
} from "@/priority-queue/workflows/priority-queue";
import { jsonError } from "@/lib/http/json-error";

const VALID_PRIORITIES = new Set<Priority>(["urgent", "high", "medium", "low"]);

function parseTasks(value: unknown): TaskItem[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const tasks: TaskItem[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const task = item as Record<string, unknown>;
    if (
      typeof task.id !== "string" ||
      typeof task.label !== "string" ||
      typeof task.priority !== "string" ||
      !VALID_PRIORITIES.has(task.priority as Priority)
    ) {
      return null;
    }
    tasks.push({
      id: task.id,
      label: task.label,
      priority: task.priority as Priority,
    });
  }

  return tasks;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/priority-queue",
        action: "invalid_json",
      }),
    );
    return jsonError(400, "INVALID_JSON", "Invalid JSON body");
  }

  const tasks = parseTasks(body.tasks);

  if (!tasks) {
    return jsonError(
      400,
      "INVALID_REQUEST",
      "tasks is required: array of { id, label, priority }",
    );
  }

  try {
    const run = await start(priorityQueueFlow, [tasks]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/priority-queue",
        action: "workflow_started",
        runId: run.runId,
        taskCount: tasks.length,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, taskCount: tasks.length, status: "queued" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/priority-queue",
        action: "start_failed",
        error: message,
      }),
    );
    return jsonError(500, "START_FAILED", message);
  }
}
