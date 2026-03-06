import { start } from "workflow/api";
import {
  schedulerAgentSupervisor,
  type QualityThreshold,
} from "@/workflows/scheduler-agent-supervisor";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store",
} as const;

function createErrorResponse(status: number, code: string, message: string) {
  return Response.json(
    {
      ok: false,
      error: {
        code,
        message,
      },
    },
    {
      status,
      headers: NO_STORE_HEADERS,
    }
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
    return createErrorResponse(400, "INVALID_JSON", "Invalid JSON body");
  }

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  if (!topic) {
    return createErrorResponse(400, "MISSING_TOPIC", "topic is required");
  }

  let threshold: QualityThreshold = "medium";
  if (body.threshold !== undefined) {
    const parsedThreshold = normalizeThreshold(body.threshold);
    if (!parsedThreshold) {
      return createErrorResponse(
        400,
        "INVALID_THRESHOLD",
        "threshold must be one of: low, medium, high"
      );
    }
    threshold = parsedThreshold;
  }

  try {
    const run = await start(schedulerAgentSupervisor, [topic, threshold]);

    return Response.json(
      {
        ok: true,
        runId: run.runId,
        topic,
        threshold,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("[scheduler-agent-supervisor] start_failed", {
      attempted: "start(schedulerAgentSupervisor)",
      topic,
      threshold,
      failed: error instanceof Error ? error.message : String(error),
      state: "workflow-start-failed",
    });

    const message =
      error instanceof Error ? error.message : "Failed to start workflow";
    return createErrorResponse(500, "WORKFLOW_START_FAILED", message);
  }
}
