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

export type RecipientChannel = "slack" | "email" | "pagerduty" | "webhook";
export type Severity = "info" | "warning" | "critical";

export type RoutingRule = {
  channel: RecipientChannel;
  match: (severity: Severity) => boolean;
};

// Demo-only: configures which channels should fail (and how) in the
// interactive UI. In a real workflow you'd remove this entirely — your
// steps would call real APIs and failures would be organic.
export type DemoFailures = {
  transient: RecipientChannel[];
  permanent: RecipientChannel[];
};

export type RecipientEvent =
  | { type: "rules_evaluated"; matched: string[]; skipped: string[] }
  | { type: "delivering"; channel: string }
  | { type: "delivered"; channel: string; durationMs: number }
  | { type: "delivery_failed"; channel: string; error: string; attempt: number }
  | { type: "delivery_retrying"; channel: string; attempt: number }
  | { type: "done"; summary: { delivered: number; failed: number; skipped: number } };

// ── Routing rules (evaluated at runtime) ───────────────────────────────
export const RULES: RoutingRule[] = [
  { channel: "slack", match: () => true },
  { channel: "email", match: (s) => s === "warning" || s === "critical" },
  { channel: "pagerduty", match: (s) => s === "critical" },
  { channel: "webhook", match: (s) => s !== "info" },
];

const CHANNEL_ERROR_MESSAGES: Record<RecipientChannel, string> = {
  slack: "Slack API rate limit exceeded",
  email: "Email provider returned 503",
  pagerduty: "PagerDuty integration is not configured",
  webhook: "Webhook endpoint timed out",
};

// Demo: simulate real-world network latency so the UI can show progress.
// In production, these delays would be replaced by actual API calls.
const CHANNEL_DELAY_MS: Record<RecipientChannel, number> = {
  slack: 650,
  email: 900,
  pagerduty: 750,
  webhook: 1100,
};

// setTimeout is available here because delay() is only called from
// "use step" functions, which have full Node.js runtime access.
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type DeliveryResult = {
  channel: RecipientChannel;
  status: "delivered" | "failed";
  durationMs?: number;
  error?: string;
};

export type RecipientListReport = {
  alertId: string;
  message: string;
  severity: Severity;
  status: "done";
  matched: RecipientChannel[];
  skipped: RecipientChannel[];
  deliveries: DeliveryResult[];
  summary: { delivered: number; failed: number; skipped: number };
};

const NO_FAILURES: DemoFailures = { transient: [], permanent: [] };

// Demo entry point. The `failures` parameter is only used by the interactive
// UI to let users toggle simulated failures — strip it out when adapting
// this workflow for production use.
export async function recipientList(
  alertId: string,
  message: string,
  severity: Severity = "warning",
  failures: DemoFailures = NO_FAILURES
): Promise<RecipientListReport> {
  "use workflow";

  const matched = RULES.filter((r) => r.match(severity)).map((r) => r.channel);
  const skipped = RULES.filter((r) => !r.match(severity)).map((r) => r.channel);

  const writer = getWritable<RecipientEvent>().getWriter();
  try {
    await writer.write({ type: "rules_evaluated", matched, skipped });
  } finally {
    writer.releaseLock();
  }

  const settled = await Promise.allSettled(
    matched.map((channel) => deliverToRecipient(channel, alertId, message, failures))
  );

  const deliveries: DeliveryResult[] = settled.map((result, index) => {
    const channel = matched[index];
    if (result.status === "fulfilled") {
      return { channel, status: "delivered", durationMs: result.value.durationMs };
    }
    return { channel, status: "failed", error: `${channel}: ${errorMessage(result.reason)}` };
  });

  return aggregateResults(alertId, message, severity, matched, skipped, deliveries);
}

function errorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === "string") return reason;
  return "Unknown delivery failure";
}

// Demo: shared delivery implementation for all channel steps. In production
// you'd replace the delay + simulated failures with a real API call per channel.
// The getWritable() streaming and getStepMetadata() calls are also demo-only
// — they power the live execution log in the UI.
async function deliverToRecipient(
  channel: RecipientChannel,
  alertId: string,
  message: string,
  failures: DemoFailures
): Promise<{ durationMs: number }> {
  "use step";

  const writer = getWritable<RecipientEvent>().getWriter();
  const { attempt } = getStepMetadata();
  const start = Date.now();

  try {
    if (attempt > 1) {
      await writer.write({ type: "delivery_retrying", channel, attempt });
    }

    await writer.write({ type: "delivering", channel });
    await delay(CHANNEL_DELAY_MS[channel]);

    // Permanent failure — FatalError prevents the SDK's automatic retry,
    // so the channel stays failed in Promise.allSettled().
    if (failures.permanent.includes(channel)) {
      const error = CHANNEL_ERROR_MESSAGES[channel];
      await writer.write({ type: "delivery_failed", channel, error, attempt });
      throw new FatalError(error);
    }

    // Transient failure — throws a regular Error on attempt 1 so the SDK
    // auto-retries. The retry will succeed, showing the recovery path.
    if (attempt === 1 && failures.transient.includes(channel)) {
      throw new Error(CHANNEL_ERROR_MESSAGES[channel]);
    }

    const durationMs = Date.now() - start;
    await writer.write({ type: "delivered", channel, durationMs });
    return { durationMs };
  } finally {
    writer.releaseLock();
  }
}

async function aggregateResults(
  alertId: string,
  message: string,
  severity: Severity,
  matched: RecipientChannel[],
  skipped: RecipientChannel[],
  deliveries: DeliveryResult[]
): Promise<RecipientListReport> {
  "use step";

  const writer = getWritable<RecipientEvent>().getWriter();

  try {
    const delivered = deliveries.filter((d) => d.status === "delivered").length;
    const failed = deliveries.length - delivered;
    const summary = { delivered, failed, skipped: skipped.length };

    await writer.write({ type: "done", summary });

    return {
      alertId,
      message,
      severity,
      status: "done",
      matched,
      skipped,
      deliveries,
      summary,
    };
  } finally {
    writer.releaseLock();
  }
}
