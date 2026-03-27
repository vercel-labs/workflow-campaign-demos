import { start } from "workflow/api";
import { pollTranscodeStatus } from "@/status-poller/workflows/status-poller";

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
    console.info(JSON.stringify({ level: "info", route: "/api/status-poller", action: "invalid_json" }));
    return createError(400, "Invalid JSON body", "INVALID_JSON");
  }

  const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
  const maxPolls =
    typeof body.maxPolls === "number" &&
    Number.isInteger(body.maxPolls) &&
    body.maxPolls >= 1 &&
    body.maxPolls <= 20
      ? body.maxPolls
      : 8;
  const intervalMs =
    typeof body.intervalMs === "number" &&
    Number.isFinite(body.intervalMs) &&
    body.intervalMs >= 100 &&
    body.intervalMs <= 5000
      ? Math.trunc(body.intervalMs)
      : 1000;
  const readyAtPoll =
    typeof body.readyAtPoll === "number" &&
    Number.isInteger(body.readyAtPoll) &&
    body.readyAtPoll >= 1 &&
    body.readyAtPoll <= 20
      ? body.readyAtPoll
      : 4;

  if (!jobId) {
    return createError(400, "jobId is required", "INVALID_REQUEST");
  }

  try {
    const run = await start(pollTranscodeStatus, [
      jobId,
      maxPolls,
      intervalMs,
      readyAtPoll,
    ]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/status-poller",
        action: "workflow_started",
        runId: run.runId,
        jobId,
        maxPolls,
        intervalMs,
        readyAtPoll,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, jobId, maxPolls, intervalMs, readyAtPoll },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/status-poller",
        action: "start_failed",
        jobId,
        error: message,
      }),
    );
    return createError(500, message, "START_FAILED");
  }
}
