// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { transactionalOutbox } from "@/transactional-outbox/workflows/transactional-outbox";

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const run = await start(transactionalOutbox as any, [body] as any);

  return NextResponse.json({
    runId: run.runId,
    slug: "transactional-outbox",
    status: "started",
  });
}
