// getWritable is used here to stream demo UI events.
// A production workflow wouldn't need this unless it has its own streaming UI.
import { FatalError, getWritable } from "workflow";

export type NotificationChannel = "slack" | "email" | "sms" | "pagerduty";

export type ChannelEvent =
  | { type: "channel_sending"; channel: string }
  | { type: "channel_sent"; channel: string; providerId: string }
  | { type: "channel_failed"; channel: string; error: string; attempt: number }
  | { type: "channel_retrying"; channel: string; attempt: number }
  | { type: "aggregating" }
  | { type: "done"; summary: { ok: number; failed: number } };

type ChannelResult = {
  channel: NotificationChannel;
  status: "sent" | "failed";
  providerId?: string;
  error?: string;
};

type IncidentReport = {
  incidentId: string;
  message: string;
  status: "done";
  deliveries: ChannelResult[];
  summary: {
    ok: number;
    failed: number;
  };
};

const CHANNEL_ERROR_MESSAGES: Record<NotificationChannel, string> = {
  slack: "Slack API rate limit exceeded",
  email: "Email provider returned 503",
  sms: "SMS delivery failed: invalid number",
  pagerduty: "PagerDuty integration is not configured",
};

// Demo: simulate real-world network latency so the UI can show progress.
// In production, these delays would be replaced by actual API calls.
const CHANNEL_DELAY_MS: Record<NotificationChannel, number> = {
  slack: 650,
  pagerduty: 750,
  email: 900,
  sms: 1150,
};

const AGGREGATE_DELAY_MS = 500;

// setTimeout is available here because delay() is only called from
// "use step" functions, which have full Node.js runtime access.
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function incidentFanOut(
  incidentId: string,
  message: string,
  failChannels: NotificationChannel[] = []
): Promise<IncidentReport> {
  "use workflow";

  const fanOutTargets = [
    {
      channel: "slack" as const,
      send: () => sendSlackAlert(incidentId, message, failChannels),
    },
    {
      channel: "email" as const,
      send: () => sendEmailAlert(incidentId, message, failChannels),
    },
    {
      channel: "sms" as const,
      send: () => sendSmsAlert(incidentId, message, failChannels),
    },
    {
      channel: "pagerduty" as const,
      send: () => sendPagerDutyAlert(incidentId, message, failChannels),
    },
  ];

  const settled = await Promise.allSettled(
    fanOutTargets.map((target) => target.send())
  );

  const deliveries: ChannelResult[] = settled.map((result, index) => {
    const channel = fanOutTargets[index].channel;

    if (result.status === "fulfilled") {
      return {
        channel,
        status: "sent",
        providerId: result.value.providerId,
      };
    }

    return {
      channel,
      status: "failed",
      error: `${channel}: ${errorMessage(result.reason)}`,
    };
  });

  return aggregateResults(incidentId, message, deliveries);
}

function errorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  return "Unknown delivery failure";
}

async function sendChannelAlert(
  channel: NotificationChannel,
  incidentId: string,
  message: string,
  failChannels: NotificationChannel[]
): Promise<{ providerId: string }> {
  // Demo: stream progress events to the UI via getWritable()
  const writer = getWritable<ChannelEvent>().getWriter();

  try {
    await writer.write({ type: "channel_sending", channel }); // Demo: notify UI that this channel started
    await delay(CHANNEL_DELAY_MS[channel]); // Demo: simulate network latency for visualization

    if (failChannels.includes(channel)) {
      const error = CHANNEL_ERROR_MESSAGES[channel];
      await writer.write({ type: "channel_failed", channel, error, attempt: 1 });
      // FatalError prevents the SDK's automatic retry so the failure is
      // permanent — exactly what Promise.allSettled() is designed to handle.
      throw new FatalError(error);
    }

    const providerId = `${channel}_${incidentId}_${message.length}`;
    await writer.write({ type: "channel_sent", channel, providerId }); // Demo: notify UI of success

    return { providerId };
  } finally {
    writer.releaseLock();
  }
}

async function sendSlackAlert(
  incidentId: string,
  message: string,
  failChannels: NotificationChannel[]
): Promise<{ providerId: string }> {
  "use step";
  return sendChannelAlert("slack", incidentId, message, failChannels);
}

async function sendEmailAlert(
  incidentId: string,
  message: string,
  failChannels: NotificationChannel[]
): Promise<{ providerId: string }> {
  "use step";
  return sendChannelAlert("email", incidentId, message, failChannels);
}

async function sendSmsAlert(
  incidentId: string,
  message: string,
  failChannels: NotificationChannel[]
): Promise<{ providerId: string }> {
  "use step";
  return sendChannelAlert("sms", incidentId, message, failChannels);
}

async function sendPagerDutyAlert(
  incidentId: string,
  message: string,
  failChannels: NotificationChannel[]
): Promise<{ providerId: string }> {
  "use step";
  return sendChannelAlert("pagerduty", incidentId, message, failChannels);
}

async function aggregateResults(
  incidentId: string,
  message: string,
  deliveries: ChannelResult[]
): Promise<IncidentReport> {
  "use step";
  // Demo: stream aggregation progress to the UI
  const writer = getWritable<ChannelEvent>().getWriter();

  try {
    await writer.write({ type: "aggregating" }); // Demo: notify UI that aggregation started
    await delay(AGGREGATE_DELAY_MS); // Demo: simulate processing time for visualization

    const ok = deliveries.filter((delivery) => delivery.status === "sent").length;
    const failed = deliveries.length - ok;
    const report: IncidentReport = {
      incidentId,
      message,
      status: "done",
      deliveries,
      summary: { ok, failed },
    };

    await writer.write({ type: "done", summary: report.summary }); // Demo: notify UI of completion

    return report;
  } finally {
    writer.releaseLock();
  }
}
