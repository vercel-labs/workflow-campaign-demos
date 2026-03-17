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
}));

async function loadWorkflow() {
  return import("./order-splitter");
}

const SAMPLE_ORDER = {
  orderId: "ORD-TEST-001",
  items: [
    { sku: "WIDGET-A1", name: "Widget Alpha", quantity: 2, warehouse: "us-east-1" },
    { sku: "GADGET-B2", name: "Gadget Beta", quantity: 1, warehouse: "us-west-2" },
    { sku: "SPRING-C3", name: "Spring Coil", quantity: 5, warehouse: "eu-west-1" },
  ],
};

describe("order-splitter workflow", () => {
  beforeEach(() => {
    writtenEvents.length = 0;
    releaseLockMock.mockClear();
    writeMock.mockClear();
    getWriterMock.mockClear();
    getWritableMock.mockClear();
  });

  test("test_orderSplitter_emits_correct_number_of_events_when_all_items_succeed", async () => {
    const { orderSplitter } = await loadWorkflow();
    const report = await orderSplitter(SAMPLE_ORDER);

    expect(report.status).toBe("done");
    expect(report.orderId).toBe("ORD-TEST-001");
    expect(report.results).toHaveLength(3);
    expect(report.summary).toEqual({ fulfilled: 3, failed: 0, total: 3 });

    // Expect: splitting(1) + per-item(processing+validated+reserved+fulfilled = 4 each * 3) + aggregating(1) + done(1) = 15
    const splittingEvents = writtenEvents.filter((e) => e.type === "splitting");
    const processingEvents = writtenEvents.filter((e) => e.type === "item_processing");
    const validatedEvents = writtenEvents.filter((e) => e.type === "item_validated");
    const reservedEvents = writtenEvents.filter((e) => e.type === "item_reserved");
    const fulfilledEvents = writtenEvents.filter((e) => e.type === "item_fulfilled");
    const aggregatingEvents = writtenEvents.filter((e) => e.type === "aggregating");
    const doneEvents = writtenEvents.filter((e) => e.type === "done");

    expect(splittingEvents).toHaveLength(1);
    expect(processingEvents).toHaveLength(3);
    expect(validatedEvents).toHaveLength(3);
    expect(reservedEvents).toHaveLength(3);
    expect(fulfilledEvents).toHaveLength(3);
    expect(aggregatingEvents).toHaveLength(1);
    expect(doneEvents).toHaveLength(1);
  });

  test("test_orderSplitter_processes_items_in_sequential_order", async () => {
    const { orderSplitter } = await loadWorkflow();
    await orderSplitter(SAMPLE_ORDER);

    const processingEvents = writtenEvents.filter((e) => e.type === "item_processing");
    expect(processingEvents.map((e) => e.index)).toEqual([0, 1, 2]);
    expect(processingEvents.map((e) => e.sku)).toEqual(["WIDGET-A1", "GADGET-B2", "SPRING-C3"]);
  });

  test("test_orderSplitter_handles_individual_item_failure_without_blocking_others", async () => {
    const { orderSplitter } = await loadWorkflow();
    const report = await orderSplitter(SAMPLE_ORDER, { failIndices: [1] });

    expect(report.status).toBe("done");
    expect(report.summary).toEqual({ fulfilled: 2, failed: 1, total: 3 });

    expect(report.results[0].status).toBe("fulfilled");
    expect(report.results[1].status).toBe("failed");
    expect(report.results[1].error).toContain("Insufficient stock for GADGET-B2");
    expect(report.results[2].status).toBe("fulfilled");

    const failedEvents = writtenEvents.filter((e) => e.type === "item_failed");
    expect(failedEvents).toHaveLength(1);
    expect(failedEvents[0].index).toBe(1);
    expect(failedEvents[0].sku).toBe("GADGET-B2");
  });

  test("test_orderSplitter_handles_multiple_failures_and_assembles_composite_result", async () => {
    const { orderSplitter } = await loadWorkflow();
    const report = await orderSplitter(SAMPLE_ORDER, { failIndices: [0, 2] });

    expect(report.summary).toEqual({ fulfilled: 1, failed: 2, total: 3 });
    expect(report.results[0].status).toBe("failed");
    expect(report.results[1].status).toBe("fulfilled");
    expect(report.results[2].status).toBe("failed");

    const doneEvent = writtenEvents.find((e) => e.type === "done") as Record<string, unknown>;
    const summary = doneEvent.summary as { fulfilled: number; failed: number; total: number };
    expect(summary).toEqual({ fulfilled: 1, failed: 2, total: 3 });
  });

  test("test_orderSplitter_generates_deterministic_hookTokens_for_fulfilled_items", async () => {
    const { orderSplitter } = await loadWorkflow();
    const report = await orderSplitter(SAMPLE_ORDER);

    expect(report.results[0].hookToken).toBe("ORD-TEST-001_item_0_WIDGET-A1");
    expect(report.results[1].hookToken).toBe("ORD-TEST-001_item_1_GADGET-B2");
    expect(report.results[2].hookToken).toBe("ORD-TEST-001_item_2_SPRING-C3");
  });

  test("test_orderSplitter_releases_writer_lock_for_workflow_and_each_step", async () => {
    const { orderSplitter } = await loadWorkflow();
    await orderSplitter(SAMPLE_ORDER);

    // 1 lock for the main workflow + 1 per item step = 4 total
    expect(releaseLockMock).toHaveBeenCalledTimes(4);
  });
});
