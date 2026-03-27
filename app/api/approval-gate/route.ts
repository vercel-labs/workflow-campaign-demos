import { start } from "workflow/api";
import { approvalGate } from "@/approval-gate/workflows/approval-gate";

type ApprovalTimeout = "10s" | "30s" | "1m" | "5m" | "24h";

const VALID_TIMEOUTS = new Set<ApprovalTimeout>(["10s", "30s", "1m", "5m", "24h"]);

function createError(
  status: number,
  error: string,
  code: string,
  details?: Record<string, unknown>,
) {
  return Response.json(
    {
      ok: false,
      error: { code, message: error, details: details ?? null },
    },
    {
      status,
      headers: { "cache-control": "no-store" },
    },
  );
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    console.info(JSON.stringify({ level: "info", route: "/api/approval-gate", action: "invalid_json" }));
    return createError(400, "Invalid JSON body", "INVALID_JSON");
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  if (!orderId) {
    console.info(JSON.stringify({ level: "info", route: "/api/approval-gate", action: "missing_order_id" }));
    return createError(400, "orderId is required", "INVALID_REQUEST");
  }

  const timeout =
    typeof body.timeout === "string" && VALID_TIMEOUTS.has(body.timeout as ApprovalTimeout)
      ? (body.timeout as ApprovalTimeout)
      : "30s";

  try {
    const run = await start(approvalGate, [orderId, timeout]);
    const approvalToken = `order_approval:${orderId}`;

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/approval-gate",
        action: "workflow_started",
        runId: run.runId,
        orderId,
        timeout,
        approvalToken,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, orderId, timeout, approvalToken, status: "waiting" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/approval-gate",
        action: "start_failed",
        orderId,
        timeout,
        error: message,
      }),
    );
    return createError(500, message, "START_FAILED", { orderId, timeout });
  }
}
