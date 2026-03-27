import { start } from "workflow/api";
import { detourFlow } from "@/detour/workflows/detour";
import { jsonError } from "@/lib/http/json-error";

type RequestBody = {
  deployId?: unknown;
  qaMode?: unknown;
};

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/detour",
        action: "invalid_json",
      }),
    );

    return jsonError(400, "INVALID_JSON", "Invalid JSON body");
  }

  const deployId =
    typeof body.deployId === "string" ? body.deployId.trim() : "";
  const qaMode = body.qaMode === true;

  if (!deployId) {
    return jsonError(400, "INVALID_REQUEST", "deployId is required");
  }

  try {
    const run = await start(detourFlow, [deployId, qaMode]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/detour",
        action: "workflow_started",
        runId: run.runId,
        deployId,
        qaMode,
      }),
    );

    return Response.json(
      {
        ok: true,
        runId: run.runId,
        deployId,
        qaMode,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";

    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/detour",
        action: "start_failed",
        deployId,
        error: message,
      }),
    );

    return jsonError(500, "START_FAILED", message, { deployId });
  }
}
