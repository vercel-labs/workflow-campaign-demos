import { start } from "workflow/api";
import {
  contentBasedRouterFlow,
  type TicketPriority,
} from "@/content-based-router/workflows/content-based-router";

const VALID_PRIORITIES = new Set<TicketPriority>(["low", "medium", "high", "urgent"]);

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
    console.info(
      JSON.stringify({ level: "info", route: "/api/content-based-router", action: "invalid_json" }),
    );
    return createError(400, "Invalid JSON body", "INVALID_JSON");
  }

  const ticketId = typeof body.ticketId === "string" ? body.ticketId.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  if (!ticketId || !subject) {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/content-based-router",
        action: "invalid_request",
        ticketIdPresent: Boolean(ticketId),
        subjectPresent: Boolean(subject),
      }),
    );
    return createError(400, "ticketId and subject are required", "INVALID_REQUEST");
  }

  const priority =
    typeof body.priority === "string" && VALID_PRIORITIES.has(body.priority as TicketPriority)
      ? (body.priority as TicketPriority)
      : "medium";

  try {
    const run = await start(contentBasedRouterFlow, [ticketId, subject, priority]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/content-based-router",
        action: "workflow_started",
        runId: run.runId,
        ticketId,
        priority,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, ticketId, subject, priority, status: "routing" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/content-based-router",
        action: "start_failed",
        ticketId,
        priority,
        error: message,
      }),
    );
    return createError(500, message, "START_FAILED");
  }
}
