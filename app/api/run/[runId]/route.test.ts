import { beforeEach, describe, expect, mock, test } from "bun:test";

const getRunMock = mock((_runId: string) => ({
  status: Promise.resolve("completed"),
  workflowName: Promise.resolve("incidentFanOut"),
  createdAt: Promise.resolve(new Date("2026-02-27T00:00:00.000Z")),
  startedAt: Promise.resolve(new Date("2026-02-27T00:00:01.000Z")),
  completedAt: Promise.resolve(new Date("2026-02-27T00:00:02.000Z")),
}));
const startUnusedMock = mock(async () => {
  throw new Error("start should not be called in run status route test");
});

mock.module("workflow/api", () => ({
  getRun: getRunMock,
  start: startUnusedMock,
}));

describe("run status real route", () => {
  beforeEach(() => {
    getRunMock.mockClear();
  });

  test("test_get_route_returns_workflow_run_metadata_when_run_exists", async () => {
    const { GET } = await import("./route");

    const response = await GET(new Request("http://localhost/api/run/run-1"), {
      params: Promise.resolve({ runId: "run-1" }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      runId: "run-1",
      status: "completed",
      workflowName: "incidentFanOut",
      createdAt: "2026-02-27T00:00:00.000Z",
      startedAt: "2026-02-27T00:00:01.000Z",
      completedAt: "2026-02-27T00:00:02.000Z",
    });
    expect(getRunMock).toHaveBeenCalledWith("run-1");
  });
});
