import { start } from "workflow/api";
import { transactionalOutbox } from "@/transactional-outbox/workflows/transactional-outbox";

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
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/transactional-outbox",
        action: "invalid_json",
      }),
    );
    return createError(400, "Invalid JSON body", "INVALID_JSON");
  }

  const orderId =
    typeof body.orderId === "string" ? body.orderId.trim() : "";
  const payload =
    typeof body.payload === "string" ? body.payload.trim() : "";

  if (!orderId) {
    return createError(400, "orderId is required", "INVALID_REQUEST");
  }

  if (!payload) {
    return createError(400, "payload is required", "INVALID_REQUEST");
  }

  try {
    const run = await start(transactionalOutbox, [orderId, payload]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/transactional-outbox",
        action: "workflow_started",
        runId: run.runId,
        orderId,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, orderId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/transactional-outbox",
        action: "start_failed",
        orderId,
        error: message,
      }),
    );
    return createError(500, message, "START_FAILED");
  }
}
