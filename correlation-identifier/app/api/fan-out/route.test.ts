import { beforeEach, describe, expect, mock, test } from "bun:test";
import { correlationIdentifierFlow } from "@/workflows/correlation-identifier";

const startMock = mock(async () => ({ runId: "run-corr-456" }));
const getRunUnusedMock = mock(() => {
  throw new Error("getRun should not be called in correlation-identifier start route test");
});

mock.module("workflow/api", () => ({
  start: startMock,
  getRun: getRunUnusedMock,
}));

describe("correlation-identifier route", () => {
  beforeEach(() => {
    startMock.mockClear();
  });

  test("test_post_route_starts_workflow_and_returns_run_id_when_payload_is_valid", async () => {
    const { POST } = await import("../../api/correlation-identifier/route");

    const response = await POST(
      new Request("http://localhost/api/correlation-identifier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: "REQ-4001",
          service: "payment-api",
          payload: "charge $49.99 to card ending 4242",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      runId: "run-corr-456",
      requestId: "REQ-4001",
      service: "payment-api",
      status: "correlating",
    });

    expect(startMock).toHaveBeenCalledTimes(1);
    const [workflowFn, args] = startMock.mock.calls[0] as [
      typeof correlationIdentifierFlow,
      [string, string, string],
    ];
    expect(workflowFn).toBe(correlationIdentifierFlow);
    expect(args).toEqual([
      "REQ-4001",
      "payment-api",
      "charge $49.99 to card ending 4242",
    ]);
  });

  test("test_post_route_returns_400_when_requestId_is_missing", async () => {
    const { POST } = await import("../../api/correlation-identifier/route");

    const response = await POST(
      new Request("http://localhost/api/correlation-identifier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service: "payment-api",
          payload: "charge $49.99",
        }),
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("requestId is required");
  });

  test("test_post_route_returns_400_when_payload_is_missing", async () => {
    const { POST } = await import("../../api/correlation-identifier/route");

    const response = await POST(
      new Request("http://localhost/api/correlation-identifier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: "REQ-4001",
          service: "payment-api",
        }),
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("payload is required");
  });

  test("test_post_route_defaults_to_payment_api_when_service_is_invalid", async () => {
    const { POST } = await import("../../api/correlation-identifier/route");

    const response = await POST(
      new Request("http://localhost/api/correlation-identifier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: "REQ-4001",
          service: "invalid-service",
          payload: "charge $49.99",
        }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.service).toBe("payment-api");
  });
});
