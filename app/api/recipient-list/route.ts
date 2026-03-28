// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import {
  recipientList,
  type Severity,
  type RecipientChannel,
  type DemoFailures,
} from "@/recipient-list/workflows/recipient-list";

type RecipientListRequestBody = {
  alertId?: unknown;
  message?: unknown;
  severity?: unknown;
  failures?: unknown;
};

const VALID_SEVERITIES = new Set<Severity>(["info", "warning", "critical"]);

const VALID_CHANNELS = new Set<RecipientChannel>([
  "slack",
  "email",
  "pagerduty",
  "webhook",
]);

function parseChannelArray(value: unknown): RecipientChannel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (channel): channel is RecipientChannel =>
      typeof channel === "string" && VALID_CHANNELS.has(channel as RecipientChannel)
  );
}

function parseFailures(value: unknown): DemoFailures {
  if (!value || typeof value !== "object") {
    return { transient: [], permanent: [] };
  }

  const obj = value as Record<string, unknown>;
  return {
    transient: parseChannelArray(obj.transient),
    permanent: parseChannelArray(obj.permanent),
  };
}

export async function POST(request: Request) {
  let body: RecipientListRequestBody;

  try {
    body = (await request.json()) as RecipientListRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const alertId =
    typeof body.alertId === "string" ? body.alertId.trim() : `alert-${Date.now()}`;
  const message =
    typeof body.message === "string" ? body.message.trim() : "";
  const severity: Severity =
    typeof body.severity === "string" && VALID_SEVERITIES.has(body.severity as Severity)
      ? (body.severity as Severity)
      : "warning";
  const failures = parseFailures(body.failures);

  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const run = await start(recipientList, [alertId, message, severity, failures]);

  return NextResponse.json({
    runId: run.runId,
    alertId,
    severity,
    status: "routing",
  });
}
