import { start } from "workflow/api";
import {
  correlationIdentifierFlow,
  type ServiceName,
} from "@/correlation-identifier/workflows/correlation-identifier";

const VALID_SERVICES = new Set<ServiceName>([
  "payment-api",
  "inventory-api",
  "shipping-api",
  "notification-api",
]);

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
    console.info(
      JSON.stringify({ level: "info", route: "/api/correlation-identifier", action: "invalid_json" }),
    );
    return createError(400, "Invalid JSON body", "INVALID_JSON");
  }

  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const payload = typeof body.payload === "string" ? body.payload.trim() : "";
  if (!requestId || !payload) {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/correlation-identifier",
        action: "invalid_request",
        requestIdPresent: Boolean(requestId),
        payloadPresent: Boolean(payload),
      }),
    );
    return createError(400, "requestId and payload are required", "INVALID_REQUEST");
  }

  const service =
    typeof body.service === "string" && VALID_SERVICES.has(body.service as ServiceName)
      ? (body.service as ServiceName)
      : "payment-api";

  try {
    const run = await start(correlationIdentifierFlow, [requestId, service, payload]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/correlation-identifier",
        action: "workflow_started",
        runId: run.runId,
        requestId,
        service,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, requestId, service, payload, status: "correlating" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/correlation-identifier",
        action: "start_failed",
        requestId,
        service,
        error: message,
      }),
    );
    return createError(500, message, "START_FAILED");
  }
}
