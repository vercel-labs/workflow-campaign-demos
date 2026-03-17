import { beforeEach, describe, expect, mock, test } from "bun:test";

const writtenEvents: Array<Record<string, unknown>> = [];
const releaseLockMock = mock(() => {});
const writeMock = mock(async (event: unknown) => {
  writtenEvents.push(event as Record<string, unknown>);
});
const getWriterMock = mock(() => ({
  write: writeMock,
  releaseLock: releaseLockMock,
}));
const getWritableMock = mock(() => ({
  getWriter: getWriterMock,
}));

mock.module("workflow", () => ({
  getWritable: getWritableMock,
  sleep: mock(() => Promise.resolve()),
}));

async function loadWorkflow() {
  return import("./detour");
}

describe("detour workflow", () => {
  beforeEach(() => {
    writtenEvents.length = 0;
    releaseLockMock.mockClear();
    writeMock.mockClear();
    getWriterMock.mockClear();
    getWritableMock.mockClear();
  });

  test("test_detourFlow_runs_direct_path_when_qaMode_is_false", async () => {
    const { detourFlow } = await loadWorkflow();
    const result = await detourFlow("DEPLOY-001", false);

    expect(result.status).toBe("done");
    expect(result.deployId).toBe("DEPLOY-001");
    expect(result.qaMode).toBe(false);
    expect(result.totalSteps).toBe(3); // build + lint + deploy

    // Should NOT have detour events
    expect(writtenEvents.some((e) => e.type === "detour_entered")).toBe(false);
    expect(writtenEvents.some((e) => e.type === "detour_exited")).toBe(false);

    // Should have build, lint, deploy steps
    const runningSteps = writtenEvents
      .filter((e) => e.type === "step_running")
      .map((e) => e.step);
    expect(runningSteps).toEqual(["build", "lint", "deploy"]);

    // Should have done event
    expect(writtenEvents.some((e) => e.type === "done")).toBe(true);
    expect(releaseLockMock).toHaveBeenCalled();
  });

  test("test_detourFlow_runs_qa_stages_when_qaMode_is_true", async () => {
    const { detourFlow } = await loadWorkflow();
    const result = await detourFlow("DEPLOY-002", true);

    expect(result.status).toBe("done");
    expect(result.qaMode).toBe(true);
    expect(result.totalSteps).toBe(6); // build + lint + 3 qa + deploy

    // Should have detour events
    expect(writtenEvents.some((e) => e.type === "detour_entered")).toBe(true);
    expect(writtenEvents.some((e) => e.type === "detour_exited")).toBe(true);

    // Should have all steps including QA
    const runningSteps = writtenEvents
      .filter((e) => e.type === "step_running")
      .map((e) => e.step);
    expect(runningSteps).toEqual([
      "build",
      "lint",
      "qa-review",
      "staging-test",
      "security-scan",
      "deploy",
    ]);
  });

  test("test_detourFlow_emits_pipeline_started_with_qaMode_flag", async () => {
    const { detourFlow } = await loadWorkflow();
    await detourFlow("DEPLOY-003", true);

    const startEvent = writtenEvents.find((e) => e.type === "pipeline_started");
    expect(startEvent).toBeTruthy();
    expect(startEvent?.qaMode).toBe(true);
    expect(startEvent?.deployId).toBe("DEPLOY-003");
  });

  test("test_detourFlow_emits_step_complete_with_result_strings", async () => {
    const { detourFlow } = await loadWorkflow();
    await detourFlow("DEPLOY-004", false);

    const completeEvents = writtenEvents.filter((e) => e.type === "step_complete");
    expect(completeEvents).toHaveLength(3);
    expect(completeEvents.every((e) => typeof e.result === "string" && (e.result as string).length > 0)).toBe(true);
  });
});
