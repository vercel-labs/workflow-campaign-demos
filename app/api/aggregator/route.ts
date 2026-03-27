import { start } from "workflow/api";
import { aggregator } from "@/aggregator/workflows/aggregator";

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
    console.info(JSON.stringify({ level: "info", route: "/api/aggregator", action: "invalid_json" }));
    return createError(400, "Invalid JSON body", "INVALID_JSON");
  }

  const batchId =
    typeof body.batchId === "string" && body.batchId.trim().length > 0
      ? body.batchId.trim()
      : `batch-${Date.now().toString(36)}`;
  const timeoutMs =
    typeof body.timeoutMs === "number" && Number.isFinite(body.timeoutMs) && body.timeoutMs > 0
      ? Math.min(Math.trunc(body.timeoutMs), 60_000)
      : 8_000;

  try {
    const run = await start(aggregator, [batchId, timeoutMs]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/aggregator",
        action: "workflow_started",
        runId: run.runId,
        batchId,
        timeoutMs,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, batchId, timeoutMs, status: "collecting" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/aggregator",
        action: "start_failed",
        batchId,
        timeoutMs,
        error: message,
      }),
    );
    return createError(500, message, "START_FAILED", { batchId, timeoutMs });
  }
}
