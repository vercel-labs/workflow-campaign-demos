// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { start } from "workflow/api";
import { approvalGate } from "@/approval-gate/workflows/approval-gate";
import type { StringValue } from "ms";

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

  const orderId = body.orderId;
  const timeout = body.timeout;

  if (typeof orderId !== "string" || orderId.trim().length === 0) {
    return createErrorResponse(400, "MISSING_ORDER_ID", "orderId is required");
  }

  const normalizedOrderId = orderId.trim();

  const VALID_TIMEOUTS = new Set(["10s", "30s", "1m", "5m", "24h"]);
  if (timeout !== undefined && (typeof timeout !== "string" || !VALID_TIMEOUTS.has(timeout))) {
    return createErrorResponse(
      400,
      "INVALID_TIMEOUT",
      `timeout must be one of: ${[...VALID_TIMEOUTS].join(", ")}`
    );
  }
  const normalizedTimeout: StringValue = typeof timeout === "string" ? (timeout as StringValue) : "30s";

  let run: Awaited<ReturnType<typeof start>>;
  try {
    // Start the approval gate workflow
    run = await start(approvalGate, [normalizedOrderId, normalizedTimeout]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    return createErrorResponse(500, "WORKFLOW_START_FAILED", message);
  }

  console.log(`Started approval gate workflow for order ${normalizedOrderId}`);
  console.log(`Run ID: ${run.runId}`);
  console.log(`Approval token: order_approval:${normalizedOrderId}`);

  return Response.json({
    ok: true,
    message: "Approval workflow started",
    runId: run.runId,
    orderId: normalizedOrderId,
    timeout: normalizedTimeout,
    approvalToken: `order_approval:${normalizedOrderId}`,
  });
}
