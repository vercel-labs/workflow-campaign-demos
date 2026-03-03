import { NextResponse } from "next/server";
import { start } from "workflow/api";
import {
  incidentFanOut,
  type NotificationChannel,
} from "@/workflows/incident-fanout";

type FanOutRequestBody = {
  incidentId?: unknown;
  message?: unknown;
  failChannels?: unknown;
};

const VALID_CHANNELS = new Set<NotificationChannel>([
  "slack",
  "email",
  "sms",
  "pagerduty",
]);

function parseFailChannels(value: unknown): NotificationChannel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (channel): channel is NotificationChannel =>
      typeof channel === "string" && VALID_CHANNELS.has(channel as NotificationChannel)
  );
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
  const failChannels = parseFailChannels(body.failChannels);

  if (!incidentId) {
    return NextResponse.json({ error: "incidentId is required" }, { status: 400 });
  }

  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const run = await start(incidentFanOut, [incidentId, message, failChannels]);

  return NextResponse.json({
    runId: run.runId,
    incidentId,
    message,
    failChannels,
    status: "fan_out",
  });
}
