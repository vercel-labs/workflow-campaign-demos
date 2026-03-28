// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { start } from "workflow/api";
import { claimCheckImport } from "@/claim-check/workflows/claim-check";

export async function POST() {
  const importId = crypto.randomUUID().slice(0, 8);

  let run: Awaited<ReturnType<typeof start>>;
  try {
    run = await start(claimCheckImport, [importId]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    return Response.json(
      { ok: false, error: { code: "WORKFLOW_START_FAILED", message } },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    runId: run.runId,
    importId,
    hookToken: `upload:${importId}`,
  });
}
