import { describe, expect, test } from "bun:test";

import {
  createAccumulator,
  applyFilterEvent,
  parseFilterEvent,
  toSnapshot,
} from "./demo";

describe("message-filter demo state functions", () => {
  test("test_createAccumulator_initializes_8_orders_with_filtering_status", () => {
    const acc = createAccumulator({
      runId: "run-1",
      status: "filtering",
    });

    expect(acc.runId).toBe("run-1");
    expect(acc.status).toBe("filtering");
    expect(Object.keys(acc.orders)).toHaveLength(8);
    expect(acc.orders["ORD-001"].verdicts).toEqual([]);
    expect(acc.orders["ORD-001"].finalVerdict).toBeNull();
    expect(acc.passedCount).toBe(0);
    expect(acc.rejectedCount).toBe(0);
    expect(acc.activeStage).toBeNull();
  });

  test("test_applyFilterEvent_sets_active_stage_on_filter_check", () => {
    const acc = createAccumulator({ runId: "run-1", status: "filtering" });

    const updated = applyFilterEvent(acc, {
      type: "filter_check",
      orderId: "ORD-001",
      stage: "fraud",
    });

    expect(updated.activeStage).toBe("fraud");
    expect(updated.orders["ORD-001"].currentStage).toBe("fraud");
  });

  test("test_applyFilterEvent_records_pass_verdict_on_filter_result", () => {
    const acc = createAccumulator({ runId: "run-1", status: "filtering" });

    const updated = applyFilterEvent(acc, {
      type: "filter_result",
      orderId: "ORD-001",
      stage: "fraud",
      verdict: "pass",
    });

    expect(updated.orders["ORD-001"].verdicts).toHaveLength(1);
    expect(updated.orders["ORD-001"].verdicts[0].verdict).toBe("pass");
    expect(updated.orders["ORD-001"].verdicts[0].stage).toBe("fraud");
    expect(updated.orders["ORD-001"].currentStage).toBeNull();
    expect(updated.orders["ORD-001"].finalVerdict).toBeNull();
  });

  test("test_applyFilterEvent_records_reject_verdict_and_sets_final_verdict", () => {
    const acc = createAccumulator({ runId: "run-1", status: "filtering" });

    const updated = applyFilterEvent(acc, {
      type: "filter_result",
      orderId: "ORD-004",
      stage: "fraud",
      verdict: "reject",
      reason: "Fraud score 92 exceeds threshold 70",
    });

    expect(updated.orders["ORD-004"].verdicts).toHaveLength(1);
    expect(updated.orders["ORD-004"].verdicts[0].verdict).toBe("reject");
    expect(updated.orders["ORD-004"].finalVerdict).toBe("reject");
  });

  test("test_applyFilterEvent_sets_done_status_with_counts_on_filter_done", () => {
    const acc = createAccumulator({ runId: "run-1", status: "filtering" });

    const updated = applyFilterEvent(acc, {
      type: "filter_done",
      orderId: "summary",
      passedOrders: [
        { id: "ORD-001", amount: 250, region: "US", fraudScore: 12, customer: "Alice" },
        { id: "ORD-005", amount: 430, region: "CA", fraudScore: 15, customer: "Eve" },
        { id: "ORD-008", amount: 610, region: "US", fraudScore: 5, customer: "Hank" },
      ],
      rejectedOrders: [
        {
          order: { id: "ORD-004", amount: 89, region: "US", fraudScore: 92, customer: "Diana" },
          stage: "fraud",
          reason: "Fraud score 92 > 70",
        },
        {
          order: { id: "ORD-007", amount: 3, region: "EU", fraudScore: 88, customer: "Grace" },
          stage: "fraud",
          reason: "Fraud score 88 > 70",
        },
      ],
    });

    expect(updated.status).toBe("done");
    expect(updated.passedCount).toBe(3);
    expect(updated.rejectedCount).toBe(2);
    expect(updated.activeStage).toBeNull();
  });

  test("test_applyFilterEvent_returns_current_state_for_unknown_order_id", () => {
    const acc = createAccumulator({ runId: "run-1", status: "filtering" });

    const updated = applyFilterEvent(acc, {
      type: "filter_check",
      orderId: "ORD-UNKNOWN",
      stage: "fraud",
    });

    expect(updated).toBe(acc);
  });

  test("test_parseFilterEvent_parses_filter_check_from_sse_chunk", () => {
    const event = parseFilterEvent(
      'data: {"type":"filter_check","orderId":"ORD-001","stage":"fraud"}\n\n'
    );

    expect(event).toEqual({
      type: "filter_check",
      orderId: "ORD-001",
      stage: "fraud",
    });
  });

  test("test_parseFilterEvent_parses_filter_result_with_verdict_and_reason", () => {
    const event = parseFilterEvent(
      'data: {"type":"filter_result","orderId":"ORD-004","stage":"fraud","verdict":"reject","reason":"Fraud score 92 exceeds threshold 70"}\n\n'
    );

    expect(event).toEqual({
      type: "filter_result",
      orderId: "ORD-004",
      stage: "fraud",
      verdict: "reject",
      reason: "Fraud score 92 exceeds threshold 70",
    });
  });

  test("test_parseFilterEvent_parses_filter_done_with_order_arrays", () => {
    const event = parseFilterEvent(
      'data: {"type":"filter_done","orderId":"summary","passedOrders":[{"id":"ORD-001"}],"rejectedOrders":[{"order":{"id":"ORD-004"},"stage":"fraud","reason":"bad"}]}\n\n'
    );

    expect(event).not.toBeNull();
    expect(event!.type).toBe("filter_done");
    expect(event!.passedOrders).toHaveLength(1);
    expect(event!.rejectedOrders).toHaveLength(1);
  });

  test("test_parseFilterEvent_returns_null_for_empty_chunk", () => {
    expect(parseFilterEvent("")).toBeNull();
    expect(parseFilterEvent("not-data: foo")).toBeNull();
  });

  test("test_parseFilterEvent_returns_null_for_invalid_json", () => {
    expect(parseFilterEvent("data: {broken")).toBeNull();
  });

  test("test_toSnapshot_adds_elapsed_time", () => {
    const acc = createAccumulator({ runId: "run-1", status: "filtering" });
    const now = Date.now();
    const snap = toSnapshot(acc, now - 1500);

    expect(snap.runId).toBe("run-1");
    expect(snap.elapsedMs).toBeGreaterThanOrEqual(1400);
    expect(snap.elapsedMs).toBeLessThan(3000);
  });

  test("test_toSnapshot_clamps_negative_elapsed_to_zero", () => {
    const acc = createAccumulator({ runId: "run-1", status: "filtering" });
    const snap = toSnapshot(acc, Date.now() + 10000);

    expect(snap.elapsedMs).toBe(0);
  });
});
