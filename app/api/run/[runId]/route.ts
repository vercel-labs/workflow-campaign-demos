import { NextResponse } from "next/server";
import { getRun } from "workflow/api";

type RunRouteContext = {
  params: Promise<{ runId: string }>;
};

export async function GET(_request: Request, { params }: RunRouteContext) {
  const { runId } = await params;
  const run = await getRun(runId);

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
