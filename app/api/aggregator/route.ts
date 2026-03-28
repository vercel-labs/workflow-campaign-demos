// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { aggregator } from "@/aggregator/workflows/aggregator";

type StartRequestBody = {
  batchId?: unknown;
  timeoutMs?: unknown;
};

export async function POST(request: Request) {
  let body: StartRequestBody;

  try {
    body = (await request.json()) as StartRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const batchId =
    typeof body.batchId === "string"
      ? body.batchId.trim()
      : `batch-${Date.now()}`;
  const timeoutMs =
    typeof body.timeoutMs === "number" ? body.timeoutMs : 8000;

  const run = await start(aggregator, [batchId, timeoutMs]);

  return NextResponse.json({
    runId: run.runId,
    batchId,
    timeoutMs,
    status: "collecting",
  });
}
