import { beforeEach, describe, expect, mock, test } from "bun:test";

const getReadableMock = mock(() => {
  return new ReadableStream({
    start(controller) {
      // Enqueue raw data — the route wraps it in SSE framing via TransformStream
      controller.enqueue({"chunk":"ok"});
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

describe("readable stream real route", () => {
  beforeEach(() => {
    getRunMock.mockClear();
    getReadableMock.mockClear();
  });

  test("test_get_route_returns_sse_stream_when_run_id_is_valid", async () => {
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/readable/run-1") as never,
      {
        params: Promise.resolve({ runId: "run-1" }),
      }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(response.headers.get("connection")).toBe("keep-alive");
    expect(response.headers.get("x-accel-buffering")).toBe("no");
    expect(getRunMock).toHaveBeenCalledWith("run-1");
    expect(getReadableMock).toHaveBeenCalledTimes(1);
    expect(await response.text()).toBe('data: {"chunk":"ok"}\n\n');
  });
});
