import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { bulkhead } from "@/workflows/bulkhead";

type BulkheadRequestBody = {
  jobId?: unknown;
  items?: unknown;
  maxConcurrency?: unknown;
};

export async function POST(request: Request) {
  let body: BulkheadRequestBody;

  try {
    body = (await request.json()) as BulkheadRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const jobId =
    typeof body.jobId === "string" && body.jobId.trim()
      ? body.jobId.trim()
      : `job-${crypto.randomUUID().slice(0, 8)}`;

  const items = Array.isArray(body.items)
    ? body.items.filter((i): i is string => typeof i === "string")
    : [
        "order-1",
        "order-2",
        "order-3",
        "order-4",
        "order-5",
        "order-6",
        "order-7",
        "order-8",
        "order-9",
      ];

  const maxConcurrency =
    typeof body.maxConcurrency === "number" && body.maxConcurrency > 0
      ? body.maxConcurrency
      : 3;

  const run = await start(bulkhead, [jobId, items, maxConcurrency]);

  return NextResponse.json({
    runId: run.runId,
    jobId,
    items,
    maxConcurrency,
    status: "running",
  });
}
