import { start } from "workflow/api";
import {
  recipientList,
  type DemoFailures,
  type RecipientChannel,
  type Severity,
} from "@/recipient-list/workflows/recipient-list";
import { jsonError } from "@/lib/http/json-error";

const VALID_SEVERITIES = new Set<Severity>(["info", "warning", "critical"]);
const VALID_CHANNELS = new Set<RecipientChannel>([
  "slack",
  "email",
  "pagerduty",
  "webhook",
]);

function parseChannelArray(value: unknown): RecipientChannel[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (channel): channel is RecipientChannel =>
      typeof channel === "string" && VALID_CHANNELS.has(channel as RecipientChannel),
  );
}

function parseFailures(value: unknown): DemoFailures {
  if (!value || typeof value !== "object") {
    return { transient: [], permanent: [] };
  }

  const failures = value as Record<string, unknown>;
  return {
    transient: parseChannelArray(failures.transient),
    permanent: parseChannelArray(failures.permanent),
  };
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/recipient-list",
        action: "invalid_json",
      }),
    );
    return jsonError(400, "INVALID_JSON", "Invalid JSON body");
  }

  const alertId =
    typeof body.alertId === "string" && body.alertId.trim().length > 0
      ? body.alertId.trim()
      : `alert-${Date.now()}`;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const severity =
    typeof body.severity === "string" && VALID_SEVERITIES.has(body.severity as Severity)
      ? (body.severity as Severity)
      : "warning";
  const failures = parseFailures(body.failures);

  if (!message) {
    return jsonError(400, "INVALID_REQUEST", "message is required");
  }

  try {
    const run = await start(recipientList, [alertId, message, severity, failures]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/recipient-list",
        action: "workflow_started",
        runId: run.runId,
        alertId,
        severity,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, alertId, severity, status: "routing" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/recipient-list",
        action: "start_failed",
        error: messageText,
        alertId,
      }),
    );
    return jsonError(500, "START_FAILED", messageText, { alertId });
  }
}
