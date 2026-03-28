// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import {
  throttleFlow,
  type RequestItem,
} from "@/throttle/workflows/throttle";

type RequestBody = {
  capacity?: unknown;
  refillRate?: unknown;
  requests?: unknown;
};

function parseRequests(value: unknown): RequestItem[] | null {
  if (!Array.isArray(value)) return null;

  const items: RequestItem[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const obj = item as Record<string, unknown>;
    if (typeof obj.id !== "string" || typeof obj.label !== "string") return null;
    items.push({ id: obj.id, label: obj.label });
  }

  return items.length > 0 ? items : null;
}

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const requests = parseRequests(body.requests);
  if (!requests) {
    return NextResponse.json(
      { error: "requests is required: array of { id, label }" },
      { status: 400 }
    );
  }

  const capacity = typeof body.capacity === "number" ? body.capacity : 3;
  const refillRate = typeof body.refillRate === "number" ? body.refillRate : 3;

  const run = await start(throttleFlow, [{ capacity, refillRate, requests }]);

  return NextResponse.json({
    runId: run.runId,
    requestCount: requests.length,
    status: "queued",
  });
}
