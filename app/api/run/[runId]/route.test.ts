import { beforeEach, describe, expect, mock, test } from "bun:test";

function makeFakeRun(overrides: Record<string, unknown> = {}) {
  return {
    status: Promise.resolve(overrides.status ?? "running"),
    workflowName: Promise.resolve(overrides.workflowName ?? "generateReport"),
    createdAt: Promise.resolve(overrides.createdAt ?? new Date("2026-01-01T00:00:00Z")),
    startedAt: Promise.resolve(overrides.startedAt ?? new Date("2026-01-01T00:00:01Z")),
    completedAt: Promise.resolve(overrides.completedAt ?? null),
    cancel: mock(async () => {}),
  };
}

let fakeRun = makeFakeRun();

const getRunMock = mock((runId: string) => {
  if (runId === "not-found") throw new Error("not found");
  return fakeRun;
});

const startUnusedMock = mock(async () => {
  throw new Error("start should not be called in run route test");
});

mock.module("workflow/api", () => ({
  getRun: getRunMock,
  start: startUnusedMock,
}));

function ctx(runId: string) {
  return { params: Promise.resolve({ runId }) };
}

describe("run/[runId] GET", () => {
  beforeEach(() => {
    fakeRun = makeFakeRun();
    getRunMock.mockClear();
  });

  test("returns run metadata for existing run", async () => {
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/run/run-1"),
      ctx("run-1"),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.runId).toBe("run-1");
    expect(json.status).toBe("running");
    expect(json.workflowName).toBe("generateReport");
    expect(json.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(json.startedAt).toBe("2026-01-01T00:00:01.000Z");
    expect(json.completedAt).toBeNull();
  });

  test("returns 404 for unknown run", async () => {
    const { GET } = await import("./route");

    const response = await GET(
      new Request("http://localhost/api/run/not-found"),
      ctx("not-found"),
    );

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("RUN_NOT_FOUND");
  });
});

describe("run/[runId] DELETE", () => {
  beforeEach(() => {
    fakeRun = makeFakeRun();
    getRunMock.mockClear();
  });

  test("cancels an active run and returns ok", async () => {
    const { DELETE } = await import("./route");

    const response = await DELETE(
      new Request("http://localhost/api/run/run-1", { method: "DELETE" }),
      ctx("run-1"),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.runId).toBe("run-1");
    expect(json.message).toBe("Cancellation requested");
    expect(fakeRun.cancel).toHaveBeenCalledTimes(1);
  });

  test("rejects cancellation for completed run", async () => {
    fakeRun = makeFakeRun({ status: "completed" });
    const { DELETE } = await import("./route");

    const response = await DELETE(
      new Request("http://localhost/api/run/run-done", { method: "DELETE" }),
      ctx("run-done"),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("ALREADY_TERMINAL");
    expect(json.error.message).toContain("completed");
  });

  test("rejects cancellation for cancelled run", async () => {
    fakeRun = makeFakeRun({ status: "cancelled" });
    const { DELETE } = await import("./route");

    const response = await DELETE(
      new Request("http://localhost/api/run/run-cancelled", { method: "DELETE" }),
      ctx("run-cancelled"),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("ALREADY_TERMINAL");
    expect(json.error.message).toContain("cancelled");
  });

  test("rejects cancellation for failed run", async () => {
    fakeRun = makeFakeRun({ status: "failed" });
    const { DELETE } = await import("./route");

    const response = await DELETE(
      new Request("http://localhost/api/run/run-failed", { method: "DELETE" }),
      ctx("run-failed"),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("ALREADY_TERMINAL");
    expect(json.error.message).toContain("failed");
  });

  test("returns 404 for unknown run", async () => {
    const { DELETE } = await import("./route");

    const response = await DELETE(
      new Request("http://localhost/api/run/not-found", { method: "DELETE" }),
      ctx("not-found"),
    );

    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("RUN_NOT_FOUND");
  });
});
