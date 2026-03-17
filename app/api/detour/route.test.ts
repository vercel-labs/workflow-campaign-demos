import { beforeEach, describe, expect, mock, test } from "bun:test";
import { detourFlow } from "@/workflows/detour";

const startMock = mock(async () => ({ runId: "run-detour-123" }));
const getRunUnusedMock = mock(() => {
  throw new Error("getRun should not be called in detour start route test");
});

mock.module("workflow/api", () => ({
  start: startMock,
  getRun: getRunUnusedMock,
}));

describe("detour start route", () => {
  beforeEach(() => {
    startMock.mockClear();
  });

  test("test_post_route_starts_workflow_and_returns_run_id_when_payload_is_valid", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/detour", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deployId: "DEPLOY-100",
          qaMode: true,
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      runId: "run-detour-123",
      deployId: "DEPLOY-100",
      qaMode: true,
      status: "deploying",
    });

    expect(startMock).toHaveBeenCalledTimes(1);
    const [workflowFn, args] = startMock.mock.calls[0] as [
      typeof detourFlow,
      [string, boolean],
    ];
    expect(workflowFn).toBe(detourFlow);
    expect(args).toEqual(["DEPLOY-100", true]);
  });

  test("test_post_route_defaults_qaMode_to_false_when_not_provided", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/detour", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deployId: "DEPLOY-101" }),
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.qaMode).toBe(false);
  });

  test("test_post_route_returns_400_when_deployId_is_missing", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/detour", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qaMode: true }),
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("deployId is required");
  });
});
