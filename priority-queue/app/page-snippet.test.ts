import { describe, expect, test } from "bun:test";

const workflowSource = await Bun.file(
  new URL("../workflows/priority-queue.ts", import.meta.url)
).text();

describe("priority-queue page workflow snippet parity", () => {
  test("test_workflowSnippet_includes_sortByPriority_and_sortTasks_helpers", () => {
    expect(workflowSource).toContain("function sortByPriority(tasks: TaskItem[]): TaskItem[]");
    expect(workflowSource).toContain("async function sortTasks(tasks: TaskItem[]): Promise<TaskItem[]>");
    expect(workflowSource).toContain('type: "sorting"');
    expect(workflowSource).toContain('type: "sorted"');
  });

  test("test_workflowSnippet_uses_priority_order_and_processTask_step", () => {
    expect(workflowSource).toContain("async function processTask(");
    expect(workflowSource).toContain('type: "processing_task"');
    expect(workflowSource).toContain('type: "task_complete"');
    expect(workflowSource).toContain("export async function priorityQueueFlow(");
    expect(workflowSource).toContain("PRIORITY_ORDER");
    expect(workflowSource).toContain(
      "return { processed: sorted.length, summary };"
    );
  });
});
