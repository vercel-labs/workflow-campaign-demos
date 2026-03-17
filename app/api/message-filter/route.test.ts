import { beforeEach, describe, expect, mock, test } from "bun:test";
import { orderFilter } from "@/workflows/order-filter";

const startMock = mock(async () => ({ runId: "run-filter-456" }));

mock.module("workflow/api", () => ({
  start: startMock,
}));

describe("message-filter route", () => {
  beforeEach(() => {
    startMock.mockClear();
  });

  test("test_post_route_starts_workflow_and_returns_run_id_with_config", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/message-filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: {
            fraudThreshold: 50,
            minAmount: 20,
            allowedRegions: ["US"],
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      runId: "run-filter-456",
      config: {
        fraudThreshold: 50,
        minAmount: 20,
        allowedRegions: ["US"],
      },
      status: "filtering",
    });

    expect(startMock).toHaveBeenCalledTimes(1);
    const [workflowFn, args] = startMock.mock.calls[0] as [
      typeof orderFilter,
      [unknown],
    ];
    expect(workflowFn).toBe(orderFilter);
    expect(args).toEqual([
      {
        fraudThreshold: 50,
        minAmount: 20,
        allowedRegions: ["US"],
      },
    ]);
  });

  test("test_post_route_uses_default_config_when_no_config_provided", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/message-filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.runId).toBe("run-filter-456");
    expect(json.config).toBeUndefined();
    expect(json.status).toBe("filtering");

    const [, args] = startMock.mock.calls[0] as [typeof orderFilter, [unknown]];
    expect(args).toEqual([undefined]);
  });
});
