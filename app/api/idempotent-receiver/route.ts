import { start } from "workflow/api";
import { idempotentReceiver } from "@/idempotent-receiver/workflows/idempotent-receiver";
import { jsonError } from "@/lib/http/json-error";

type RequestBody = {
  idempotencyKey?: unknown;
  amount?: unknown;
  currency?: unknown;
  description?: unknown;
};

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/idempotent-receiver",
        action: "invalid_json",
      }),
    );

    return jsonError(400, "INVALID_JSON", "Invalid JSON body");
  }

  const idempotencyKey =
    typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
  const amount =
    typeof body.amount === "number" && Number.isFinite(body.amount)
      ? body.amount
      : 0;
  const currency =
    typeof body.currency === "string" && body.currency.trim().length > 0
      ? body.currency.trim().toUpperCase()
      : "USD";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";

  if (!idempotencyKey) {
    return jsonError(400, "INVALID_REQUEST", "idempotencyKey is required");
  }

  if (amount <= 0) {
    return jsonError(400, "INVALID_REQUEST", "amount must be a positive number");
  }

  try {
    const run = await start(idempotentReceiver, [
      idempotencyKey,
      amount,
      currency,
      description,
    ]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/idempotent-receiver",
        action: "workflow_started",
        runId: run.runId,
        idempotencyKey,
        amount,
      }),
    );

    return Response.json(
      {
        ok: true,
        runId: run.runId,
        idempotencyKey,
        amount,
        currency,
        description,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";

    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/idempotent-receiver",
        action: "start_failed",
        idempotencyKey,
        error: message,
      }),
    );

    return jsonError(500, "START_FAILED", message, { idempotencyKey });
  }
}
