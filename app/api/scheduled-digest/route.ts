// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { collectAndSendDigest } from "@/scheduled-digest/workflows/scheduled-digest";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userId =
    typeof body.userId === "string" && body.userId.trim()
      ? body.userId.trim()
      : "user_123";

  const windowMs =
    typeof body.windowMs === "number" && body.windowMs > 0
      ? body.windowMs
      : 6_000;

  const digestId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const run = await start(collectAndSendDigest, [digestId, userId, windowMs]);

  const token = `digest:${digestId}`;

  return NextResponse.json({
    runId: run.runId,
    token,
    digestId,
    userId,
    windowMs,
    status: "running",
  });
}
