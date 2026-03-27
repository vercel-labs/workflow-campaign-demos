import { start } from "workflow/api";
import { generatePost } from "@/namespaced-streams/workflows/namespaced-streams";
import { jsonError } from "@/lib/http/json-error";

type RequestBody = {
  topic?: unknown;
};

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/namespaced-streams",
        action: "invalid_json",
      }),
    );

    return jsonError(400, "INVALID_JSON", "Invalid JSON body");
  }

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";

  if (!topic) {
    return jsonError(400, "INVALID_REQUEST", "topic is required");
  }

  try {
    const run = await start(generatePost, [topic]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/namespaced-streams",
        action: "workflow_started",
        runId: run.runId,
        topic,
      }),
    );

    return Response.json(
      {
        ok: true,
        runId: run.runId,
        topic,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";

    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/namespaced-streams",
        action: "start_failed",
        topic,
        error: message,
      }),
    );

    return jsonError(500, "START_FAILED", message, { topic });
  }
}
