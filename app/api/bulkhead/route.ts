import { start } from "workflow/api";
import { bulkhead } from "@/bulkhead/workflows/bulkhead";

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

function parseItems(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    console.info(JSON.stringify({ level: "info", route: "/api/bulkhead", action: "invalid_json" }));
    return createError(400, "Invalid JSON body", "INVALID_JSON");
  }

  const jobId =
    typeof body.jobId === "string" && body.jobId.trim().length > 0
      ? body.jobId.trim()
      : `job-${crypto.randomUUID().slice(0, 8)}`;
  const items = parseItems(body.items);
  if (items.length === 0) {
    console.info(JSON.stringify({ level: "info", route: "/api/bulkhead", action: "missing_items" }));
    return createError(400, "items must contain at least one string value", "INVALID_REQUEST");
  }

  const maxConcurrency =
    typeof body.maxConcurrency === "number" && Number.isFinite(body.maxConcurrency) && body.maxConcurrency > 0
      ? Math.min(Math.trunc(body.maxConcurrency), items.length)
      : Math.min(3, items.length);

  try {
    const run = await start(bulkhead, [jobId, items, maxConcurrency]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/bulkhead",
        action: "workflow_started",
        runId: run.runId,
        jobId,
        itemCount: items.length,
        maxConcurrency,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, jobId, items, maxConcurrency, status: "running" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/bulkhead",
        action: "start_failed",
        jobId,
        itemCount: items.length,
        maxConcurrency,
        error: message,
      }),
    );
    return createError(500, message, "START_FAILED");
  }
}
