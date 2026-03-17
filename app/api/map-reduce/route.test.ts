import { beforeEach, describe, expect, mock, test } from "bun:test";
import { mapReduce } from "@/workflows/map-reduce";

const startMock = mock(async () => ({ runId: "run-mr-123" }));
const getRunUnusedMock = mock(() => {
  throw new Error("getRun should not be called in map-reduce start route test");
});

mock.module("workflow/api", () => ({
  start: startMock,
  getRun: getRunUnusedMock,
}));

describe("map-reduce real route", () => {
  beforeEach(() => {
    startMock.mockClear();
  });

  test("test_post_route_starts_workflow_and_returns_run_id_when_payload_is_valid", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/map-reduce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: "mr-001",
          items: [10, 20, 30],
          chunkSize: 2,
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      runId: "run-mr-123",
      jobId: "mr-001",
      items: [10, 20, 30],
      chunkSize: 2,
      status: "mapping",
    });

    expect(startMock).toHaveBeenCalledTimes(1);
    const [workflowFn, args] = startMock.mock.calls[0] as [
      typeof mapReduce,
      [string, number[], number],
    ];
    expect(workflowFn).toBe(mapReduce);
    expect(args).toEqual(["mr-001", [10, 20, 30], 2]);
  });

  test("test_post_route_returns_400_when_jobId_is_missing", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/map-reduce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [1, 2, 3] }),
      })
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("jobId is required");
  });
});
