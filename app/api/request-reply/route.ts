import { start } from "workflow/api";
import { requestReplyFlow } from "@/request-reply/workflows/request-reply";
import { jsonError } from "@/lib/http/json-error";

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/request-reply",
        action: "invalid_json",
      }),
    );
    return jsonError(400, "INVALID_JSON", "Invalid JSON body");
  }

  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const services =
    Array.isArray(body.services) && body.services.every((value) => typeof value === "string")
      ? (body.services as string[])
      : ["user-service", "inventory-service", "payment-service"];
  const timeoutMs =
    typeof body.timeoutMs === "number" && body.timeoutMs > 0 ? body.timeoutMs : 800;
  const maxAttempts =
    typeof body.maxAttempts === "number" && body.maxAttempts > 0 ? body.maxAttempts : 2;

  if (!requestId) {
    return jsonError(400, "INVALID_REQUEST", "requestId is required");
  }

  try {
    const run = await start(requestReplyFlow, [
      requestId,
      services,
      timeoutMs,
      maxAttempts,
    ]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/request-reply",
        action: "workflow_started",
        runId: run.runId,
        requestId,
        serviceCount: services.length,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, requestId, services, status: "started" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/request-reply",
        action: "start_failed",
        error: message,
        requestId,
      }),
    );
    return jsonError(500, "START_FAILED", message, { requestId });
  }
}
