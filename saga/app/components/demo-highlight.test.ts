import { describe, expect, test } from "bun:test";

import {
  getSagaCodeHighlightState,
  mapFailureModeToStep,
  SAGA_DEMO_DEFAULTS,
  type SagaOrchestratorLineMap,
  type SagaStepLineMap,
} from "./demo";

type SagaSnapshot = NonNullable<
  Parameters<typeof getSagaCodeHighlightState>[0]["snapshot"]
>;

const orchestratorLineMap: SagaOrchestratorLineMap = {
  reserveSeatsAwait: [11],
  reserveSeatsPush: [12],
  captureInvoiceAwait: [14],
  captureInvoicePush: [15],
  provisionSeatsAwait: [17],
  sendConfirmationAwait: [19],
  fatalErrorGuard: [22],
  rollbackLoop: [24, 25, 26, 27],
  rollbackPop: [25],
  rollbackRun: [26],
  returnCompleted: [20],
  returnRolledBack: [29],
};

const stepLineMap: SagaStepLineMap = {
  shouldFailCheck: [8],
  throwFatal: [9],
  returnProvisioned: [13],
};

function createSnapshot(partial: Partial<SagaSnapshot>): SagaSnapshot {
  return {
    status: "running",
    failedStep: null,
    isTerminal: false,
    forwardSteps: [
      { id: "reserveSeats", label: "Reserve seats", state: "scheduled", order: 1 },
      {
        id: "captureInvoice",
        label: "Capture invoice",
        state: "scheduled",
        order: 2,
      },
      { id: "provisionSeats", label: "Provision seats", state: "scheduled", order: 3 },
      {
        id: "sendConfirmation",
        label: "Send confirmation",
        state: "scheduled",
        order: 4,
      },
    ],
    compensationStack: [],
    ...partial,
  };
}

