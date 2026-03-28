// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { pipeline } from "@/pipeline/workflows/pipeline";

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const documentId = typeof body.documentId === "string" ? body.documentId.trim() : "";
  if (!documentId) {
    return NextResponse.json({ error: "documentId required" }, { status: 400 });
  }

  try {
    const run = await start(pipeline, [documentId]);
    return NextResponse.json({ runId: run.runId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    );
  }
}
