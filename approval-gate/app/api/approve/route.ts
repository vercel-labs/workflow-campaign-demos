import { orderApprovalHook, type ApprovalPayload } from "@/workflows/approval-gate";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

function createErrorResponse(status: number, code: string, message: string) {
  return Response.json(
    {
      ok: false,
      error: {
        code,
        message,
      },
    },
    {
      status,
      headers: NO_STORE_HEADERS,
    }
  );
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return createErrorResponse(400, "INVALID_JSON", "Invalid JSON body");
  }

  const { token, approved, comment, approvedBy } = body;

  if (typeof token !== "string" || token.trim().length === 0) {
    return createErrorResponse(400, "MISSING_TOKEN", "token is required");
  }

  if (typeof approved !== "boolean") {
    return createErrorResponse(
      400,
      "INVALID_APPROVAL_DECISION",
      "approved must be a boolean"
    );
  }

  const normalizedToken = token.trim();
  const payload: ApprovalPayload = {
    approved,
    comment: typeof comment === "string" ? comment : undefined,
    approvedBy: typeof approvedBy === "string" ? approvedBy : undefined,
  };

  let result: Awaited<ReturnType<typeof orderApprovalHook.resume>>;
  try {
    // Resume the hook with the approval decision
    result = await orderApprovalHook.resume(normalizedToken, payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resume hook";
    return createErrorResponse(500, "HOOK_RESUME_FAILED", message);
  }

  if (!result) {
    return createErrorResponse(
      404,
      "HOOK_NOT_FOUND",
      "Hook not found or already resolved"
    );
  }

  console.log(`Approval sent for token: ${normalizedToken}`);
  console.log(`Decision: ${approved ? "APPROVED" : "REJECTED"}`);

  return Response.json({
    ok: true,
    message: approved ? "Order approved" : "Order rejected",
    runId: result.runId,
    token: normalizedToken,
    approved,
    comment: payload.comment,
    approvedBy: payload.approvedBy,
  });
}
