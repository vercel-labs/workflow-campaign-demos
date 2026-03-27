import { start } from "workflow/api";
import {
  publishSubscribeFlow,
  type Topic,
} from "@/publish-subscribe/workflows/publish-subscribe";
import { jsonError } from "@/lib/http/json-error";

const VALID_TOPICS = new Set<Topic>(["orders", "inventory", "shipping", "analytics"]);

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/publish-subscribe",
        action: "invalid_json",
      }),
    );
    return jsonError(400, "INVALID_JSON", "Invalid JSON body");
  }

  const topic =
    typeof body.topic === "string" && VALID_TOPICS.has(body.topic as Topic)
      ? (body.topic as Topic)
      : null;
  const payload = typeof body.payload === "string" ? body.payload.trim() : "";

  if (!topic) {
    return jsonError(
      400,
      "INVALID_REQUEST",
      "topic is required (orders | inventory | shipping | analytics)",
    );
  }

  if (!payload) {
    return jsonError(400, "INVALID_REQUEST", "payload is required");
  }

  try {
    const run = await start(publishSubscribeFlow, [topic, payload]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/publish-subscribe",
        action: "workflow_started",
        runId: run.runId,
        topic,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, topic, payload, status: "publishing" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/publish-subscribe",
        action: "start_failed",
        error: message,
        topic,
      }),
    );
    return jsonError(500, "START_FAILED", message, { topic });
  }
}
