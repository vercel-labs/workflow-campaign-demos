import { start } from "workflow/api";
import { circuitBreakerFlow } from "@/circuit-breaker/workflows/circuit-breaker";

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
    console.info(JSON.stringify({ level: "info", route: "/api/circuit-breaker", action: "invalid_json" }));
    return createError(400, "Invalid JSON body", "INVALID_JSON");
  }

  const serviceId =
    typeof body.serviceId === "string" && body.serviceId.trim().length > 0
      ? body.serviceId.trim()
      : "payment-api";
  const maxRequests =
    typeof body.maxRequests === "number" && Number.isFinite(body.maxRequests) && body.maxRequests > 0
      ? Math.min(Math.trunc(body.maxRequests), 50)
      : 10;
  const failRange =
    Array.isArray(body.failRange) &&
    body.failRange.length === 2 &&
    typeof body.failRange[0] === "number" &&
    typeof body.failRange[1] === "number"
      ? [Math.trunc(body.failRange[0]), Math.trunc(body.failRange[1])]
      : [4, 6];

  try {
    const run = await start(circuitBreakerFlow, [serviceId, maxRequests, failRange[0], failRange[1]]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/circuit-breaker",
        action: "workflow_started",
        runId: run.runId,
        serviceId,
        maxRequests,
        failRange,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, serviceId, maxRequests, failRange, status: "running" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/circuit-breaker",
        action: "start_failed",
        serviceId,
        maxRequests,
        failRange,
        error: message,
      }),
    );
    return createError(500, message, "START_FAILED");
  }
}
