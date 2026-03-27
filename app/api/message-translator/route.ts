import { start } from "workflow/api";
import {
  messageTranslatorFlow,
  type SourceFormat,
} from "@/message-translator/workflows/message-translator";
import { jsonError } from "@/lib/http/json-error";

type RequestBody = {
  messageId?: unknown;
  sourceFormat?: unknown;
};

const VALID_FORMATS = new Set<SourceFormat>(["xml", "csv", "legacy-json"]);

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/message-translator",
        action: "invalid_json",
      }),
    );

    return jsonError(400, "INVALID_JSON", "Invalid JSON body");
  }

  const messageId =
    typeof body.messageId === "string" ? body.messageId.trim() : "";
  const sourceFormat =
    typeof body.sourceFormat === "string" &&
    VALID_FORMATS.has(body.sourceFormat as SourceFormat)
      ? (body.sourceFormat as SourceFormat)
      : "xml";

  if (!messageId) {
    return jsonError(400, "INVALID_REQUEST", "messageId is required");
  }

  try {
    const run = await start(messageTranslatorFlow, [messageId, sourceFormat]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/message-translator",
        action: "workflow_started",
        runId: run.runId,
        messageId,
        sourceFormat,
      }),
    );

    return Response.json(
      {
        ok: true,
        runId: run.runId,
        messageId,
        sourceFormat,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";

    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/message-translator",
        action: "start_failed",
        messageId,
        error: message,
      }),
    );

    return jsonError(500, "START_FAILED", message, { messageId });
  }
}
