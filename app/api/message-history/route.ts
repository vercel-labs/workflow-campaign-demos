import { start } from "workflow/api";
import { supportTicketRouting } from "@/message-history/workflows/support-ticket-routing";
import { jsonError } from "@/lib/http/json-error";

type RequestBody = {
  subject?: unknown;
  body?: unknown;
  failAtStep?: unknown;
};

const VALID_FAIL_STEPS = new Set([
  "normalizeTicket",
  "classifySeverity",
  "chooseRoute",
  "dispatchTicket",
]);

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/message-history",
        action: "invalid_json",
      }),
    );

    return jsonError(400, "INVALID_JSON", "Invalid JSON body");
  }

  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const ticketBody = typeof body.body === "string" ? body.body.trim() : "";
  const failAtStep =
    typeof body.failAtStep === "string" && VALID_FAIL_STEPS.has(body.failAtStep)
      ? body.failAtStep
      : null;

  if (!subject) {
    return jsonError(400, "INVALID_REQUEST", "subject is required");
  }

  if (!ticketBody) {
    return jsonError(400, "INVALID_REQUEST", "body is required");
  }

  const correlationId = `ticket_${Date.now()}`;

  try {
    const run = await start(supportTicketRouting, [
      correlationId,
      subject,
      ticketBody,
      failAtStep,
    ]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/message-history",
        action: "workflow_started",
        runId: run.runId,
        correlationId,
        failAtStep,
      }),
    );

    return Response.json(
      {
        ok: true,
        runId: run.runId,
        correlationId,
        subject,
        failAtStep,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";

    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/message-history",
        action: "start_failed",
        correlationId,
        error: message,
      }),
    );

    return jsonError(500, "START_FAILED", message, { correlationId });
  }
}
