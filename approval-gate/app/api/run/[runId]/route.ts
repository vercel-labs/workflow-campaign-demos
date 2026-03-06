import { getRun } from "workflow/api";

type RunRouteContext = {
  params: Promise<{ runId: string }>;
};

export async function GET(_request: Request, { params }: RunRouteContext) {
  const { runId } = await params;

  let run: Awaited<ReturnType<typeof getRun>>;
  try {
    run = await getRun(runId);
  } catch {
    return Response.json(
      { ok: false, error: { code: "RUN_NOT_FOUND", message: `Run ${runId} not found` } },
      { status: 404, headers: { "Cache-Control": "no-store" } }
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

  return Response.json({
    ok: true,
    runId,
    status,
    workflowName,
    createdAt: createdAt.toISOString(),
    startedAt: startedAt?.toISOString() ?? null,
    completedAt: completedAt?.toISOString() ?? null,
  });
}
