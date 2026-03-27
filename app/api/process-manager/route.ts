import { start } from "workflow/api";
import { processManager } from "@/process-manager/workflows/process-manager";
import { jsonError } from "@/lib/http/json-error";

const VALID_PAYMENT_METHODS = new Set([
  "credit_card",
  "debit_card",
  "paypal",
  "bank_transfer",
]);

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/process-manager",
        action: "invalid_json",
      }),
    );
    return jsonError(400, "INVALID_JSON", "Invalid JSON body");
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const items = Array.isArray(body.items)
    ? body.items.filter((item): item is string => typeof item === "string")
    : [];
  const paymentMethod =
    typeof body.paymentMethod === "string" && VALID_PAYMENT_METHODS.has(body.paymentMethod)
      ? body.paymentMethod
      : "credit_card";
  const simulatePaymentFail = body.simulatePaymentFail === true;
  const simulateBackorder = body.simulateBackorder === true;

  if (!orderId) {
    return jsonError(400, "INVALID_REQUEST", "orderId is required");
  }

  if (items.length === 0) {
    return jsonError(400, "INVALID_REQUEST", "items array must contain at least one item");
  }

  try {
    const run = await start(processManager, [
      orderId,
      items,
      paymentMethod,
      simulatePaymentFail,
      simulateBackorder,
    ]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/process-manager",
        action: "workflow_started",
        runId: run.runId,
        orderId,
        itemCount: items.length,
        paymentMethod,
        simulatePaymentFail,
        simulateBackorder,
      }),
    );

    return Response.json(
      {
        ok: true,
        runId: run.runId,
        orderId,
        items,
        paymentMethod,
        status: "processing",
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/process-manager",
        action: "start_failed",
        error: message,
        orderId,
      }),
    );
    return jsonError(500, "START_FAILED", message, { orderId });
  }
}
