import { getRun } from "workflow/api";
import { jsonError } from "@/lib/http/json-error";

type RunRouteContext = {
  params: Promise<Record<string, string>>;
};

export async function GET(_request: Request, { params }: RunRouteContext) {
  const { runId } = await params;

  let run;
  try {
    run = getRun(runId);
  } catch {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/run/[runId]",
        action: "run_not_found",
        runId,
      }),
    );

    return jsonError(404, "RUN_NOT_FOUND", `Run ${runId} not found`, {
      runId,
    });
  }

  const [status, workflowName, createdAt, startedAt, completedAt] =
    await Promise.all([
      run.status,
      run.workflowName,
      run.createdAt,
      run.startedAt,
      run.completedAt,
    ]);

  console.info(
    JSON.stringify({
      level: "info",
      route: "/api/run/[runId]",
      action: "run_metadata_retrieved",
      runId,
      status,
    }),
  );

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

export async function DELETE(_request: Request, { params }: RunRouteContext) {
  const { runId } = await params;

  let run;
  try {
    run = getRun(runId);
  } catch {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/run/[runId]",
        action: "run_not_found",
        runId,
      }),
    );

    return jsonError(404, "RUN_NOT_FOUND", `Run ${runId} not found`, {
      runId,
    });
  }

  const currentStatus = await run.status;

  if (
    currentStatus === "completed" ||
    currentStatus === "cancelled" ||
    currentStatus === "failed"
  ) {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/run/[runId]",
        action: "cancel_rejected_terminal",
        runId,
        status: currentStatus,
      }),
    );

    return jsonError(
      400,
      "ALREADY_TERMINAL",
      `Cannot cancel a ${currentStatus} workflow`,
      { runId, status: currentStatus },
    );
  }

  await run.cancel();

  console.info(
    JSON.stringify({
      level: "info",
      route: "/api/run/[runId]",
      action: "cancellation_requested",
      runId,
    }),
  );

  return Response.json(
    { ok: true, runId, message: "Cancellation requested" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
