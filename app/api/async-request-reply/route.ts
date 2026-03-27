import { start } from "workflow/api";
import { asyncRequestReply } from "@/async-request-reply/workflows/async-request-reply";

function createError(
  status: number,
  error: string,
  code: string,
  details?: Record<string, unknown>,
) {
  return Response.json(
    {
      ok: false,
      error: { code, message: error, details: details ?? null },
    },
    {
      status,
      headers: { "cache-control": "no-store" },
    },
  );
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    console.info(
      JSON.stringify({ level: "info", route: "/api/async-request-reply", action: "invalid_json" }),
    );
    return createError(400, "Invalid JSON body", "INVALID_JSON");
  }

  const documentId = typeof body.documentId === "string" ? body.documentId.trim() : "";
  if (!documentId) {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/async-request-reply",
        action: "missing_document_id",
      }),
    );
    return createError(400, "documentId is required", "INVALID_REQUEST");
  }

  try {
    const run = await start(asyncRequestReply, [documentId]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/async-request-reply",
        action: "workflow_started",
        runId: run.runId,
        documentId,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, documentId, status: "waiting" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/async-request-reply",
        action: "start_failed",
        documentId,
        error: message,
      }),
    );
    return createError(500, message, "START_FAILED", { documentId });
  }
}
