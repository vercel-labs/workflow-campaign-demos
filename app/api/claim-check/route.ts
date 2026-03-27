import { start } from "workflow/api";
import { claimCheckImport } from "@/claim-check/workflows/claim-check";

function createError(
  status: number,
  error: string,
  code: string,
  details?: Record<string, unknown>,
) {
  return Response.json(
    {
      ok: false,
      error: { code, message: error, details: details ?? null },
    },
    {
      status,
      headers: { "cache-control": "no-store" },
    },
  );
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const importId =
    typeof body.importId === "string" && body.importId.trim().length > 0
      ? body.importId.trim()
      : crypto.randomUUID().slice(0, 8);

  try {
    const run = await start(claimCheckImport, [importId]);
    const hookToken = `upload:${importId}`;

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/claim-check",
        action: "workflow_started",
        runId: run.runId,
        importId,
        hookToken,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, importId, hookToken, status: "waiting" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/claim-check",
        action: "start_failed",
        importId,
        error: message,
      }),
    );
    return createError(500, message, "START_FAILED");
  }
}
