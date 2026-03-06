import { beforeEach, describe, expect, mock, test } from "bun:test";

const getReadableMock = mock(() => {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: "step_start", step: "Extract", index: 0, total: 4 });
      controller.enqueue({ type: "pipeline_done", totalMs: 3000 });
      controller.close();
    },
  });
});

const getRunMock = mock((_runId: string) => ({
  getReadable: getReadableMock,
}));
const startUnusedMock = mock(async () => {
  throw new Error("start should not be called in readable route test");
});

mock.module("workflow/api", () => ({
  getRun: getRunMock,
  start: startUnusedMock,
}));

describe("pipeline readable stream route", () => {
  beforeEach(() => {
    getRunMock.mockClear();
    getReadableMock.mockClear();
  });

  test("returns SSE stream with proper headers when run exists", async () => {
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/readable/run-1") as never,
      { params: Promise.resolve({ runId: "run-1" }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(response.headers.get("connection")).toBe("keep-alive");
    expect(response.headers.get("x-accel-buffering")).toBe("no");
    expect(getRunMock).toHaveBeenCalledWith("run-1");
    expect(getReadableMock).toHaveBeenCalledTimes(1);

    const text = await response.text();
    expect(text).toContain("data: ");
    expect(text).toContain('"type":"step_start"');
    expect(text).toContain('"type":"pipeline_done"');
  });

  test("returns 404 JSON error when run does not exist", async () => {
    getRunMock.mockImplementationOnce(() => {
      throw new Error("not found");
    });

    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/readable/bad-id") as never,
      { params: Promise.resolve({ runId: "bad-id" }) }
    );

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("RUN_NOT_FOUND");
  });
});