describe("saga code highlight state", () => {
  test("test_mapFailureModeToStep_does_use_step3_as_default_and_preserve_happy_path_option", () => {
    expect(SAGA_DEMO_DEFAULTS.accountId).toBe("acct_acme");
    expect(SAGA_DEMO_DEFAULTS.seats).toBe(5);
    expect(SAGA_DEMO_DEFAULTS.failureMode).toBe("step3");

    expect(mapFailureModeToStep("step1")).toBe(1);
    expect(mapFailureModeToStep("step2")).toBe(2);
    expect(mapFailureModeToStep("step3")).toBe(3);
    expect(mapFailureModeToStep("none")).toBeNull();
  });

  test("test_getSagaCodeHighlightState_does_highlight_reserveSeats_when_forward_step_is_running", () => {
    const snapshot = createSnapshot({
      status: "running",
      forwardSteps: [
        { id: "reserveSeats", label: "Reserve seats", state: "running", order: 1 },
        {
          id: "captureInvoice",
          label: "Capture invoice",
          state: "scheduled",
          order: 2,
        },
        {
          id: "provisionSeats",
          label: "Provision seats",
          state: "scheduled",
          order: 3,
        },
        {
          id: "sendConfirmation",
          label: "Send confirmation",
          state: "scheduled",
          order: 4,
        },
      ],
    });

    const state = getSagaCodeHighlightState({
      snapshot,
      orchestratorLineMap,
      stepLineMap,
    });

    expect(state.orchestratorActiveLines.has(11)).toBeTrue();
    expect(state.stepActiveLines.size).toBe(0);
  });

  test("test_getSagaCodeHighlightState_does_highlight_throw_and_rollback_when_provision_fails", () => {
    const snapshot = createSnapshot({
      status: "rolling_back",
      failedStep: 3,
      forwardSteps: [
        { id: "reserveSeats", label: "Reserve seats", state: "succeeded", order: 1 },
        {
          id: "captureInvoice",
          label: "Capture invoice",
          state: "succeeded",
          order: 2,
        },
        { id: "provisionSeats", label: "Provision seats", state: "failed", order: 3 },
        {
          id: "sendConfirmation",
          label: "Send confirmation",
          state: "skipped",
          order: 4,
        },
      ],
      compensationStack: [
        {
          id: "refundInvoice",
          label: "Refund invoice",
          forStepId: "captureInvoice",
          forStepLabel: "Capture invoice",
          state: "compensating",
          stackPosition: 0,
        },
        {
          id: "releaseSeats",
          label: "Release seats",
          forStepId: "reserveSeats",
          forStepLabel: "Reserve seats",
          state: "queued",
          stackPosition: 1,
        },
      ],
    });

    const state = getSagaCodeHighlightState({
      snapshot,
      orchestratorLineMap,
      stepLineMap,
    });

    expect(state.orchestratorActiveLines.has(17)).toBeTrue();
    expect(state.orchestratorActiveLines.has(24)).toBeTrue();
    expect(state.stepActiveLines.has(9)).toBeTrue();
    expect(state.caption).toBe("FatalError -> triggers compensation stack unwind (LIFO).");
  });

  test("test_getSagaCodeHighlightState_does_highlight_throw_and_rollback_when_reserveSeats_fails", () => {
    const snapshot = createSnapshot({
      status: "rolling_back",
      failedStep: 1,
      forwardSteps: [
        { id: "reserveSeats", label: "Reserve seats", state: "failed", order: 1 },
        {
          id: "captureInvoice",
          label: "Capture invoice",
          state: "skipped",
          order: 2,
        },
        { id: "provisionSeats", label: "Provision seats", state: "skipped", order: 3 },
        {
          id: "sendConfirmation",
          label: "Send confirmation",
          state: "skipped",
          order: 4,
        },
      ],
      compensationStack: [],
    });

    const state = getSagaCodeHighlightState({
      snapshot,
      orchestratorLineMap,
      stepLineMap,
    });

    expect(state.orchestratorActiveLines.has(11)).toBeTrue();
    expect(state.orchestratorActiveLines.has(22)).toBeTrue();
    expect(state.stepActiveLines.has(8)).toBeTrue();
    expect(state.stepActiveLines.has(9)).toBeTrue();
    expect(state.caption).toBe("FatalError -> triggers compensation stack unwind (LIFO).");
  });

  test("test_getSagaCodeHighlightState_does_highlight_throw_and_rollback_when_captureInvoice_fails", () => {
    const snapshot = createSnapshot({
      status: "rolling_back",
      failedStep: 2,
      forwardSteps: [
        { id: "reserveSeats", label: "Reserve seats", state: "succeeded", order: 1 },
        {
          id: "captureInvoice",
          label: "Capture invoice",
          state: "failed",
          order: 2,
        },
        { id: "provisionSeats", label: "Provision seats", state: "skipped", order: 3 },
        {
          id: "sendConfirmation",
          label: "Send confirmation",
          state: "skipped",
          order: 4,
        },
      ],
      compensationStack: [
        {
          id: "releaseSeats",
          label: "Release seats",
          forStepId: "reserveSeats",
          forStepLabel: "Reserve seats",
          state: "compensating",
          stackPosition: 0,
        },
      ],
    });

    const state = getSagaCodeHighlightState({
      snapshot,
      orchestratorLineMap,
      stepLineMap,
    });

    expect(state.orchestratorActiveLines.has(14)).toBeTrue();
    expect(state.orchestratorActiveLines.has(22)).toBeTrue();
    expect(state.stepActiveLines.has(8)).toBeTrue();
    expect(state.stepActiveLines.has(9)).toBeTrue();
    expect(state.caption).toBe("FatalError -> triggers compensation stack unwind (LIFO).");
  });

  test("test_getSagaCodeHighlightState_does_mark_rollback_lines_as_completed_after_unwind", () => {
    const snapshot = createSnapshot({
      status: "rolled_back",
      isTerminal: true,
      failedStep: 3,
      forwardSteps: [
        { id: "reserveSeats", label: "Reserve seats", state: "succeeded", order: 1 },
        {
          id: "captureInvoice",
          label: "Capture invoice",
          state: "succeeded",
          order: 2,
        },
        { id: "provisionSeats", label: "Provision seats", state: "failed", order: 3 },
        {
          id: "sendConfirmation",
          label: "Send confirmation",
          state: "skipped",
          order: 4,
        },
      ],
      compensationStack: [
        {
          id: "refundInvoice",
          label: "Refund invoice",
          forStepId: "captureInvoice",
          forStepLabel: "Capture invoice",
          state: "compensated",
          stackPosition: 0,
        },
        {
          id: "releaseSeats",
          label: "Release seats",
          forStepId: "reserveSeats",
          forStepLabel: "Reserve seats",
          state: "compensated",
          stackPosition: 1,
        },
      ],
    });

    const state = getSagaCodeHighlightState({
      snapshot,
      orchestratorLineMap,
      stepLineMap,
    });

    expect(state.orchestratorGutterMarks.has(24)).toBeTrue();
    expect(state.orchestratorGutterMarks.has(26)).toBeTrue();
    expect(state.orchestratorGutterMarks.has(29)).toBeTrue();
  });
});
