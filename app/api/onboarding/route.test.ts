import { beforeEach, describe, expect, mock, test } from "bun:test";

const workflowToken = Symbol("runOnboardingDrip");

let startImplementation: (...args: unknown[]) => Promise<{ runId: string }> =
  async () => ({ runId: "run-default" });

const startMock = mock((...args: unknown[]) => startImplementation(...args));

mock.module("workflow/api", () => ({
  start: startMock,
}));

mock.module("@/workflows/onboarding-drip", () => ({
  runOnboardingDrip: workflowToken,
}));

const { POST } = await import("./route");

beforeEach(() => {
  startMock.mockClear();
  startImplementation = async () => ({ runId: "run-default" });
});

describe("onboarding route contract", () => {
  test("test_post_returns_400_for_invalid_json_with_structured_error_contract", async () => {
    const response = await POST(
      new Request("http://localhost/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      })
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "INVALID_JSON",
        message: "Invalid JSON body",
      },
    });
    expect(startMock).not.toHaveBeenCalled();
  });

  test("test_post_returns_400_for_missing_email_with_structured_error_contract", async () => {
    const response = await POST(
      new Request("http://localhost/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "MISSING_EMAIL",
        message: "Email is required",
      },
    });
    expect(startMock).not.toHaveBeenCalled();
  });

  test("test_post_returns_500_when_workflow_start_fails_with_structured_error_contract", async () => {
    startImplementation = async () => {
      throw new Error("queue unavailable");
    };

    const response = await POST(
      new Request("http://localhost/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "hello@example.com",
        }),
      })
    );

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "START_FAILED",
        message: "queue unavailable",
      },
    });
  });

  test("test_post_returns_ok_true_and_run_id_on_success", async () => {
    startImplementation = async (workflowRef, args) => {
      expect(workflowRef).toBe(workflowToken);
      expect(args).toEqual(["hello@example.com"]);
      return { runId: "run-123" };
    };

    const response = await POST(
      new Request("http://localhost/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "hello@example.com",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBeNull();

    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      ok: true,
      message: "Onboarding drip campaign started",
      runId: "run-123",
      email: "hello@example.com",
      schedule: {
        day0: "Welcome email (immediate)",
        day1: "Getting started tips",
        day3: "Feature highlights",
        day7: "Follow-up and feedback request",
      },
    });
  });
});
