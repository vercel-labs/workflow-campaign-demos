import { start } from "workflow/api";
import { pipeline } from "@/pipeline/workflows/pipeline";
import { jsonError } from "@/lib/http/json-error";

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/pipeline",
        action: "invalid_json",
      }),
    );
    return jsonError(400, "INVALID_JSON", "Invalid JSON body");
  }

  const documentId = typeof body.documentId === "string" ? body.documentId.trim() : "";

  if (!documentId) {
    return jsonError(400, "INVALID_REQUEST", "documentId is required");
  }

  try {
    const run = await start(pipeline, [documentId]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/pipeline",
        action: "workflow_started",
        runId: run.runId,
        documentId,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, documentId, status: "running" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/pipeline",
        action: "start_failed",
        error: message,
        documentId,
      }),
    );
    return jsonError(500, "START_FAILED", message, { documentId });
  }
}
