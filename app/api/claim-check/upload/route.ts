// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { blobReady } from "@/claim-check/workflows/claim-check";

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

  const importId = body.importId;
  if (typeof importId !== "string" || importId.trim().length === 0) {
    return Response.json(
      { ok: false, error: { code: "MISSING_IMPORT_ID", message: "importId is required" } },
      { status: 400 }
    );
  }

  const blobToken = `blob:${importId}`;

  try {
    const result = await blobReady.resume(`upload:${importId}`, { blobToken });

    if (!result) {
      return Response.json(
        { ok: false, error: { code: "HOOK_NOT_FOUND", message: "Hook not found or already resolved" } },
        { status: 404 }
      );
    }

    return Response.json({
      ok: true,
      message: "Blob token delivered to workflow",
      runId: result.runId,
      blobToken,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resume hook";
    return Response.json(
      { ok: false, error: { code: "HOOK_RESUME_FAILED", message } },
      { status: 500 }
    );
  }
}
