import { beforeEach, describe, expect, mock, test } from "bun:test";
import { wireTap } from "@/workflows/wire-tap";

const startMock = mock(async () => ({ runId: "run-wiretap-123" }));
const getRunUnusedMock = mock(() => {
  throw new Error("getRun should not be called in wire-tap start route test");
});

mock.module("workflow/api", () => ({
  start: startMock,
  getRun: getRunUnusedMock,
}));

describe("wire-tap route", () => {
  beforeEach(() => {
    startMock.mockClear();
  });

  test("test_post_returns_400_when_orderId_is_missing", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/wire-tap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: "Widget", quantity: 2 }),
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "orderId is required" });
  });

  test("test_post_returns_400_when_item_is_missing", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/wire-tap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "ORD-1", quantity: 2 }),
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "item is required" });
  });

  test("test_post_returns_400_when_quantity_is_zero", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/wire-tap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: "ORD-1",
          item: "Widget",
          quantity: 0,
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "quantity must be > 0" });
  });

  test("test_post_returns_400_when_quantity_is_negative", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/wire-tap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: "ORD-1",
          item: "Widget",
          quantity: -3,
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "quantity must be > 0" });
  });

  test("test_post_returns_200_with_runId_and_order_details_for_valid_input", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/wire-tap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: "ORD-7042",
          item: "Ergonomic Keyboard",
          quantity: 3,
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      runId: "run-wiretap-123",
      orderId: "ORD-7042",
      item: "Ergonomic Keyboard",
      quantity: 3,
      status: "processing",
    });

    expect(startMock).toHaveBeenCalledTimes(1);
    const [workflowFn, args] = startMock.mock.calls[0] as [
      typeof wireTap,
      [string, string, number],
    ];
    expect(workflowFn).toBe(wireTap);
    expect(args).toEqual(["ORD-7042", "Ergonomic Keyboard", 3]);
  });
});
