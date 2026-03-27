import { start } from "workflow/api";
import { subscriptionUpgradeSaga } from "@/saga/workflows/subscription-upgrade-saga";

function createError(status: number, message: string, code: string) {
  return Response.json(
    { ok: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    console.info(JSON.stringify({ level: "info", route: "/api/saga", action: "invalid_json" }));
    return createError(400, "Invalid JSON body", "INVALID_JSON");
  }

  const accountId =
    typeof body.accountId === "string" ? body.accountId.trim() : "";
  const seats =
    typeof body.seats === "number" && Number.isInteger(body.seats) ? body.seats : 0;
  const failAtStep =
    body.failAtStep === 1 || body.failAtStep === 2 || body.failAtStep === 3
      ? body.failAtStep
      : null;

  if (!accountId) {
    return createError(400, "accountId is required", "INVALID_REQUEST");
  }

  if (seats < 1) {
    return createError(400, "seats must be >= 1", "INVALID_REQUEST");
  }

  try {
    const run = await start(subscriptionUpgradeSaga, [accountId, seats, failAtStep]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/saga",
        action: "workflow_started",
        runId: run.runId,
        accountId,
        seats,
        failAtStep,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, accountId, seats, failAtStep },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/saga",
        action: "start_failed",
        accountId,
        seats,
        error: message,
      }),
    );
    return createError(500, message, "START_FAILED");
  }
}
