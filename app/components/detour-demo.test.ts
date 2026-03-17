import { describe, expect, test } from "bun:test";

import {
  applyDetourEvent,
  createAccumulator,
  parseDetourEvent,
} from "./detour-demo";

describe("detour demo controls", () => {
  test("test_createAccumulator_initializes_with_deploying_status", () => {
    const acc = createAccumulator({
      runId: "run-1",
      deployId: "DEPLOY-001",
      qaMode: false,
      status: "deploying",
    });

    expect(acc.status).toBe("deploying");
    expect(acc.deployId).toBe("DEPLOY-001");
    expect(acc.qaMode).toBe(false);
    expect(acc.completedSteps).toEqual([]);
    expect(acc.currentStep).toBeNull();
    expect(acc.inDetour).toBe(false);
  });

  test("test_applyDetourEvent_sets_building_status_on_pipeline_started", () => {
    const acc = createAccumulator({
      runId: "run-1",
      deployId: "DEPLOY-001",
      qaMode: true,
      status: "deploying",
    });

    const next = applyDetourEvent(acc, {
      type: "pipeline_started",
      deployId: "DEPLOY-001",
      qaMode: true,
    });

    expect(next.status).toBe("building");
  });

  test("test_applyDetourEvent_tracks_current_step_on_step_running", () => {
    const acc = createAccumulator({
      runId: "run-1",
      deployId: "DEPLOY-001",
      qaMode: false,
      status: "deploying",
    });

    const next = applyDetourEvent(acc, {
      type: "step_running",
      deployId: "DEPLOY-001",
      step: "build",
    });

    expect(next.currentStep).toBe("build");
  });

  test("test_applyDetourEvent_appends_completed_step_on_step_complete", () => {
    let acc = createAccumulator({
      runId: "run-1",
      deployId: "DEPLOY-001",
      qaMode: false,
      status: "deploying",
    });

    acc = applyDetourEvent(acc, {
      type: "step_running",
      deployId: "DEPLOY-001",
      step: "build",
    });

    acc = applyDetourEvent(acc, {
      type: "step_complete",
      deployId: "DEPLOY-001",
      step: "build",
      result: "Build succeeded",
    });

    expect(acc.completedSteps).toHaveLength(1);
    expect(acc.completedSteps[0].step).toBe("build");
    expect(acc.completedSteps[0].result).toBe("Build succeeded");
    expect(acc.currentStep).toBeNull();
  });

  test("test_applyDetourEvent_enters_and_exits_detour", () => {
    let acc = createAccumulator({
      runId: "run-1",
      deployId: "DEPLOY-001",
      qaMode: true,
      status: "deploying",
    });

    acc = applyDetourEvent(acc, { type: "detour_entered", deployId: "DEPLOY-001" });
    expect(acc.status).toBe("detour");
    expect(acc.inDetour).toBe(true);

    acc = applyDetourEvent(acc, { type: "detour_exited", deployId: "DEPLOY-001" });
    expect(acc.status).toBe("building");
    expect(acc.inDetour).toBe(false);
  });

  test("test_applyDetourEvent_sets_done_with_totalSteps", () => {
    let acc = createAccumulator({
      runId: "run-1",
      deployId: "DEPLOY-001",
      qaMode: true,
      status: "deploying",
    });

    acc = applyDetourEvent(acc, {
      type: "done",
      deployId: "DEPLOY-001",
      totalSteps: 6,
      qaMode: true,
    });

    expect(acc.status).toBe("done");
    expect(acc.totalSteps).toBe(6);
  });

  test("test_parseDetourEvent_parses_done_event_from_sse_chunk", () => {
    const event = parseDetourEvent(
      'data: {"type":"done","deployId":"DEPLOY-001","totalSteps":3,"qaMode":false}\n\n'
    );

    expect(event).toEqual({
      type: "done",
      deployId: "DEPLOY-001",
      totalSteps: 3,
      qaMode: false,
    });
  });

  test("test_parseDetourEvent_parses_detour_entered_event", () => {
    const event = parseDetourEvent(
      'data: {"type":"detour_entered","deployId":"DEPLOY-002"}\n\n'
    );

    expect(event).toEqual({
      type: "detour_entered",
      deployId: "DEPLOY-002",
    });
  });

  test("test_parseDetourEvent_returns_null_for_invalid_chunk", () => {
    expect(parseDetourEvent("not valid sse")).toBeNull();
    expect(parseDetourEvent("data: {invalid json}\n\n")).toBeNull();
    expect(parseDetourEvent("")).toBeNull();
  });
});
