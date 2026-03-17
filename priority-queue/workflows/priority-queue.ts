import { getWritable, sleep } from "workflow";

export type Priority = "urgent" | "high" | "medium" | "low";

export type QueueEvent =
  | { type: "tasks_received"; count: number; priorities: Record<Priority, number> }
  | { type: "sorting"; strategy: string }
  | { type: "sorted"; order: string[] }
  | { type: "processing_task"; taskId: string; priority: Priority; position: number }
  | { type: "task_complete"; taskId: string; priority: Priority; result: string }
  | { type: "done"; processed: number; summary: Record<Priority, number> };

export interface PriorityQueueResult {
  processed: number;
  summary: Record<Priority, number>;
}

export type TaskItem = {
  id: string;
  label: string;
  priority: Priority;
};

const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// Demo timing
const SORT_DELAY_MS = 600;
const PROCESS_DELAY_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sortByPriority(tasks: TaskItem[]): TaskItem[] {
  return [...tasks].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
  );
}

export async function priorityQueueFlow(
  tasks: TaskItem[]
): Promise<PriorityQueueResult> {
  "use workflow";

  // Step 1: Receive tasks and tally priorities
  const priorities: Record<Priority, number> = { urgent: 0, high: 0, medium: 0, low: 0 };
  for (const task of tasks) {
    priorities[task.priority] += 1;
  }
  await emitEvent({ type: "tasks_received", count: tasks.length, priorities });

  // Step 2: Sort tasks by priority
  const sorted = await sortTasks(tasks);

  // Step 3: Process each task in priority order
  const summary: Record<Priority, number> = { urgent: 0, high: 0, medium: 0, low: 0 };
  for (let i = 0; i < sorted.length; i++) {
    await processTask(sorted[i], i + 1);
    summary[sorted[i].priority] += 1;
  }

  // Step 4: Emit completion
  await emitEvent({ type: "done", processed: sorted.length, summary });

  return { processed: sorted.length, summary };
}

async function sortTasks(tasks: TaskItem[]): Promise<TaskItem[]> {
  "use step";

  const writer = getWritable<QueueEvent>().getWriter();
  try {
    await writer.write({ type: "sorting", strategy: "priority-weighted" });
    await delay(SORT_DELAY_MS);

    const sorted = sortByPriority(tasks);
    await writer.write({ type: "sorted", order: sorted.map((t) => t.id) });
    return sorted;
  } finally {
    writer.releaseLock();
  }
}

async function processTask(
  task: TaskItem,
  position: number
): Promise<void> {
  "use step";

  const writer = getWritable<QueueEvent>().getWriter();
  try {
    await writer.write({
      type: "processing_task",
      taskId: task.id,
      priority: task.priority,
      position,
    });
    await delay(PROCESS_DELAY_MS);

    await writer.write({
      type: "task_complete",
      taskId: task.id,
      priority: task.priority,
      result: `${task.label} completed`,
    });
  } finally {
    writer.releaseLock();
  }
}

async function emitEvent(event: QueueEvent): Promise<void> {
  "use step";
  const writer = getWritable<QueueEvent>().getWriter();
  try {
    await writer.write(event);
  } finally {
    writer.releaseLock();
  }
}
