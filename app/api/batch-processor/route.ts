// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { batchProcessor } from "@/batch-processor/workflows/batch-processor";

type StartRequestBody = {
  totalRecords?: unknown;
  batchSize?: unknown;
  crashAfterBatches?: unknown;
};

function clampInt(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  const n = Math.trunc(value);
  return Math.max(min, Math.min(max, n));
}

export async function POST(request: Request) {
  let body: StartRequestBody;

  try {
    body = (await request.json()) as StartRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const totalRecords = clampInt(body.totalRecords, 1_000, 100_000, 10_000);
  const batchSize = clampInt(body.batchSize, 100, 20_000, 1_000);
  const totalBatches = Math.max(1, Math.ceil(totalRecords / batchSize));

  let crashAfterBatches: number | null = null;
  if (body.crashAfterBatches !== null && body.crashAfterBatches !== undefined) {
    if (totalBatches > 1) {
      crashAfterBatches = clampInt(
        body.crashAfterBatches,
        1,
        totalBatches - 1,
        Math.min(5, totalBatches - 1)
      );
    }
  }

  const run = await start(batchProcessor, [
    totalRecords,
    batchSize,
    crashAfterBatches,
  ]);

  return NextResponse.json({
    runId: run.runId,
    totalRecords,
    batchSize,
    totalBatches,
    crashAfterBatches,
    status: "running",
  });
}
