// getWritable + getStepMetadata are used here to stream demo UI events.
// A production workflow wouldn't need these unless it has its own streaming UI.
import { getStepMetadata, getWritable } from "workflow";

export type MessageId = string;

export type DLQEvent =
  | { type: "processing"; messageId: string }
  | { type: "attempt"; messageId: string; attempt: number }
  | { type: "success"; messageId: string; attempt: number }
  | { type: "retry"; messageId: string; attempt: number; error: string }
  | { type: "dlq"; messageId: string; error: string; attempts: number }
  | { type: "done"; summary: { delivered: number; deadLettered: number } };

type MessageResult = {
  messageId: string;
  status: "delivered" | "dead_lettered";
  attempts: number;
  error?: string;
};

type BatchReport = {
  status: "done";
  results: MessageResult[];
  summary: {
    delivered: number;
    deadLettered: number;
  };
};

// Demo: per-message processing latency so the UI can show progress
const PROCESS_DELAY_MS = 600;
const DLQ_DELAY_MS = 500;
const MAX_ATTEMPTS = 3;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function deadLetterQueue(
  messages: string[],
  poisonMessages: string[] = []
): Promise<BatchReport> {
  "use workflow";

  const results: MessageResult[] = [];

  for (const messageId of messages) {
    const isPoison = poisonMessages.includes(messageId);
    const result = await processMessage(messageId, isPoison);
    results.push(result);
  }

  return recordResults(results);
}

async function processMessage(
  messageId: string,
  isPoison: boolean
): Promise<MessageResult> {
  "use step";

  const writer = getWritable<DLQEvent>().getWriter();
  const { attempt } = getStepMetadata();

  try {
    await writer.write({ type: "processing", messageId });
    await writer.write({ type: "attempt", messageId, attempt });
    await delay(PROCESS_DELAY_MS);

    if (isPoison) {
      throw new Error(`Malformed payload: cannot parse message ${messageId}`);
    }

    await writer.write({ type: "success", messageId, attempt });
    return { messageId, status: "delivered", attempts: attempt };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Unknown processing error";

    if (attempt >= MAX_ATTEMPTS) {
      await writer.write({
        type: "dlq",
        messageId,
        error: message,
        attempts: attempt,
      });
      return {
        messageId,
        status: "dead_lettered",
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

async function recordResults(
  results: MessageResult[]
): Promise<BatchReport> {
  "use step";

  const writer = getWritable<DLQEvent>().getWriter();

  try {
    await delay(DLQ_DELAY_MS);

    const delivered = results.filter((r) => r.status === "delivered").length;
    const deadLettered = results.length - delivered;

    const report: BatchReport = {
      status: "done",
      results,
      summary: { delivered, deadLettered },
    };

    await writer.write({ type: "done", summary: report.summary });
    return report;
  } finally {
    writer.releaseLock();
  }
}
