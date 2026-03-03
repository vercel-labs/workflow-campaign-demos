import { sleep, getWritable, FatalError } from "workflow";

export type RetryEvent =
  | { type: "attempt_start"; attempt: number; contactId: string }
  | { type: "attempt_fail"; attempt: number; error: string; sleepMs: number }
  | { type: "attempt_success"; attempt: number; contactId: string };

export interface ContactSyncResult {
  contactId: string;
  status: "completed" | "failed";
  attempts: number;
  lastError?: string;
}

const MAX_BACKOFF_MS = 8_000;
const STEP_DELAY_MS = 650; // Demo: visual pacing

function backoffDelayMs(baseMs: number, attempt: number): number {
  return Math.min(MAX_BACKOFF_MS, baseMs * 2 ** (attempt - 1));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeWrite(
  writer: WritableStreamDefaultWriter<RetryEvent>,
  event: RetryEvent
): Promise<void> {
  try {
    await writer.write(event);
  } catch {
    // Best-effort streaming; step logic should continue on stream errors.
  }
}

export async function retryBackoffContactSync(
  contactId: string,
  maxAttempts: number = 5,
  baseDelayMs: number = 1_000,
  failuresBeforeSuccess: number = 2
): Promise<ContactSyncResult> {
  "use workflow";

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const nextSleepMs =
      attempt < maxAttempts ? backoffDelayMs(baseDelayMs, attempt) : 0;

    try {
      await syncContactToCrm(
        contactId,
        attempt,
        failuresBeforeSuccess,
        nextSleepMs
      );
      return { contactId, status: "completed", attempts: attempt };
    } catch (error) {
      const lastError =
        error instanceof Error ? error.message : String(error);

      if (attempt >= maxAttempts) {
        return {
          contactId,
          status: "failed",
          attempts: attempt,
          lastError,
        };
      }

      await sleep(`${nextSleepMs}ms`);
    }
  }

  return { contactId, status: "failed", attempts: maxAttempts };
}

async function syncContactToCrm(
  contactId: string,
  attempt: number,
  failuresBeforeSuccess: number,
  nextSleepMs: number
): Promise<void> {
  "use step";

  const writer = getWritable<RetryEvent>().getWriter();

  try {
    await safeWrite(writer, { type: "attempt_start", attempt, contactId });
    await delay(STEP_DELAY_MS); // Demo: simulate network latency

    if (attempt <= failuresBeforeSuccess) {
      const error = "CRM API returned HTTP 503 Service Unavailable";
      await safeWrite(writer, {
        type: "attempt_fail",
        attempt,
        error,
        sleepMs: nextSleepMs,
      });
      throw new FatalError(error);
    }

    await safeWrite(writer, { type: "attempt_success", attempt, contactId });
  } finally {
    writer.releaseLock();
  }
}

syncContactToCrm.maxRetries = 0;
