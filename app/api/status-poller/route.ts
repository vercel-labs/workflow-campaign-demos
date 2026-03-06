import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { pollTranscodeStatus } from "@/workflows/status-poller";

type StartRequestBody = {
  jobId?: unknown;
  maxPolls?: unknown;
  intervalMs?: unknown;
  readyAtPoll?: unknown;
};

export async function POST(request: Request) {
  let body: StartRequestBody;

  try {
    body = (await request.json()) as StartRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const jobId =
    typeof body.jobId === "string" ? body.jobId.trim() : "";
  if (!jobId) {
    return NextResponse.json(
      { error: "jobId is required" },
      { status: 400 }
    );
  }

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

  const run = await start(pollTranscodeStatus, [
    jobId,
    maxPolls,
    intervalMs,
    readyAtPoll,
  ]);

  return NextResponse.json({
    runId: run.runId,
    jobId,
    maxPolls,
    intervalMs,
    readyAtPoll,
    status: "running",
  });
}
