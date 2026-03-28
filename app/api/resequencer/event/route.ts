// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { fragmentHook } from "@/resequencer/workflows/resequencer";

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
  const seq = typeof body.seq === "number" ? body.seq : 0;
  const payload = typeof body.payload === "string" ? body.payload.trim() : "";

  if (!batchId) {
    return Response.json(
      { ok: false, error: { code: "MISSING_BATCH_ID", message: "batchId is required" } },
      { status: 400 }
    );
  }

  if (seq < 1) {
    return Response.json(
      { ok: false, error: { code: "INVALID_SEQ", message: "seq must be >= 1" } },
      { status: 400 }
    );
  }

  if (!payload) {
    return Response.json(
      { ok: false, error: { code: "MISSING_PAYLOAD", message: "payload is required" } },
      { status: 400 }
    );
  }

  const token = `resequencer:${batchId}:${seq}`;

  try {
    const result = await fragmentHook.resume(token, { seq, payload });

    if (!result) {
      return Response.json(
        { ok: false, error: { code: "HOOK_NOT_FOUND", message: "Hook not found or already resolved" } },
        { status: 404 }
      );
    }

    return Response.json({
      ok: true,
      runId: result.runId,
      batchId,
      seq,
      payload,
      token,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resume hook";
    return Response.json(
      { ok: false, error: { code: "HOOK_RESUME_FAILED", message } },
      { status: 500 }
    );
  }
}
