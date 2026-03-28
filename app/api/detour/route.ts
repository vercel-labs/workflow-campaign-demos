// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { detourFlow } from "@/detour/workflows/detour";

type RequestBody = {
  deployId?: unknown;
  qaMode?: unknown;
};

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const deployId =
    typeof body.deployId === "string" ? body.deployId.trim() : "";
  const qaMode = body.qaMode === true;

  if (!deployId) {
    return NextResponse.json({ error: "deployId is required" }, { status: 400 });
  }

  const run = await start(detourFlow, [deployId, qaMode]);

  return NextResponse.json({
    runId: run.runId,
    deployId,
    qaMode,
    status: "deploying",
  });
}
