import { beforeEach, describe, expect, mock, test } from "bun:test";

const startMock = mock(async () => ({ runId: "run-export-001" }));
const getRunUnusedMock = mock(() => {
  throw new Error("getRun should not be called in cancellable-export start route test");
});

mock.module("workflow/api", () => ({
  start: startMock,
  getRun: getRunUnusedMock,
}));

describe("cancellable-export start route", () => {
  beforeEach(() => {
    startMock.mockClear();
  });

  test("valid POST returns ok with runId and accountId", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/cancellable-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: "acct-42" }),
      }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ ok: true, runId: "run-export-001", accountId: "acct-42" });
    expect(startMock).toHaveBeenCalledTimes(1);
  });

  test("valid POST with systemPrompt passes it to start", async () => {
    const { POST } = await import("./route");

    await POST(
      new Request("http://localhost/api/cancellable-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: "acct-99", systemPrompt: "be concise" }),
      }),
    );

    expect(startMock).toHaveBeenCalledTimes(1);
    const [, args] = startMock.mock.calls[0] as [unknown, [string, string]];
    expect(args[0]).toBe("acct-99");
    expect(args[1]).toBe("be concise");
  });

  test("invalid JSON returns 400 INVALID_JSON", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/cancellable-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      }),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("INVALID_JSON");
  });

  test("missing accountId returns 400 MISSING_ACCOUNT_ID", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/cancellable-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("MISSING_ACCOUNT_ID");
  });

  test("non-string accountId returns 400 MISSING_ACCOUNT_ID", async () => {
    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/cancellable-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: 123 }),
      }),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("MISSING_ACCOUNT_ID");
  });

  test("start failure returns 500 START_FAILED", async () => {
    startMock.mockImplementationOnce(async () => {
      throw new Error("workflow engine unavailable");
    });

    const { POST } = await import("./route");

    const response = await POST(
      new Request("http://localhost/api/cancellable-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: "acct-fail" }),
      }),
    );

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("START_FAILED");
    expect(json.error.message).toBe("workflow engine unavailable");
  });
});
