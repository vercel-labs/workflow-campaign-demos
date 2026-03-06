import { RetryableError, getStepMetadata, getWritable } from "workflow";

export type RateLimitEvent =
  | {
      type: "attempt_start";
      attempt: number;
      contactId: string;
      idempotencyKey: string;
    }
  | { type: "http_429"; attempt: number; retryAfterMs: number }
  | { type: "retry_scheduled"; attempt: number; retryAfterMs: number }
  | { type: "step_done"; step: "fetch" | "upsert"; attempt: number }
  | {
      type: "done";
      contactId: string;
      status: "synced";
      totalAttempts: number;
    };

export type SyncResult = {
  contactId: string;
  status: "synced" | "failed";
  attempts?: number;
};

export async function syncCrmContact(
  contactId: string,
  failuresBeforeSuccess: number = 2
): Promise<SyncResult> {
  "use workflow";

  const contact = await fetchContactFromCrm(contactId, failuresBeforeSuccess);
  await upsertIntoWarehouse(contactId, contact);

  return { contactId, status: "synced" };
}

async function fetchContactFromCrm(
  contactId: string,
  failuresBeforeSuccess: number
) {
  "use step";

  const { stepId, attempt } = getStepMetadata();
  const writer = getWritable<RateLimitEvent>().getWriter();
  const idempotencyKey = `crm-sync:${contactId}:${stepId}`;

  try {
    await writer.write({
      type: "attempt_start",
      attempt,
      contactId,
      idempotencyKey,
    });

    // Simulate CRM API latency
    await new Promise((r) => setTimeout(r, 650));

    if (attempt <= failuresBeforeSuccess) {
      const retryAfterMs =
        attempt === 1 ? 2000 : attempt === 2 ? 1500 : 1000;

      await writer.write({ type: "http_429", attempt, retryAfterMs });
      await writer.write({ type: "retry_scheduled", attempt, retryAfterMs });

      throw new RetryableError("CRM rate-limited (429)", {
        retryAfter: retryAfterMs,
      });
    }

    await writer.write({ type: "step_done", step: "fetch", attempt });
    return { id: contactId, name: "Jane Doe", email: "jane@example.com" };
  } finally {
    writer.releaseLock();
  }
}

async function upsertIntoWarehouse(contactId: string, contact: unknown) {
  "use step";

  const { attempt } = getStepMetadata();
  const writer = getWritable<RateLimitEvent>().getWriter();

  try {
    // Simulate warehouse write latency
    await new Promise((r) => setTimeout(r, 600));

    await writer.write({ type: "step_done", step: "upsert", attempt });
    await writer.write({
      type: "done",
      contactId,
      status: "synced",
      totalAttempts: attempt,
    });
  } finally {
    writer.releaseLock();
  }

  void contact;
}
