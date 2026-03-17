// getWritable + getStepMetadata are used here to stream demo UI events.
// A production workflow wouldn't need these unless it has its own streaming UI.
import { getStepMetadata, getWritable } from "workflow";

export type MessageId = string;

export type GDEvent =
  | { type: "persist"; messageId: string }
  | { type: "send"; messageId: string; attempt: number }
  | { type: "ack"; messageId: string; attempt: number }
  | { type: "retry"; messageId: string; attempt: number; error: string }
  | { type: "confirm"; messageId: string; attempt: number }
  | { type: "fail"; messageId: string; error: string; attempts: number }
  | { type: "done"; summary: { delivered: number; failed: number } };

type MessageResult = {
  messageId: string;
  status: "delivered" | "failed";
  attempts: number;
  error?: string;
};

type DeliveryReport = {
  status: "done";
  results: MessageResult[];
  summary: {
    delivered: number;
    failed: number;
  };
};

// Demo: per-step latency so the UI can show progress
const PERSIST_DELAY_MS = 400;
const SEND_DELAY_MS = 600;
const CONFIRM_DELAY_MS = 300;
const MAX_ATTEMPTS = 3;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function guaranteedDelivery(
  messages: string[],
  failMessages: string[] = []
): Promise<DeliveryReport> {
  "use workflow";

  const results: MessageResult[] = [];

  for (const messageId of messages) {
    const shouldFail = failMessages.includes(messageId);
    const result = await deliverMessage(messageId, shouldFail);
    results.push(result);
  }

  return finalizeDelivery(results);
}

async function deliverMessage(
  messageId: string,
  shouldFail: boolean
): Promise<MessageResult> {
  "use step";

  const writer = getWritable<GDEvent>().getWriter();
  const { attempt } = getStepMetadata();

  try {
    await writer.write({ type: "persist", messageId });
    await delay(PERSIST_DELAY_MS);

    await writer.write({ type: "send", messageId, attempt });
    await delay(SEND_DELAY_MS);

    if (shouldFail) {
      throw new Error(`Delivery failed: recipient unreachable for ${messageId}`);
    }

    await writer.write({ type: "ack", messageId, attempt });
    await delay(CONFIRM_DELAY_MS);

    await writer.write({ type: "confirm", messageId, attempt });
    return { messageId, status: "delivered", attempts: attempt };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown delivery error";

    if (attempt >= MAX_ATTEMPTS) {
      await writer.write({
        type: "fail",
        messageId,
        error: message,
        attempts: attempt,
      });
      return {
        messageId,
        status: "failed",
        attempts: attempt,
        error: message,
      };
    }

    await writer.write({
      type: "retry",
      messageId,
      attempt,
      error: message,
    });

    throw error instanceof Error ? error : new Error(message);
  } finally {
    writer.releaseLock();
  }
}

async function finalizeDelivery(
  results: MessageResult[]
): Promise<DeliveryReport> {
  "use step";

  const writer = getWritable<GDEvent>().getWriter();

  try {
    await delay(CONFIRM_DELAY_MS);

    const delivered = results.filter((r) => r.status === "delivered").length;
    const failed = results.length - delivered;

    const report: DeliveryReport = {
      status: "done",
      results,
      summary: { delivered, failed },
    };

    await writer.write({ type: "done", summary: report.summary });
    return report;
  } finally {
    writer.releaseLock();
  }
}
