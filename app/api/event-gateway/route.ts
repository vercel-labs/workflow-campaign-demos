import { start } from "workflow/api";
import { eventGateway } from "@/workflows/event-gateway";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  if (!orderId) {
    return Response.json(
      { ok: false, error: { code: "MISSING_ORDER_ID", message: "orderId is required" } },
      { status: 400 }
    );
  }

  const timeoutMs =
    typeof body.timeoutMs === "number" && body.timeoutMs >= 3000 && body.timeoutMs <= 30000
      ? body.timeoutMs
      : 6500;

  try {
    const run = await start(eventGateway, [orderId, timeoutMs]);

    return Response.json({
      ok: true,
      runId: run.runId,
      orderId,
      timeoutMs,
      tokens: {
        payment: `payment:${orderId}`,
        inventory: `inventory:${orderId}`,
        fraud: `fraud:${orderId}`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    return Response.json(
      { ok: false, error: { code: "WORKFLOW_START_FAILED", message } },
      { status: 500 }
    );
  }
}
