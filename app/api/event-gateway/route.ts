import { start } from "workflow/api";
import { eventGateway } from "@/event-gateway/workflows/event-gateway";
import { jsonError } from "@/lib/http/json-error";

type RequestBody = {
  orderId?: unknown;
  timeoutMs?: unknown;
};

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/event-gateway",
        action: "invalid_json",
      }),
    );

    return jsonError(400, "INVALID_JSON", "Invalid JSON body");
  }

  const orderId =
    typeof body.orderId === "string" ? body.orderId.trim() : "";
  const timeoutMs =
    typeof body.timeoutMs === "number" &&
    Number.isFinite(body.timeoutMs) &&
    body.timeoutMs >= 3000 &&
    body.timeoutMs <= 30000
      ? body.timeoutMs
      : 6500;

  if (!orderId) {
    return jsonError(400, "INVALID_REQUEST", "orderId is required");
  }

  try {
    const run = await start(eventGateway, [orderId, timeoutMs]);
    const tokens = {
      payment: `payment:${orderId}`,
      inventory: `inventory:${orderId}`,
      fraud: `fraud:${orderId}`,
    };

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/event-gateway",
        action: "workflow_started",
        runId: run.runId,
        orderId,
        timeoutMs,
      }),
    );

    return Response.json(
      {
        ok: true,
        runId: run.runId,
        orderId,
        timeoutMs,
        tokens,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";

    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/event-gateway",
        action: "start_failed",
        orderId,
        error: message,
      }),
    );

    return jsonError(500, "START_FAILED", message, { orderId });
  }
}
