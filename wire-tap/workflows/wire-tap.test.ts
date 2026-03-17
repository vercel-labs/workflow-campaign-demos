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
  return import("./wire-tap");
}

describe("wire-tap workflow", () => {
  beforeEach(() => {
    writtenEvents.length = 0;
    releaseLockMock.mockClear();
    writeMock.mockClear();
    getWriterMock.mockClear();
    getWritableMock.mockClear();
  });

  test("test_wireTap_pipeline_validate_sets_validated_true", async () => {
    const { wireTap } = await loadWorkflow();
    const result = await wireTap("ORD-1", "Widget", 2);

    const validateTap = writtenEvents.find(
      (e) => e.type === "tap_captured" && e.stage === "validate"
    );
    expect(validateTap).toBeTruthy();
    const snapshot = validateTap!.snapshot as Record<string, unknown>;
    expect(snapshot.validated).toBe(true);
    expect(snapshot.orderId).toBe("ORD-1");
    expect(snapshot.item).toBe("Widget");
    expect(snapshot.quantity).toBe(2);
  });

  test("test_wireTap_pipeline_enrich_adds_price_and_total", async () => {
    const { wireTap } = await loadWorkflow();
    await wireTap("ORD-1", "Widget", 3);

    const enrichTap = writtenEvents.find(
      (e) => e.type === "tap_captured" && e.stage === "enrich"
    );
    expect(enrichTap).toBeTruthy();
    const snapshot = enrichTap!.snapshot as Record<string, unknown>;
    expect(snapshot.price).toBe(29.99);
    expect(snapshot.total).toBe(29.99 * 3);
    expect(snapshot.validated).toBe(true);
  });

  test("test_wireTap_pipeline_transform_adds_format", async () => {
    const { wireTap } = await loadWorkflow();
    await wireTap("ORD-1", "Widget", 1);

    const transformTap = writtenEvents.find(
      (e) => e.type === "tap_captured" && e.stage === "transform"
    );
    expect(transformTap).toBeTruthy();
    const snapshot = transformTap!.snapshot as Record<string, unknown>;
    expect(snapshot.format).toBe("canonical-v2");
  });

  test("test_wireTap_pipeline_deliver_adds_deliveredTo", async () => {
    const { wireTap } = await loadWorkflow();
    await wireTap("ORD-1", "Widget", 1);

    const deliverTap = writtenEvents.find(
      (e) => e.type === "tap_captured" && e.stage === "deliver"
    );
    expect(deliverTap).toBeTruthy();
    const snapshot = deliverTap!.snapshot as Record<string, unknown>;
    expect(snapshot.deliveredTo).toBe("warehouse-us-east-1");
  });

  test("test_wireTap_completes_with_4_audit_entries_and_done_event", async () => {
    const { wireTap } = await loadWorkflow();
    const result = await wireTap("ORD-1", "Widget", 2);

    expect(result.status).toBe("completed");
    expect(result.orderId).toBe("ORD-1");
    expect(result.auditTrail).toHaveLength(4);

    const stages = result.auditTrail.map(
      (entry: { stage: string }) => entry.stage
    );
    expect(stages).toEqual(["validate", "enrich", "transform", "deliver"]);

    const doneEvent = writtenEvents.find((e) => e.type === "done");
    expect(doneEvent).toBeTruthy();
    expect(doneEvent!.auditCount).toBe(4);
  });

  test("test_wireTap_emits_stage_start_tap_captured_stage_done_for_each_stage", async () => {
    const { wireTap } = await loadWorkflow();
    await wireTap("ORD-1", "Widget", 1);

    for (const stage of ["validate", "enrich", "transform", "deliver"]) {
      expect(
        writtenEvents.some((e) => e.type === "stage_start" && e.stage === stage)
      ).toBe(true);
      expect(
        writtenEvents.some(
          (e) => e.type === "tap_captured" && e.stage === stage
        )
      ).toBe(true);
      expect(
        writtenEvents.some(
          (e) => e.type === "stage_done" && e.stage === stage
        )
      ).toBe(true);
    }
  });

  test("test_wireTap_releases_writer_lock_for_every_step", async () => {
    const { wireTap } = await loadWorkflow();
    await wireTap("ORD-1", "Widget", 1);

    // 4 stage steps + 1 emitDone step = 5 lock releases
    expect(releaseLockMock).toHaveBeenCalledTimes(5);
  });

  test("test_wireTap_throws_FatalError_when_quantity_is_zero", async () => {
    const { wireTap } = await loadWorkflow();

    await expect(wireTap("ORD-1", "Widget", 0)).rejects.toThrow(
      "Invalid quantity: must be greater than 0"
    );
  });

  test("test_wireTap_throws_FatalError_when_quantity_is_negative", async () => {
    const { wireTap } = await loadWorkflow();

    await expect(wireTap("ORD-1", "Widget", -5)).rejects.toThrow(
      "Invalid quantity: must be greater than 0"
    );
  });
});
