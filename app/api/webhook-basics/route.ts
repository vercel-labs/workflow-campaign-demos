import { start } from "workflow/api";
import { paymentWebhook } from "@/workflows/payment-webhook";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  if (!orderId) {
    return Response.json(
      { ok: false, error: { code: "MISSING_ORDER_ID", message: "orderId is required" } },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const run = await start(paymentWebhook, [orderId]);
    return Response.json({
      ok: true,
      message: "Payment webhook workflow started",
      runId: run.runId,
      orderId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { ok: false, error: { code: "WORKFLOW_START_FAILED", message } },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
