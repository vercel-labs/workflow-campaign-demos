import { start } from "workflow/api";
import { wireTap } from "@/wire-tap/workflows/wire-tap";

function createError(status: number, message: string, code: string) {
  return Response.json(
    { ok: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    console.info(JSON.stringify({ level: "info", route: "/api/wire-tap", action: "invalid_json" }));
    return createError(400, "Invalid JSON body", "INVALID_JSON");
  }

  const orderId =
    typeof body.orderId === "string" ? body.orderId.trim() : "";
  const item =
    typeof body.item === "string" ? body.item.trim() : "";
  const quantity =
    typeof body.quantity === "number" && Number.isFinite(body.quantity)
      ? body.quantity
      : 0;

  if (!orderId) {
    return createError(400, "orderId is required", "INVALID_REQUEST");
  }

  if (!item) {
    return createError(400, "item is required", "INVALID_REQUEST");
  }

  if (quantity <= 0) {
    return createError(400, "quantity must be > 0", "INVALID_REQUEST");
  }

  try {
    const run = await start(wireTap, [orderId, item, quantity]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/wire-tap",
        action: "workflow_started",
        runId: run.runId,
        orderId,
        item,
        quantity,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, orderId, item, quantity },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/wire-tap",
        action: "start_failed",
        orderId,
        error: message,
      }),
    );
    return createError(500, message, "START_FAILED");
  }
}
