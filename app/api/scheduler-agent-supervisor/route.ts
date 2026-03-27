import { start } from "workflow/api";
import {
  schedulerAgentSupervisor,
  type QualityThreshold,
} from "@/scheduler-agent-supervisor/workflows/scheduler-agent-supervisor";

function createError(status: number, message: string, code: string) {
  return Response.json(
    { ok: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function normalizeThreshold(value: unknown): QualityThreshold | null {
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }

  return null;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/scheduler-agent-supervisor",
        action: "invalid_json",
      }),
    );
    return createError(400, "Invalid JSON body", "INVALID_JSON");
  }

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const threshold = body.threshold === undefined ? "medium" : normalizeThreshold(body.threshold);

  if (!topic) {
    return createError(400, "topic is required", "INVALID_REQUEST");
  }

  if (!threshold) {
    return createError(
      400,
      "threshold must be one of: low, medium, high",
      "INVALID_REQUEST",
    );
  }

  try {
    const run = await start(schedulerAgentSupervisor, [topic, threshold]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/scheduler-agent-supervisor",
        action: "workflow_started",
        runId: run.runId,
        topic,
        threshold,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, topic, threshold },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/scheduler-agent-supervisor",
        action: "start_failed",
        topic,
        threshold,
        error: message,
      }),
    );
    return createError(500, message, "START_FAILED");
  }
}
