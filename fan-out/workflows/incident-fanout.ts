// getWritable + getStepMetadata are used here to stream demo UI events.
// A production workflow wouldn't need these unless it has its own streaming UI.
import { getStepMetadata, getWritable } from "workflow";

// Local FatalError — prevents the SDK's automatic retry for permanent failures.
// The workflow package does not export this class, so we define it here.
class FatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FatalError";
  }
}

export type NotificationChannel = "slack" | "email" | "sms" | "pagerduty";

// Demo-only: configures which channels should fail (and how) in the
// interactive UI. In a real workflow you'd remove this entirely — your
// steps would call real APIs and failures would be organic.
export type DemoFailures = {
  transient: NotificationChannel[];
  permanent: NotificationChannel[];
};

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

const NO_FAILURES: DemoFailures = { transient: [], permanent: [] };

// Demo entry point. The `failures` parameter is only used by the interactive
// UI to let users toggle simulated failures — strip it out when adapting
// this workflow for production use.
export async function incidentFanOut(
  incidentId: string,
  message: string,
  failures: DemoFailures = NO_FAILURES
): Promise<IncidentReport> {
  "use workflow";

  const fanOutTargets = [
    {
      channel: "slack" as const,
      send: () => sendSlackAlert(incidentId, message, failures),
    },
    {
      channel: "email" as const,
      send: () => sendEmailAlert(incidentId, message, failures),
    },
    {
      channel: "sms" as const,
      send: () => sendSmsAlert(incidentId, message, failures),
    },
    {
      channel: "pagerduty" as const,
      send: () => sendPagerDutyAlert(incidentId, message, failures),
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

// Demo: shared implementation for all channel steps. In production you'd
// replace the delay + simulated failures with a real API call per channel.
// The getWritable() streaming and getStepMetadata() calls are also demo-only
// — they power the live execution log in the UI.
async function sendChannelAlert(
  channel: NotificationChannel,
  incidentId: string,
  message: string,
  failures: DemoFailures
): Promise<{ providerId: string }> {
  const writer = getWritable<ChannelEvent>().getWriter();
  const { attempt } = getStepMetadata();

  try {
    if (attempt > 1) {
      await writer.write({ type: "channel_retrying", channel, attempt });
    }

    await writer.write({ type: "channel_sending", channel });
    await delay(CHANNEL_DELAY_MS[channel]);

    // Permanent failure — FatalError prevents the SDK's automatic retry,
    // so the channel stays failed in Promise.allSettled().
    if (failures.permanent.includes(channel)) {
      const error = CHANNEL_ERROR_MESSAGES[channel];
      await writer.write({ type: "channel_failed", channel, error, attempt });
      throw new FatalError(error);
    }

    // Transient failure — throws a regular Error on attempt 1 so the SDK
    // auto-retries. The retry will succeed, showing the recovery path.
    if (attempt === 1 && failures.transient.includes(channel)) {
      throw new Error(CHANNEL_ERROR_MESSAGES[channel]);
    }

    const providerId = `${channel}_${incidentId}_${message.length}_${attempt}`;
    await writer.write({ type: "channel_sent", channel, providerId });

    return { providerId };
  } finally {
    writer.releaseLock();
  }
}

async function sendSlackAlert(
  incidentId: string,
  message: string,
  failures: DemoFailures
): Promise<{ providerId: string }> {
  "use step";
  return sendChannelAlert("slack", incidentId, message, failures);
}

async function sendEmailAlert(
  incidentId: string,
  message: string,
  failures: DemoFailures
): Promise<{ providerId: string }> {
  "use step";
  return sendChannelAlert("email", incidentId, message, failures);
}

async function sendSmsAlert(
  incidentId: string,
  message: string,
  failures: DemoFailures
): Promise<{ providerId: string }> {
  "use step";
  return sendChannelAlert("sms", incidentId, message, failures);
}

async function sendPagerDutyAlert(
  incidentId: string,
  message: string,
  failures: DemoFailures
): Promise<{ providerId: string }> {
  "use step";
  return sendChannelAlert("pagerduty", incidentId, message, failures);
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
    await writer.write({ type: "aggregating" });
    await delay(AGGREGATE_DELAY_MS);

    const ok = deliveries.filter((delivery) => delivery.status === "sent").length;
    const failed = deliveries.length - ok;
    const report: IncidentReport = {
      incidentId,
      message,
      status: "done",
      deliveries,
      summary: { ok, failed },
    };

    await writer.write({ type: "done", summary: report.summary });

    return report;
  } finally {
    writer.releaseLock();
  }
}
