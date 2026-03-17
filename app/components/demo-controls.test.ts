import { describe, expect, test } from "bun:test";

import {
  createAccumulator,
  applySplitEvent,
  parseSplitterEvent,
} from "./demo";

describe("splitter demo controls", () => {
  const startResponse = {
    runId: "run-1",
    orderId: "ORD-TEST",
    itemCount: 3,
    status: "splitting" as const,
  };

  test("test_createAccumulator_returns_initial_state_with_empty_items", () => {
    const acc = createAccumulator(startResponse);
    expect(acc.runId).toBe("run-1");
    expect(acc.orderId).toBe("ORD-TEST");
    expect(acc.status).toBe("splitting");
    expect(acc.items).toEqual([]);
  });

  test("test_applySplitEvent_adds_item_on_item_processing_event", () => {
    const acc = createAccumulator(startResponse);
    const next = applySplitEvent(acc, {
      type: "item_processing",
      index: 0,
      sku: "W-1",
      name: "Widget",
    });

    expect(next.items).toHaveLength(1);
    expect(next.items[0].status).toBe("processing");
    expect(next.items[0].sku).toBe("W-1");
  });

  test("test_applySplitEvent_transitions_item_through_validate_reserve_fulfill", () => {
    let acc = createAccumulator(startResponse);
    acc = applySplitEvent(acc, { type: "item_processing", index: 0, sku: "W-1", name: "Widget" });
    acc = applySplitEvent(acc, { type: "item_validated", index: 0, sku: "W-1" });
    expect(acc.items[0].status).toBe("validated");

    acc = applySplitEvent(acc, { type: "item_reserved", index: 0, sku: "W-1", warehouse: "us-east-1" });
    expect(acc.items[0].status).toBe("reserved");
    expect(acc.items[0].warehouse).toBe("us-east-1");

    acc = applySplitEvent(acc, { type: "item_fulfilled", index: 0, sku: "W-1", hookToken: "tok-0" });
    expect(acc.items[0].status).toBe("fulfilled");
    expect(acc.items[0].hookToken).toBe("tok-0");
  });

  test("test_applySplitEvent_marks_item_failed_with_error_message", () => {
    let acc = createAccumulator(startResponse);
    acc = applySplitEvent(acc, { type: "item_processing", index: 0, sku: "W-1", name: "Widget" });
    acc = applySplitEvent(acc, { type: "item_validated", index: 0, sku: "W-1" });
    acc = applySplitEvent(acc, { type: "item_failed", index: 0, sku: "W-1", error: "Out of stock" });

    expect(acc.items[0].status).toBe("failed");
    expect(acc.items[0].error).toBe("Out of stock");
  });

  test("test_applySplitEvent_transitions_to_aggregating_and_done_with_summary", () => {
    let acc = createAccumulator(startResponse);
    acc = applySplitEvent(acc, { type: "aggregating" });
    expect(acc.status).toBe("aggregating");

    acc = applySplitEvent(acc, { type: "done", summary: { fulfilled: 2, failed: 1, total: 3 } });
    expect(acc.status).toBe("done");
    expect(acc.summary).toEqual({ fulfilled: 2, failed: 1, total: 3 });
  });

  test("test_applySplitEvent_accumulates_multiple_items_independently", () => {
    let acc = createAccumulator(startResponse);
    acc = applySplitEvent(acc, { type: "item_processing", index: 0, sku: "W-1", name: "Widget" });
    acc = applySplitEvent(acc, { type: "item_fulfilled", index: 0, sku: "W-1", hookToken: "tok-0" });
    acc = applySplitEvent(acc, { type: "item_processing", index: 1, sku: "G-2", name: "Gadget" });
    acc = applySplitEvent(acc, { type: "item_failed", index: 1, sku: "G-2", error: "No stock" });

    expect(acc.items).toHaveLength(2);
    expect(acc.items[0].status).toBe("fulfilled");
    expect(acc.items[1].status).toBe("failed");
  });

  test("test_parseSplitterEvent_parses_splitting_event_from_sse_chunk", () => {
    const event = parseSplitterEvent(
      'data: {"type":"splitting","orderId":"ORD-1","itemCount":3}\n\n'
    );
    expect(event).toEqual({ type: "splitting", orderId: "ORD-1", itemCount: 3 });
  });

  test("test_parseSplitterEvent_parses_done_event_with_summary", () => {
    const event = parseSplitterEvent(
      'data: {"type":"done","summary":{"fulfilled":2,"failed":1,"total":3}}\n\n'
    );
    expect(event).toEqual({
      type: "done",
      summary: { fulfilled: 2, failed: 1, total: 3 },
    });
  });

  test("test_parseSplitterEvent_returns_null_for_invalid_chunk", () => {
    expect(parseSplitterEvent("not valid sse")).toBeNull();
    expect(parseSplitterEvent('data: {"type":"unknown_type"}\n\n')).toBeNull();
    expect(parseSplitterEvent("")).toBeNull();
  });

  test("test_parseSplitterEvent_parses_item_fulfilled_event", () => {
    const event = parseSplitterEvent(
      'data: {"type":"item_fulfilled","index":1,"sku":"G-2","hookToken":"tok-1"}\n\n'
    );
    expect(event).toEqual({
      type: "item_fulfilled",
      index: 1,
      sku: "G-2",
      hookToken: "tok-1",
    });
  });

  test("test_parseSplitterEvent_parses_item_failed_event", () => {
    const event = parseSplitterEvent(
      'data: {"type":"item_failed","index":0,"sku":"W-1","error":"Out of stock"}\n\n'
    );
    expect(event).toEqual({
      type: "item_failed",
      index: 0,
      sku: "W-1",
      error: "Out of stock",
    });
  });
});
