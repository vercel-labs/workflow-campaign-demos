import { describe, expect, test } from "bun:test";

import {
  applyPubSubEvent,
  createAccumulator,
  parsePubSubEvent,
} from "./demo";

describe("publish-subscribe demo controls", () => {
  // --- parsePubSubEvent: all 7 event types ---

  test("test_parsePubSubEvent_parses_subscribers_registered", () => {
    const event = parsePubSubEvent(
      'data: {"type":"subscribers_registered","subscribers":[{"id":"sub-1","name":"Order Service","topics":["orders","inventory"]}]}\n\n'
    );
    expect(event).toEqual({
      type: "subscribers_registered",
      subscribers: [{ id: "sub-1", name: "Order Service", topics: ["orders", "inventory"] }],
    });
  });

  test("test_parsePubSubEvent_parses_message_published", () => {
    const event = parsePubSubEvent(
      'data: {"type":"message_published","topic":"orders","payload":"New order #ORD-9182"}\n\n'
    );
    expect(event).toEqual({
      type: "message_published",
      topic: "orders",
      payload: "New order #ORD-9182",
    });
  });

  test("test_parsePubSubEvent_parses_filtering", () => {
    const event = parsePubSubEvent(
      'data: {"type":"filtering","topic":"orders","total":5,"matched":3}\n\n'
    );
    expect(event).toEqual({
      type: "filtering",
      topic: "orders",
      total: 5,
      matched: 3,
    });
  });

  test("test_parsePubSubEvent_parses_delivering", () => {
    const event = parsePubSubEvent(
      'data: {"type":"delivering","subscriberId":"sub-1","subscriberName":"Order Service","topic":"orders"}\n\n'
    );
    expect(event).toEqual({
      type: "delivering",
      subscriberId: "sub-1",
      subscriberName: "Order Service",
      topic: "orders",
    });
  });

  test("test_parsePubSubEvent_parses_delivered", () => {
    const event = parsePubSubEvent(
      'data: {"type":"delivered","subscriberId":"sub-1","subscriberName":"Order Service","topic":"orders"}\n\n'
    );
    expect(event).toEqual({
      type: "delivered",
      subscriberId: "sub-1",
      subscriberName: "Order Service",
      topic: "orders",
    });
  });

  test("test_parsePubSubEvent_parses_subscriber_skipped", () => {
    const event = parsePubSubEvent(
      'data: {"type":"subscriber_skipped","subscriberId":"sub-2","subscriberName":"Warehouse API","topic":"orders"}\n\n'
    );
    expect(event).toEqual({
      type: "subscriber_skipped",
      subscriberId: "sub-2",
      subscriberName: "Warehouse API",
      topic: "orders",
    });
  });

  test("test_parsePubSubEvent_parses_done", () => {
    const event = parsePubSubEvent(
      'data: {"type":"done","topic":"orders","delivered":3,"skipped":2}\n\n'
    );
    expect(event).toEqual({
      type: "done",
      topic: "orders",
      delivered: 3,
      skipped: 2,
    });
  });

  // --- parsePubSubEvent: malformed data ---

  test("test_parsePubSubEvent_returns_null_for_empty_chunk", () => {
    expect(parsePubSubEvent("")).toBeNull();
  });

  test("test_parsePubSubEvent_returns_null_for_invalid_json", () => {
    expect(parsePubSubEvent("data: {not-json}\n\n")).toBeNull();
  });

  test("test_parsePubSubEvent_returns_null_for_unknown_type", () => {
    expect(parsePubSubEvent('data: {"type":"unknown_event"}\n\n')).toBeNull();
  });

  test("test_parsePubSubEvent_returns_null_for_missing_required_fields", () => {
    // done event missing "delivered" field
    expect(
      parsePubSubEvent('data: {"type":"done","topic":"orders","skipped":2}\n\n')
    ).toBeNull();
  });

  // --- accumulator state transitions ---

  test("test_accumulator_transitions_from_publishing_through_done", () => {
    const start = {
      runId: "run-1",
      topic: "orders" as const,
      payload: "New order",
      status: "publishing" as const,
    };

    const acc = createAccumulator(start);
    expect(acc.status).toBe("publishing");
    expect(acc.delivered).toBe(0);
    expect(acc.skipped).toBe(0);

    // Register subscribers
    const afterRegistered = applyPubSubEvent(acc, {
      type: "subscribers_registered",
      subscribers: [
        { id: "sub-1", name: "Order Service", topics: ["orders", "inventory"] },
        { id: "sub-2", name: "Warehouse API", topics: ["inventory", "shipping"] },
      ],
    });
    expect(Object.keys(afterRegistered.subscribers)).toHaveLength(2);
    expect(afterRegistered.subscribers["sub-1"].status).toBe("idle");

    // Message published -> status becomes filtering
    const afterPublished = applyPubSubEvent(afterRegistered, {
      type: "message_published",
      topic: "orders",
      payload: "New order",
    });
    expect(afterPublished.status).toBe("filtering");

    // Skip non-matching subscriber
    const afterSkipped = applyPubSubEvent(afterPublished, {
      type: "subscriber_skipped",
      subscriberId: "sub-2",
      subscriberName: "Warehouse API",
      topic: "orders",
    });
    expect(afterSkipped.subscribers["sub-2"].status).toBe("skipped");
    expect(afterSkipped.skipped).toBe(1);

    // Delivering to matched subscriber
    const afterDelivering = applyPubSubEvent(afterSkipped, {
      type: "delivering",
      subscriberId: "sub-1",
      subscriberName: "Order Service",
      topic: "orders",
    });
    expect(afterDelivering.status).toBe("delivering");
    expect(afterDelivering.subscribers["sub-1"].status).toBe("delivering");

    // Delivered
    const afterDelivered = applyPubSubEvent(afterDelivering, {
      type: "delivered",
      subscriberId: "sub-1",
      subscriberName: "Order Service",
      topic: "orders",
    });
    expect(afterDelivered.subscribers["sub-1"].status).toBe("delivered");
    expect(afterDelivered.delivered).toBe(1);

    // Done
    const afterDone = applyPubSubEvent(afterDelivered, {
      type: "done",
      topic: "orders",
      delivered: 1,
      skipped: 1,
    });
    expect(afterDone.status).toBe("done");
  });
});
