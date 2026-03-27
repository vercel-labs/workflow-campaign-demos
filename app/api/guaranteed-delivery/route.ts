import { start } from "workflow/api";
import { guaranteedDelivery } from "@/guaranteed-delivery/workflows/guaranteed-delivery";
import { jsonError } from "@/lib/http/json-error";

type RequestBody = {
  messages?: unknown;
  failMessages?: unknown;
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
        route: "/api/guaranteed-delivery",
        action: "invalid_json",
      }),
    );

    return jsonError(400, "INVALID_JSON", "Invalid JSON body");
  }

  const messages = parseStringArray(body.messages);
  const failMessages =
    body.failMessages === undefined ? [] : parseStringArray(body.failMessages);

  if (!messages || messages.length === 0) {
    return jsonError(400, "INVALID_REQUEST", "messages must be a non-empty string array");
  }

  if (!failMessages) {
    return jsonError(400, "INVALID_REQUEST", "failMessages must be a string array");
  }

  try {
    const run = await start(guaranteedDelivery, [messages, failMessages]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/guaranteed-delivery",
        action: "workflow_started",
        runId: run.runId,
        messageCount: messages.length,
        failCount: failMessages.length,
      }),
    );

    return Response.json(
      {
        ok: true,
        runId: run.runId,
        messages,
        failMessages,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";

    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/guaranteed-delivery",
        action: "start_failed",
        error: message,
      }),
    );

    return jsonError(500, "START_FAILED", message);
  }
}
