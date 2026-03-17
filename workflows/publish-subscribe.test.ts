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
  sleep: mock(async () => {}),
}));

async function loadWorkflow() {
  return import("./publish-subscribe");
}

describe("publish-subscribe workflow", () => {
  beforeEach(() => {
    writtenEvents.length = 0;
    releaseLockMock.mockClear();
    writeMock.mockClear();
    getWriterMock.mockClear();
    getWritableMock.mockClear();
  });

  test("test_orders_topic_delivers_to_all_matching_subscribers", async () => {
    const { publishSubscribeFlow } = await loadWorkflow();
    const result = await publishSubscribeFlow("orders", "New order placed");

    // Orders topic matches: Order Service, Email Notifier, Analytics Pipeline, Billing Service (4)
    // Skipped: Warehouse API (1)
    expect(result.topic).toBe("orders");
    expect(result.delivered).toBe(4);
    expect(result.skipped).toBe(1);

    // Verify subscribers_registered event was emitted
    const registered = writtenEvents.find((e) => e.type === "subscribers_registered");
    expect(registered).toBeTruthy();
    expect((registered as { subscribers: unknown[] }).subscribers).toHaveLength(5);

    // Verify message_published event
    const published = writtenEvents.find((e) => e.type === "message_published");
    expect(published).toBeTruthy();
    expect((published as { topic: string }).topic).toBe("orders");

    // Verify delivering/delivered pairs for matched subscribers
    const deliveringEvents = writtenEvents.filter((e) => e.type === "delivering");
    const deliveredEvents = writtenEvents.filter((e) => e.type === "delivered");
    expect(deliveringEvents).toHaveLength(4);
    expect(deliveredEvents).toHaveLength(4);

    // Verify done event
    const done = writtenEvents.find((e) => e.type === "done");
    expect(done).toBeTruthy();
    expect((done as { delivered: number }).delivered).toBe(4);
    expect((done as { skipped: number }).skipped).toBe(1);
  });

  test("test_filtering_skips_non_matching_subscribers_and_emits_skip_events", async () => {
    const { publishSubscribeFlow } = await loadWorkflow();
    // Shipping topic matches: Warehouse API, Email Notifier, Analytics Pipeline (3)
    // Skipped: Order Service, Billing Service (2)
    const result = await publishSubscribeFlow("shipping", "Package dispatched");

    expect(result.delivered).toBe(3);
    expect(result.skipped).toBe(2);

    const skippedEvents = writtenEvents.filter((e) => e.type === "subscriber_skipped");
    expect(skippedEvents).toHaveLength(2);

    const skippedNames = skippedEvents.map((e) => (e as { subscriberName: string }).subscriberName);
    expect(skippedNames).toContain("Order Service");
    expect(skippedNames).toContain("Billing Service");
  });

  test("test_analytics_topic_only_matches_analytics_pipeline", async () => {
    const { publishSubscribeFlow } = await loadWorkflow();
    // Analytics topic matches only: Analytics Pipeline (1)
    // Skipped: Order Service, Warehouse API, Email Notifier, Billing Service (4)
    const result = await publishSubscribeFlow("analytics", "Daily report");

    expect(result.delivered).toBe(1);
    expect(result.skipped).toBe(4);

    const deliveredEvents = writtenEvents.filter((e) => e.type === "delivered");
    expect(deliveredEvents).toHaveLength(1);
    expect((deliveredEvents[0] as { subscriberName: string }).subscriberName).toBe(
      "Analytics Pipeline"
    );
  });

  test("test_done_event_summary_counts_are_correct_for_inventory_topic", async () => {
    const { publishSubscribeFlow } = await loadWorkflow();
    // Inventory topic matches: Order Service, Warehouse API, Analytics Pipeline (3)
    // Skipped: Email Notifier, Billing Service (2)
    const result = await publishSubscribeFlow("inventory", "Stock update");

    expect(result).toEqual({
      topic: "inventory",
      delivered: 3,
      skipped: 2,
    });

    const done = writtenEvents.find((e) => e.type === "done") as {
      topic: string;
      delivered: number;
      skipped: number;
    };
    expect(done.topic).toBe("inventory");
    expect(done.delivered).toBe(3);
    expect(done.skipped).toBe(2);

    // releaseLock called once per step (register, filter, deliver, summarize = 4)
    expect(releaseLockMock).toHaveBeenCalledTimes(4);
  });
});
