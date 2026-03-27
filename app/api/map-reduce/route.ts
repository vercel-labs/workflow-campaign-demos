import { start } from "workflow/api";
import { mapReduce } from "@/map-reduce/workflows/map-reduce";
import { jsonError } from "@/lib/http/json-error";

type RequestBody = {
  jobId?: unknown;
  items?: unknown;
  chunkSize?: unknown;
};

function parseNumberArray(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const items = value.filter(
    (item): item is number => typeof item === "number" && Number.isFinite(item),
  );

  return items.length === value.length ? items : null;
}

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/map-reduce",
        action: "invalid_json",
      }),
    );

    return jsonError(400, "INVALID_JSON", "Invalid JSON body");
  }

  const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
  const items = parseNumberArray(body.items);
  const chunkSize =
    typeof body.chunkSize === "number" &&
    Number.isFinite(body.chunkSize) &&
    body.chunkSize > 0
      ? Math.floor(body.chunkSize)
      : 3;

  if (!jobId) {
    return jsonError(400, "INVALID_REQUEST", "jobId is required");
  }

  if (!items) {
    return jsonError(400, "INVALID_REQUEST", "items must be a non-empty number array");
  }

  try {
    const run = await start(mapReduce, [jobId, items, chunkSize]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/map-reduce",
        action: "workflow_started",
        runId: run.runId,
        jobId,
        itemCount: items.length,
        chunkSize,
      }),
    );

    return Response.json(
      {
        ok: true,
        runId: run.runId,
        jobId,
        items,
        chunkSize,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";

    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/map-reduce",
        action: "start_failed",
        jobId,
        error: message,
      }),
    );

    return jsonError(500, "START_FAILED", message, { jobId });
  }
}
