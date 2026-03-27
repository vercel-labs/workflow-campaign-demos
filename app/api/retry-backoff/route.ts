import { start } from "workflow/api";
import { retryBackoffContactSync } from "@/retry-backoff/workflows/retry-backoff";
import { jsonError } from "@/lib/http/json-error";

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/retry-backoff",
        action: "invalid_json",
      }),
    );
    return jsonError(400, "INVALID_JSON", "Invalid JSON body");
  }

  const contactId = typeof body.contactId === "string" ? body.contactId.trim() : "";

  if (!contactId) {
    return jsonError(400, "INVALID_REQUEST", "contactId is required");
  }

  const maxAttempts =
    typeof body.maxAttempts === "number" &&
    Number.isInteger(body.maxAttempts) &&
    body.maxAttempts >= 1 &&
    body.maxAttempts <= 10
      ? body.maxAttempts
      : 5;
  const baseDelayMs =
    typeof body.baseDelayMs === "number" &&
    Number.isFinite(body.baseDelayMs) &&
    body.baseDelayMs >= 50 &&
    body.baseDelayMs <= 2_000
      ? Math.trunc(body.baseDelayMs)
      : 1_000;
  const failuresBeforeSuccess =
    typeof body.failuresBeforeSuccess === "number" &&
    Number.isInteger(body.failuresBeforeSuccess) &&
    body.failuresBeforeSuccess >= 0 &&
    body.failuresBeforeSuccess <= 20
      ? body.failuresBeforeSuccess
      : 2;

  try {
    const run = await start(retryBackoffContactSync, [
      contactId,
      maxAttempts,
      baseDelayMs,
      failuresBeforeSuccess,
    ]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/retry-backoff",
        action: "workflow_started",
        runId: run.runId,
        contactId,
        maxAttempts,
        baseDelayMs,
        failuresBeforeSuccess,
      }),
    );

    return Response.json(
      {
        ok: true,
        runId: run.runId,
        contactId,
        maxAttempts,
        baseDelayMs,
        failuresBeforeSuccess,
        status: "running",
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/retry-backoff",
        action: "start_failed",
        error: message,
        contactId,
      }),
    );
    return jsonError(500, "START_FAILED", message, { contactId });
  }
}
