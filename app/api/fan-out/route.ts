// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import {
  incidentFanOut,
  type NotificationChannel,
  type DemoFailures,
} from "@/fan-out/workflows/incident-fanout";

type FanOutRequestBody = {
  incidentId?: unknown;
  message?: unknown;
  failures?: unknown;
};

const VALID_CHANNELS = new Set<NotificationChannel>([
  "slack",
  "email",
  "sms",
  "pagerduty",
]);

function parseChannelArray(value: unknown): NotificationChannel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (channel): channel is NotificationChannel =>
      typeof channel === "string" && VALID_CHANNELS.has(channel as NotificationChannel)
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
  let body: FanOutRequestBody;

  try {
    body = (await request.json()) as FanOutRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const incidentId =
    typeof body.incidentId === "string" ? body.incidentId.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const failures = parseFailures(body.failures);

  if (!incidentId) {
    return NextResponse.json({ error: "incidentId is required" }, { status: 400 });
  }

  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const run = await start(incidentFanOut, [incidentId, message, failures]);

  return NextResponse.json({
    runId: run.runId,
    incidentId,
    message,
    failures,
    status: "fan_out",
  });
}
