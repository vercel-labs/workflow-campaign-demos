import { beforeEach, describe, expect, mock, test } from "bun:test";
import { orderSplitter } from "@/workflows/order-splitter";

const startMock = mock(async () => ({ runId: "run-splitter-456" }));
const getRunUnusedMock = mock(() => {
  throw new Error("getRun should not be called in splitter start route test");
});

mock.module("workflow/api", () => ({
  start: startMock,
  getRun: getRunUnusedMock,
}));

describe("splitter API route", () => {
  beforeEach(() => {
    startMock.mockClear();
  });

  test("test_post_route_starts_workflow_and_returns_run_id_when_payload_is_valid", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/splitter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: "ORD-200",
          items: [
            { sku: "W-1", name: "Widget", quantity: 3, warehouse: "us-east-1" },
            { sku: "G-2", name: "Gadget", quantity: 1, warehouse: "us-west-2" },
          ],
          failures: { failIndices: [1] },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      runId: "run-splitter-456",
      orderId: "ORD-200",
      itemCount: 2,
      status: "splitting",
    });

    expect(startMock).toHaveBeenCalledTimes(1);
    const [workflowFn, args] = startMock.mock.calls[0] as [
      typeof orderSplitter,
      [{ orderId: string; items: unknown[] }, { failIndices: number[] }],
    ];
    expect(workflowFn).toBe(orderSplitter);
    expect(args[0].orderId).toBe("ORD-200");
    expect(args[0].items).toHaveLength(2);
    expect(args[1]).toEqual({ failIndices: [1] });
  });

  test("test_post_route_returns_400_when_orderId_is_missing", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/splitter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ sku: "X", name: "X", quantity: 1, warehouse: "w" }] }),
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("orderId");
  });

  test("test_post_route_returns_400_when_items_array_is_empty", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/splitter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "ORD-300", items: [] }),
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("items");
  });
});
