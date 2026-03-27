import { resumeHook, start } from "workflow/api";
import { resequencer } from "@/resequencer/workflows/resequencer";
import { jsonError } from "@/lib/http/json-error";

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/resequencer",
        action: "invalid_json",
      }),
    );
    return jsonError(400, "INVALID_JSON", "Invalid JSON body");
  }

  const batchId = typeof body.batchId === "string" ? body.batchId.trim() : "";

  if (!batchId) {
    return jsonError(400, "INVALID_REQUEST", "batchId is required");
  }

  const seq = typeof body.seq === "number" ? body.seq : undefined;
  const payload = typeof body.payload === "string" ? body.payload.trim() : "";

  if (typeof seq === "number") {
    if (seq < 1) {
      return jsonError(400, "INVALID_REQUEST", "seq must be >= 1");
    }

    if (!payload) {
      return jsonError(400, "INVALID_REQUEST", "payload is required when seq is provided");
    }

    const token = `resequencer:${batchId}:${seq}`;

    try {
      const result = await resumeHook(token, { seq, payload });

      if (!result) {
        return jsonError(404, "RUN_NOT_FOUND", "Hook not found or already resolved", {
          token,
        });
      }

      console.info(
        JSON.stringify({
          level: "info",
          route: "/api/resequencer",
          action: "hook_resumed",
          runId: result.runId,
          batchId,
          seq,
        }),
      );

      return Response.json(
        { ok: true, runId: result.runId, batchId, seq, payload, token },
        { headers: { "cache-control": "no-store" } },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to resume hook";
      console.error(
        JSON.stringify({
          level: "error",
          route: "/api/resequencer",
          action: "hook_resume_failed",
          error: message,
          batchId,
          seq,
        }),
      );
      return jsonError(500, "START_FAILED", message, { batchId, seq });
    }
  }

  const expectedCount =
    typeof body.expectedCount === "number" &&
    body.expectedCount >= 2 &&
    body.expectedCount <= 20
      ? body.expectedCount
      : 5;

  try {
    const run = await start(resequencer, [batchId, expectedCount]);
    const tokens = Array.from({ length: expectedCount }, (_, index) =>
      `resequencer:${batchId}:${index + 1}`,
    );

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/resequencer",
        action: "workflow_started",
        runId: run.runId,
        batchId,
        expectedCount,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, batchId, expectedCount, tokens },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/resequencer",
        action: "start_failed",
        error: message,
        batchId,
      }),
    );
    return jsonError(500, "START_FAILED", message, { batchId });
  }
}
