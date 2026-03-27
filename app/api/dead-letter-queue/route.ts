import { start } from "workflow/api";
import { deadLetterQueue } from "@/dead-letter-queue/workflows/dead-letter-queue";
import { jsonError } from "@/lib/http/json-error";

type RequestBody = {
  messages?: unknown;
  poisonMessages?: unknown;
};

function parseStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const items = value.filter((item): item is string => typeof item === "string");
  return items.length === value.length ? items : null;
}

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/dead-letter-queue",
        action: "invalid_json",
      }),
    );

    return jsonError(400, "INVALID_JSON", "Invalid JSON body");
  }

  const messages = parseStringArray(body.messages);
  const poisonMessages =
    body.poisonMessages === undefined ? [] : parseStringArray(body.poisonMessages);

  if (!messages || messages.length === 0) {
    return jsonError(400, "INVALID_REQUEST", "messages must be a non-empty string array");
  }

  if (!poisonMessages) {
    return jsonError(400, "INVALID_REQUEST", "poisonMessages must be a string array");
  }

  try {
    const run = await start(deadLetterQueue, [messages, poisonMessages]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/dead-letter-queue",
        action: "workflow_started",
        runId: run.runId,
        messageCount: messages.length,
        poisonCount: poisonMessages.length,
      }),
    );

    return Response.json(
      {
        ok: true,
        runId: run.runId,
        messages,
        poisonMessages,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";

    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/dead-letter-queue",
        action: "start_failed",
        error: message,
      }),
    );

    return jsonError(500, "START_FAILED", message);
  }
}
