import { beforeEach, describe, expect, mock, test } from "bun:test";
import { contentBasedRouterFlow } from "@/workflows/content-based-router";

const startMock = mock(async () => ({ runId: "run-router-123" }));
const getRunUnusedMock = mock(() => {
  throw new Error("getRun should not be called in router start route test");
});

mock.module("workflow/api", () => ({
  start: startMock,
  getRun: getRunUnusedMock,
}));

describe("content-based-router start route", () => {
  beforeEach(() => {
    startMock.mockClear();
  });

  test("test_post_route_starts_workflow_and_returns_run_id_when_payload_is_valid", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/content-based-router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: "TKT-101",
          subject: "Invoice refund request for duplicate charge",
          priority: "high",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      runId: "run-router-123",
      ticketId: "TKT-101",
      subject: "Invoice refund request for duplicate charge",
      priority: "high",
      status: "routing",
    });

    expect(startMock).toHaveBeenCalledTimes(1);
    const [workflowFn, args] = startMock.mock.calls[0] as [
      typeof contentBasedRouterFlow,
      [string, string, "low" | "medium" | "high" | "urgent"],
    ];
    expect(workflowFn).toBe(contentBasedRouterFlow);
    expect(args).toEqual([
      "TKT-101",
      "Invoice refund request for duplicate charge",
      "high",
    ]);
  });

  test("test_post_route_defaults_invalid_priority_to_medium", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/content-based-router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: "TKT-102",
          subject: "Password reset not working",
          priority: "not-real",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      runId: "run-router-123",
      ticketId: "TKT-102",
      subject: "Password reset not working",
      priority: "medium",
      status: "routing",
    });
  });

  test("test_post_route_returns_400_when_subject_is_missing", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/content-based-router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: "TKT-103",
          priority: "urgent",
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "subject is required" });
    expect(startMock).toHaveBeenCalledTimes(0);
  });
});
