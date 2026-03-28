// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { start } from "workflow/api";
import { resequencer } from "@/resequencer/workflows/resequencer";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const batchId = typeof body.batchId === "string" ? body.batchId.trim() : "";
  if (!batchId) {
    return Response.json(
      { ok: false, error: { code: "MISSING_BATCH_ID", message: "batchId is required" } },
      { status: 400 }
    );
  }

  const expectedCount =
    typeof body.expectedCount === "number" && body.expectedCount >= 2 && body.expectedCount <= 20
      ? body.expectedCount
      : 5;

  try {
    const run = await start(resequencer, [batchId, expectedCount]);

    const tokens: string[] = [];
    for (let i = 1; i <= expectedCount; i++) {
      tokens.push(`resequencer:${batchId}:${i}`);
    }

    return Response.json({
      ok: true,
      runId: run.runId,
      batchId,
      expectedCount,
      tokens,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    return Response.json(
      { ok: false, error: { code: "WORKFLOW_START_FAILED", message } },
      { status: 500 }
    );
  }
}
