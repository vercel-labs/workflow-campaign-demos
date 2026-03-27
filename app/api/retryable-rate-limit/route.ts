import { start } from "workflow/api";
import { syncCrmContact } from "@/retryable-rate-limit/workflows/retryable-rate-limit";
import { jsonError } from "@/lib/http/json-error";

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/retryable-rate-limit",
        action: "invalid_json",
      }),
    );
    return jsonError(400, "INVALID_JSON", "Invalid JSON body");
  }

  const contactId = typeof body.contactId === "string" ? body.contactId.trim() : "";

  if (!contactId) {
    return jsonError(400, "INVALID_REQUEST", "contactId is required");
  }

  const failuresBeforeSuccess =
    typeof body.failuresBeforeSuccess === "number"
      ? Math.max(0, Math.min(4, Math.floor(body.failuresBeforeSuccess)))
      : 2;

  try {
    const run = await start(syncCrmContact, [contactId, failuresBeforeSuccess]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/retryable-rate-limit",
        action: "workflow_started",
        runId: run.runId,
        contactId,
        failuresBeforeSuccess,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, contactId, failuresBeforeSuccess },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/retryable-rate-limit",
        action: "start_failed",
        error: message,
        contactId,
      }),
    );
    return jsonError(500, "START_FAILED", message, { contactId });
  }
}
