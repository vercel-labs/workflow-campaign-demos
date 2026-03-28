// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import {
  priorityQueueFlow,
  type TaskItem,
  type Priority,
} from "@/priority-queue/workflows/priority-queue";

type RequestBody = {
  tasks?: unknown;
};

const VALID_PRIORITIES = new Set<Priority>(["urgent", "high", "medium", "low"]);

function parseTasks(value: unknown): TaskItem[] | null {
  if (!Array.isArray(value)) return null;

  const tasks: TaskItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const obj = item as Record<string, unknown>;
    if (typeof obj.id !== "string" || typeof obj.label !== "string" || typeof obj.priority !== "string") {
      return null;
    }
    if (!VALID_PRIORITIES.has(obj.priority as Priority)) return null;
    tasks.push({ id: obj.id, label: obj.label, priority: obj.priority as Priority });
  }

  return tasks.length > 0 ? tasks : null;
}

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tasks = parseTasks(body.tasks);
  if (!tasks) {
    return NextResponse.json(
      { error: "tasks is required: array of { id, label, priority }" },
      { status: 400 }
    );
  }

  const run = await start(priorityQueueFlow, [tasks]);

  return NextResponse.json({
    runId: run.runId,
    taskCount: tasks.length,
    status: "queued",
  });
}
