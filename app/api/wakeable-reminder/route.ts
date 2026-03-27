import { start } from "workflow/api";
import { scheduleReminder } from "@/wakeable-reminder/workflows/wakeable-reminder";

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
    console.info(JSON.stringify({ level: "info", route: "/api/wakeable-reminder", action: "invalid_json" }));
    return createError(400, "Invalid JSON body", "INVALID_JSON");
  }

  const userId =
    typeof body.userId === "string" ? body.userId.trim() : "";
  const delayMs =
    typeof body.delayMs === "number" && Number.isFinite(body.delayMs)
      ? Math.trunc(body.delayMs)
      : 0;

  if (!userId) {
    return createError(400, "userId is required", "INVALID_REQUEST");
  }

  if (delayMs <= 0) {
    return createError(400, "delayMs must be positive", "INVALID_REQUEST");
  }

  try {
    const run = await start(scheduleReminder, [userId, delayMs]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/wakeable-reminder",
        action: "workflow_started",
        runId: run.runId,
        userId,
        delayMs,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, userId, delayMs },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/wakeable-reminder",
        action: "start_failed",
        userId,
        error: message,
      }),
    );
    return createError(500, message, "START_FAILED");
  }
}
