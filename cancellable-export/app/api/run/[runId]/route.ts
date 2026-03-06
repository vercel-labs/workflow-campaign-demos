import { NextResponse } from "next/server";
import { getRun } from "workflow/api";

type RunRouteContext = {
  params: Promise<{ runId: string }>;
};

export async function GET(_request: Request, { params }: RunRouteContext) {
  const { runId } = await params;

  let run;
  try {
    run = await getRun(runId);
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "RUN_NOT_FOUND", message: `Run ${runId} not found` } },
      { status: 404 }
    );
  }

  const [status, workflowName, createdAt, startedAt, completedAt] =
    await Promise.all([
      run.status,
      run.workflowName,
      run.createdAt,
      run.startedAt,
      run.completedAt,
    ]);

  return NextResponse.json({
    runId,
    status,
    workflowName,
    createdAt: createdAt.toISOString(),
    startedAt: startedAt?.toISOString() ?? null,
    completedAt: completedAt?.toISOString() ?? null,
  });
}

export async function DELETE(_request: Request, { params }: RunRouteContext) {
  const { runId } = await params;

  let run;
  try {
    run = await getRun(runId);
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "RUN_NOT_FOUND", message: `Run ${runId} not found` } },
      { status: 404 }
    );
  }

  const currentStatus = await run.status;

  if (
    currentStatus === "completed" ||
    currentStatus === "cancelled" ||
    currentStatus === "failed"
  ) {
    return NextResponse.json(
      { ok: false, error: { code: "ALREADY_TERMINAL", message: `Cannot cancel a ${currentStatus} workflow` } },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  await run.cancel();

  return NextResponse.json(
    { ok: true, runId, message: "Cancellation requested" },
    { headers: { "Cache-Control": "no-store" } }
  );
}
