import { beforeEach, describe, expect, mock, test } from "bun:test";
import { publishSubscribeFlow } from "@/workflows/publish-subscribe";

const startMock = mock(async () => ({ runId: "run-pubsub-123" }));

mock.module("workflow/api", () => ({
  start: startMock,
}));

describe("POST /api/publish-subscribe", () => {
  beforeEach(() => {
    startMock.mockClear();
  });

  test("test_valid_post_returns_runId_topic_payload_and_status", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/publish-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: "orders",
          payload: "New order #1234",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      runId: "run-pubsub-123",
      topic: "orders",
      payload: "New order #1234",
      status: "publishing",
    });

    expect(startMock).toHaveBeenCalledTimes(1);
    const [workflowFn, args] = startMock.mock.calls[0] as [
      typeof publishSubscribeFlow,
      [string, string],
    ];
    expect(workflowFn).toBe(publishSubscribeFlow);
    expect(args).toEqual(["orders", "New order #1234"]);
  });

  test("test_missing_topic_returns_400", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/publish-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: "something" }),
      })
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toEqual({
      error: "topic is required (orders | inventory | shipping | analytics)",
    });
  });

  test("test_missing_payload_returns_400", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/publish-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: "orders" }),
      })
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toEqual({ error: "payload is required" });
  });

  test("test_invalid_topic_returns_400", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/publish-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: "bogus", payload: "data" }),
      })
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toEqual({
      error: "topic is required (orders | inventory | shipping | analytics)",
    });
  });
});
