// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { mapReduce } from "@/map-reduce/workflows/map-reduce";

type MapReduceRequestBody = {
  jobId?: unknown;
  items?: unknown;
  chunkSize?: unknown;
};

function parseNumberArray(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  const nums = value.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return nums.length === value.length ? nums : null;
}

export async function POST(request: Request) {
  let body: MapReduceRequestBody;

  try {
    body = (await request.json()) as MapReduceRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";

  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const items = parseNumberArray(body.items) ?? [10, 20, 30, 40, 50, 60, 70, 80, 90];
  const chunkSize =
    typeof body.chunkSize === "number" && body.chunkSize > 0
      ? body.chunkSize
      : 3;

  const run = await start(mapReduce, [jobId, items, chunkSize]);

  return NextResponse.json({
    runId: run.runId,
    jobId,
    items,
    chunkSize,
    status: "mapping",
  });
}
