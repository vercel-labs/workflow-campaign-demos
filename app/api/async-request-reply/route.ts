// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { start } from "workflow/api";
import { asyncRequestReply } from "@/async-request-reply/workflows/async-request-reply";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const documentId = typeof body.documentId === "string" ? body.documentId.trim() : "";
  if (!documentId) {
    return Response.json(
      { ok: false, error: { code: "MISSING_DOCUMENT_ID", message: "documentId is required" } },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const run = await start(asyncRequestReply, [documentId]);
    return Response.json({
      ok: true,
      message: "Async request-reply workflow started",
      runId: run.runId,
      documentId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { ok: false, error: { code: "WORKFLOW_START_FAILED", message } },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
