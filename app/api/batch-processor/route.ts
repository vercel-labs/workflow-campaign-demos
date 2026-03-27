import { start } from "workflow/api";
import { batchProcessor } from "@/batch-processor/workflows/batch-processor";

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

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    console.info(JSON.stringify({ level: "info", route: "/api/batch-processor", action: "invalid_json" }));
    return createError(400, "Invalid JSON body", "INVALID_JSON");
  }

  const totalRecords = clampInt(body.totalRecords, 10_000, 1_000, 100_000);
  const batchSize = clampInt(body.batchSize, 1_000, 100, 20_000);
  const totalBatches = Math.max(1, Math.ceil(totalRecords / batchSize));

  let crashAfterBatches: number | null = null;
  if (body.crashAfterBatches !== null && body.crashAfterBatches !== undefined) {
    crashAfterBatches = clampInt(body.crashAfterBatches, Math.min(2, totalBatches - 1), 1, Math.max(1, totalBatches - 1));
  }

  try {
    const run = await start(batchProcessor, [totalRecords, batchSize, crashAfterBatches]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/batch-processor",
        action: "workflow_started",
        runId: run.runId,
        totalRecords,
        batchSize,
        crashAfterBatches,
      }),
    );

    return Response.json(
      {
        ok: true,
        runId: run.runId,
        totalRecords,
        batchSize,
        totalBatches,
        crashAfterBatches,
        status: "running",
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/batch-processor",
        action: "start_failed",
        totalRecords,
        batchSize,
        crashAfterBatches,
        error: message,
      }),
    );
    return createError(500, message, "START_FAILED");
  }
}
