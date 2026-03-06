import { beforeEach, describe, expect, mock, test } from "bun:test";

const approvalGateWorkflow = Symbol("approvalGate");

let startImplementation: (...args: unknown[]) => Promise<{ runId: string }> =
  async () => ({ runId: "run-default" });
let resumeImplementation: (...args: unknown[]) => Promise<{ runId: string } | null> =
  async () => ({ runId: "run-default" });

const startMock = mock((...args: unknown[]) => startImplementation(...args));
const resumeMock = mock((...args: unknown[]) => resumeImplementation(...args));

mock.module("workflow/api", () => ({
  start: startMock,
}));

mock.module("@/workflows/approval-gate", () => ({
  approvalGate: approvalGateWorkflow,
  orderApprovalHook: {
    resume: resumeMock,
  },
}));

const { POST: startPost } = await import("./approval-gate/route");
const { POST: approvePost } = await import("./approve/route");

beforeEach(() => {
  startMock.mockClear();
  resumeMock.mockClear();
  startImplementation = async () => ({ runId: "run-default" });
  resumeImplementation = async () => ({ runId: "run-default" });
});

describe("approval gate API route contracts", () => {
  test("test_start_post_returns_400_with_invalid_json_structured_error_contract", async () => {
    const response = await startPost(
      new Request("http://localhost/api/start", {
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

  test("test_start_post_returns_400_with_structured_validation_error_when_order_id_missing", async () => {
    const response = await startPost(
      new Request("http://localhost/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeout: "30s" }),
      })
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "MISSING_ORDER_ID",
        message: "orderId is required",
      },
    });
    expect(startMock).not.toHaveBeenCalled();
  });

  test("test_start_post_returns_500_when_workflow_start_fails", async () => {
    startImplementation = async () => {
      throw new Error("queue unavailable");
    };

    const response = await startPost(
      new Request("http://localhost/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "order_123", timeout: "30s" }),
      })
    );

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "WORKFLOW_START_FAILED",
        message: "queue unavailable",
      },
    });
  });

  test("test_start_post_returns_ok_true_success_payload", async () => {
    startImplementation = async (workflowRef, args) => {
      expect(workflowRef).toBe(approvalGateWorkflow);
      expect(args).toEqual(["order_123", "30s"]);
      return { runId: "run-start-123" };
    };

    const response = await startPost(
      new Request("http://localhost/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "order_123", timeout: "30s" }),
      })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      ok: true,
      message: "Approval workflow started",
      runId: "run-start-123",
      orderId: "order_123",
      timeout: "30s",
      approvalToken: "order_approval:order_123",
    });
  });

  test("test_approve_post_returns_400_with_invalid_json_structured_error_contract", async () => {
    const response = await approvePost(
      new Request("http://localhost/api/approve", {
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
    expect(resumeMock).not.toHaveBeenCalled();
  });

  test("test_approve_post_returns_400_with_structured_validation_error_when_token_missing", async () => {
    const response = await approvePost(
      new Request("http://localhost/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved: true }),
      })
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "MISSING_TOKEN",
        message: "token is required",
      },
    });
    expect(resumeMock).not.toHaveBeenCalled();
  });

  test("test_approve_post_returns_400_with_structured_validation_error_when_approved_not_boolean", async () => {
    const response = await approvePost(
      new Request("http://localhost/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: "order_approval:order_123", approved: "yes" }),
      })
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "INVALID_APPROVAL_DECISION",
        message: "approved must be a boolean",
      },
    });
    expect(resumeMock).not.toHaveBeenCalled();
  });

  test("test_approve_post_returns_500_when_hook_resume_fails", async () => {
    resumeImplementation = async () => {
      throw new Error("resume queue unavailable");
    };

    const response = await approvePost(
      new Request("http://localhost/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "order_approval:order_123",
          approved: true,
        }),
      })
    );

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "HOOK_RESUME_FAILED",
        message: "resume queue unavailable",
      },
    });
  });

  test("test_approve_post_returns_404_when_hook_is_missing_or_already_resolved", async () => {
    resumeImplementation = async () => null;

    const response = await approvePost(
      new Request("http://localhost/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: "order_approval:order_123",
          approved: false,
        }),
      })
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      ok: false,
      error: {
        code: "HOOK_NOT_FOUND",
        message: "Hook not found or already resolved",
      },
    });
  });

  test("test_approve_post_returns_ok_true_and_replaces_success_field", async () => {
    resumeImplementation = async (token, payload) => {
      expect(token).toBe("order_approval:order_123");
      expect(payload).toEqual({
        approved: true,
        comment: "looks good",
        approvedBy: "manager@example.com",
      });
      return { runId: "run-approve-123" };
    };

    const response = await approvePost(
      new Request("http://localhost/api/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: " order_approval:order_123 ",
          approved: true,
          comment: "looks good",
          approvedBy: "manager@example.com",
        }),
      })
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload).toMatchObject({
      ok: true,
      message: "Order approved",
      runId: "run-approve-123",
      token: "order_approval:order_123",
      approved: true,
      comment: "looks good",
      approvedBy: "manager@example.com",
    });
    expect("success" in payload).toBeFalse();
  });
});
