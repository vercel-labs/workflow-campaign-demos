import { start } from "workflow/api";
import { routingSlip, type SlipStage } from "@/routing-slip/workflows/routing-slip";

function createError(status: number, message: string, code: string) {
  return Response.json(
    {
      ok: false,
      error: { code, message },
    },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

const VALID_STAGES: SlipStage[] = [
  "inventory",
  "payment",
  "packaging",
  "shipping",
  "notification",
];

function isSlipStage(value: unknown): value is SlipStage {
  return typeof value === "string" && VALID_STAGES.includes(value as SlipStage);
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    console.info(JSON.stringify({ level: "info", route: "/api/routing-slip", action: "invalid_json" }));
    return createError(400, "Invalid JSON body", "INVALID_JSON");
  }

  const orderId =
    typeof body.orderId === "string" ? body.orderId.trim() : "";
  const slip = Array.isArray(body.slip) ? body.slip.filter(isSlipStage) : [];

  if (!orderId) {
    return createError(400, "orderId is required", "INVALID_REQUEST");
  }

  if (slip.length === 0 || slip.length !== (Array.isArray(body.slip) ? body.slip.length : 0)) {
    return createError(
      400,
      "slip must be a non-empty array of valid stages",
      "INVALID_REQUEST",
    );
  }

  try {
    const run = await start(routingSlip, [orderId, slip]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/routing-slip",
        action: "workflow_started",
        runId: run.runId,
        orderId,
        stageCount: slip.length,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, orderId, slip },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/routing-slip",
        action: "start_failed",
        orderId,
        error: message,
      }),
    );
    return createError(500, message, "START_FAILED");
  }
}
