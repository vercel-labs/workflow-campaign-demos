// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { resumeHook } from "workflow/api";
import type { ApprovalSignal } from "@/approval-chain/workflows/approval-chain";

function createError(status: number, error: string, code: string) {
  return Response.json(
    {
      ok: false,
      error: {
        code,
        message: error,
      },
    },
    {
      status,
      headers: { "cache-control": "no-store" },
    }
  );
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return createError(400, "Invalid JSON body", "INVALID_JSON");
  }

  const token = body.token;
  const approved = body.approved;
  const comment = body.comment;
  const decidedBy = body.decidedBy;

  if (typeof token !== "string" || token.trim().length === 0) {
    return createError(400, "token is required", "MISSING_TOKEN");
  }

  if (typeof approved !== "boolean") {
    return createError(400, "approved must be a boolean", "INVALID_APPROVED_VALUE");
  }

  const payload: ApprovalSignal = {
    approved,
    comment: typeof comment === "string" ? comment : undefined,
    decidedBy: typeof decidedBy === "string" ? decidedBy : undefined,
  };

  try {
    const result = await resumeHook(token.trim(), payload);
    if (!result) {
      return createError(404, "Hook not found or already resolved", "HOOK_NOT_FOUND");
    }

    return Response.json({
      ok: true,
      runId: result.runId,
      token: token.trim(),
      approved,
      comment: payload.comment,
      decidedBy: payload.decidedBy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resume hook";
    return createError(500, message, "HOOK_RESUME_FAILED");
  }
}
