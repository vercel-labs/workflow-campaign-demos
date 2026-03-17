import { beforeEach, describe, expect, mock, test } from "bun:test";
import { incidentFanOut } from "@/workflows/incident-fanout";

const startMock = mock(async () => ({ runId: "run-fanout-123" }));
const getRunUnusedMock = mock(() => {
  throw new Error("getRun should not be called in fan-out start route test");
});

mock.module("workflow/api", () => ({
  start: startMock,
  getRun: getRunUnusedMock,
}));

describe("fan-out real route", () => {
  beforeEach(() => {
    startMock.mockClear();
  });

  test("test_post_route_starts_workflow_and_returns_run_id_when_payload_is_valid", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/fan-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId: "INC-200",
          message: "Payment API latency spike",
          failures: {
            transient: ["slack"],
            permanent: ["sms"],
          },
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      runId: "run-fanout-123",
      incidentId: "INC-200",
      message: "Payment API latency spike",
      failures: {
        transient: ["slack"],
        permanent: ["sms"],
      },
      status: "fan_out",
    });

    expect(startMock).toHaveBeenCalledTimes(1);
    const [workflowFn, args] = startMock.mock.calls[0] as [
      typeof incidentFanOut,
      [string, string, { transient: string[]; permanent: string[] }],
    ];
    expect(workflowFn).toBe(incidentFanOut);
    expect(args).toEqual([
      "INC-200",
      "Payment API latency spike",
      { transient: ["slack"], permanent: ["sms"] },
    ]);
  });
});
