import { beforeEach, describe, expect, mock, test } from "bun:test";

const writtenEvents: Array<Record<string, unknown>> = [];
const closeMock = mock(() => {});
const writeMock = mock(async (event: unknown) => {
  writtenEvents.push(event as Record<string, unknown>);
});
const getWriterMock = mock(() => ({
  write: writeMock,
  close: closeMock,
}));
const getWritableMock = mock(() => ({
  getWriter: getWriterMock,
}));

mock.module("workflow", () => ({
  getWritable: getWritableMock,
  FatalError: class FatalError extends Error {},
}));

async function loadWorkflow() {
  return import("./order-filter");
}

describe("order-filter workflow", () => {
  beforeEach(() => {
    writtenEvents.length = 0;
    closeMock.mockClear();
    writeMock.mockClear();
    getWriterMock.mockClear();
    getWritableMock.mockClear();
  });

  test("test_applyFraudCheck_rejects_orders_with_fraud_score_above_threshold", async () => {
    const { applyFraudCheck } = await loadWorkflow();
    const orders = [
      { id: "ORD-001", amount: 250, region: "US", fraudScore: 12, customer: "Alice" },
      { id: "ORD-004", amount: 89, region: "US", fraudScore: 92, customer: "Diana" },
      { id: "ORD-007", amount: 3, region: "EU", fraudScore: 88, customer: "Grace" },
    ];

    const result = await applyFraudCheck(orders, 70);

    expect(result.passed).toHaveLength(1);
    expect(result.passed[0].id).toBe("ORD-001");
    expect(result.rejected).toHaveLength(2);
    expect(result.rejected.map((r: { order: { id: string } }) => r.order.id)).toEqual([
      "ORD-004",
      "ORD-007",
    ]);
    expect(result.rejected[0].stage).toBe("fraud");
  });

  test("test_applyAmountThreshold_rejects_orders_below_minimum", async () => {
    const { applyAmountThreshold } = await loadWorkflow();
    const orders = [
      { id: "ORD-001", amount: 250, region: "US", fraudScore: 12, customer: "Alice" },
      { id: "ORD-002", amount: 5, region: "EU", fraudScore: 8, customer: "Bob" },
    ];

    const result = await applyAmountThreshold(orders, 10);

    expect(result.passed).toHaveLength(1);
    expect(result.passed[0].id).toBe("ORD-001");
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].order.id).toBe("ORD-002");
    expect(result.rejected[0].stage).toBe("amount");
  });

  test("test_applyRegionFilter_rejects_orders_outside_allowed_regions", async () => {
    const { applyRegionFilter } = await loadWorkflow();
    const orders = [
      { id: "ORD-001", amount: 250, region: "US", fraudScore: 12, customer: "Alice" },
      { id: "ORD-003", amount: 1200, region: "CN", fraudScore: 45, customer: "Charlie" },
      { id: "ORD-006", amount: 75, region: "BR", fraudScore: 55, customer: "Frank" },
    ];

    const result = await applyRegionFilter(orders, ["US", "EU", "CA"]);

    expect(result.passed).toHaveLength(1);
    expect(result.passed[0].id).toBe("ORD-001");
    expect(result.rejected).toHaveLength(2);
    expect(result.rejected[0].stage).toBe("region");
    expect(result.rejected[1].stage).toBe("region");
  });

  test("test_emitResults_writes_filter_done_event_with_summary", async () => {
    const { emitResults } = await loadWorkflow();
    const passed = [
      { id: "ORD-001", amount: 250, region: "US", fraudScore: 12, customer: "Alice" },
    ];
    const rejected = [
      {
        order: { id: "ORD-004", amount: 89, region: "US", fraudScore: 92, customer: "Diana" },
        stage: "fraud",
        reason: "Fraud score 92 > 70",
      },
    ];

    await emitResults(passed, rejected);

    const doneEvent = writtenEvents.find((e) => e.type === "filter_done");
    expect(doneEvent).toBeTruthy();
    expect(doneEvent!.orderId).toBe("summary");
    expect(doneEvent!.passedOrders).toEqual(passed);
    expect(doneEvent!.rejectedOrders).toEqual(rejected);
  });

  test("test_full_pipeline_produces_correct_pass_reject_counts_across_all_stages", { timeout: 15000 }, async () => {
    const { applyFraudCheck, applyAmountThreshold, applyRegionFilter } =
      await loadWorkflow();

    // All 8 sample orders through default config
    const allOrders = [
      { id: "ORD-001", amount: 250, region: "US", fraudScore: 12, customer: "Alice" },
      { id: "ORD-002", amount: 5, region: "EU", fraudScore: 8, customer: "Bob" },
      { id: "ORD-003", amount: 1200, region: "CN", fraudScore: 45, customer: "Charlie" },
      { id: "ORD-004", amount: 89, region: "US", fraudScore: 92, customer: "Diana" },
      { id: "ORD-005", amount: 430, region: "CA", fraudScore: 15, customer: "Eve" },
      { id: "ORD-006", amount: 75, region: "BR", fraudScore: 55, customer: "Frank" },
      { id: "ORD-007", amount: 3, region: "EU", fraudScore: 88, customer: "Grace" },
      { id: "ORD-008", amount: 610, region: "US", fraudScore: 5, customer: "Hank" },
    ];

    const afterFraud = await applyFraudCheck(allOrders, 70);
    // ORD-004 (92) and ORD-007 (88) rejected => 6 passed, 2 rejected
    expect(afterFraud.passed).toHaveLength(6);
    expect(afterFraud.rejected).toHaveLength(2);

    const afterAmount = await applyAmountThreshold(afterFraud.passed, 10);
    // ORD-002 (amount 5) rejected => 5 passed, 1 rejected
    expect(afterAmount.passed).toHaveLength(5);
    expect(afterAmount.rejected).toHaveLength(1);

    const afterRegion = await applyRegionFilter(afterAmount.passed, ["US", "EU", "CA"]);
    // ORD-003 (CN) and ORD-006 (BR) rejected => 3 passed, 2 rejected  (wait... let me recheck)
    // After fraud: ORD-001(US), ORD-002(EU), ORD-003(CN), ORD-005(CA), ORD-006(BR), ORD-008(US)
    // After amount: ORD-001(US), ORD-003(CN), ORD-005(CA), ORD-006(BR), ORD-008(US) (ORD-002 amount=5 rejected)
    // After region: ORD-001(US), ORD-005(CA), ORD-008(US) passed; ORD-003(CN), ORD-006(BR) rejected
    expect(afterRegion.passed).toHaveLength(3);
    expect(afterRegion.rejected).toHaveLength(2);

    // Total: 3 passed, 5 rejected (2 fraud + 1 amount + 2 region)
    const totalRejected =
      afterFraud.rejected.length +
      afterAmount.rejected.length +
      afterRegion.rejected.length;
    expect(totalRejected).toBe(5);
  });

  test("test_each_filter_step_writes_check_and_result_events_for_every_order", async () => {
    const { applyFraudCheck } = await loadWorkflow();
    const orders = [
      { id: "ORD-001", amount: 250, region: "US", fraudScore: 12, customer: "Alice" },
      { id: "ORD-002", amount: 5, region: "EU", fraudScore: 8, customer: "Bob" },
    ];

    writtenEvents.length = 0;
    await applyFraudCheck(orders, 70);

    const checkEvents = writtenEvents.filter((e) => e.type === "filter_check");
    const resultEvents = writtenEvents.filter((e) => e.type === "filter_result");

    expect(checkEvents).toHaveLength(2);
    expect(resultEvents).toHaveLength(2);
    expect(checkEvents[0].stage).toBe("fraud");
    expect(resultEvents[0].verdict).toBe("pass");
    expect(resultEvents[1].verdict).toBe("pass");
  });

  test("test_writer_close_is_called_after_each_step", async () => {
    const { applyFraudCheck } = await loadWorkflow();
    closeMock.mockClear();
    await applyFraudCheck(
      [{ id: "ORD-001", amount: 250, region: "US", fraudScore: 12, customer: "Alice" }],
      70
    );

    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
