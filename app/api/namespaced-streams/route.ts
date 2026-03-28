// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { generatePost } from "@/namespaced-streams/workflows/namespaced-streams";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const topic = body.topic;
  if (!topic || typeof topic !== "string") {
    return NextResponse.json({ error: "topic is required" }, { status: 400 });
  }

  try {
    const run = await start(generatePost, [topic]);
    return NextResponse.json({ runId: run.runId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
