import {
  createWebhook,
  getWritable,
  sleep,
  FatalError,
  type RequestWithResponse,
  type Webhook,
} from "workflow";

// ── Event types (discriminated union) ────────────────────────────────────

export type CallbackPayload =
  | { status: "approved"; details: string }
  | { status: "rejected"; reason: string };

export type AsyncReplyEvent =
  | { type: "submitted"; documentId: string; correlationId: string; webhookToken: string }
  | { type: "waiting"; correlationId: string; timeoutMs: number }
  | { type: "heartbeat"; elapsed: number; timeoutMs: number }
  | { type: "callback_received"; correlationId: string; payload: CallbackPayload }
  | { type: "duplicate_callback_ignored"; correlationId: string }
  | { type: "timed_out"; correlationId: string }
  | { type: "finalized"; outcome: "verified" | "rejected" | "timed_out"; details: string }
  | { type: "done"; outcome: "verified" | "rejected" | "timed_out" };

const TIMEOUT_MS = 30_000; // 30 seconds for demo
const HEARTBEAT_MS = 3_000; // heartbeat every 3 seconds

// ── Main workflow ────────────────────────────────────────────────────────

export async function asyncRequestReply(documentId: string) {
  "use workflow";

  const correlationId = `doc:${documentId}`;

  // Phase 1 — Submit verification and register webhook
  const webhook = createWebhook({ respondWith: "manual" });
  await submitVerification(documentId, correlationId, webhook.token);

  // Phase 2 — Wait for vendor callback or timeout
  const result = await awaitCallbackOrTimeout(correlationId, webhook);

  // Phase 3 — Finalize and emit done
  await finalizeResult(result);

  return { documentId, correlationId, outcome: result.outcome };
}

// ── Phase 1: Submit verification ─────────────────────────────────────────

async function submitVerification(
  documentId: string,
  correlationId: string,
  webhookToken: string
) {
  "use step";
  const writer = getWritable<AsyncReplyEvent>().getWriter();
  try {
    await writer.write({ type: "submitted", documentId, correlationId, webhookToken });
  } finally {
    writer.releaseLock();
  }
}

// ── Phase 2: Await callback or timeout ───────────────────────────────────

type WaitResult =
  | { outcome: "verified"; details: string }
  | { outcome: "rejected"; details: string }
  | { outcome: "timed_out"; details: string };

async function awaitCallbackOrTimeout(
  correlationId: string,
  webhook: Webhook<RequestWithResponse>
): Promise<WaitResult> {
  await emit({ type: "waiting", correlationId, timeoutMs: TIMEOUT_MS });

  // Shared flag so the losing branch stops emitting after the race settles
  let settled = false;

  const result = await Promise.race([
    // Branch A: listen for vendor callbacks via webhook
    (async (): Promise<WaitResult> => {
      let first = true;

      for await (const request of webhook) {
        const payload = await processCallback(request, correlationId, first);

        if (first) {
          first = false;
          settled = true;
          return payload.status === "approved"
            ? { outcome: "verified" as const, details: payload.details }
            : { outcome: "rejected" as const, details: payload.reason };
        }
        // After first callback, loop continues to catch duplicates
        // until the timeout branch wins the race
      }

      throw new FatalError("Webhook stream closed without receiving a callback");
    })(),

    // Branch B: heartbeat loop that eventually times out
    (async (): Promise<WaitResult> => {
      let elapsed = 0;
      while (elapsed < TIMEOUT_MS && !settled) {
        await sleep(new Date(Date.now() + HEARTBEAT_MS));
        elapsed += HEARTBEAT_MS;
        if (settled) break;
        if (elapsed < TIMEOUT_MS) {
          await emit({ type: "heartbeat", elapsed, timeoutMs: TIMEOUT_MS });
        }
      }
      if (settled) {
        return { outcome: "timed_out", details: "Cancelled — callback already received" };
      }
      settled = true;
      await emit({ type: "timed_out", correlationId });
      return { outcome: "timed_out", details: `No vendor response within ${TIMEOUT_MS / 1000}s` };
    })(),
  ]);

  return result;
}

// ── Step: process a single webhook callback ──────────────────────────────

async function processCallback(
  request: RequestWithResponse,
  correlationId: string,
  isFirst: boolean
): Promise<CallbackPayload> {
  "use step";

  const writer = getWritable<AsyncReplyEvent>().getWriter();

  try {
    const body = await request.json().catch(() => ({}));
    const payload = parseCallbackPayload(body);

    if (isFirst) {
      await request.respondWith(Response.json({ ack: true, status: payload.status }));
      await writer.write({ type: "callback_received", correlationId, payload });
    } else {
      await request.respondWith(
        Response.json({ ack: false, duplicate: true }, { status: 409 })
      );
      await writer.write({ type: "duplicate_callback_ignored", correlationId });
    }

    return payload;
  } finally {
    writer.releaseLock();
  }
}

// ── Phase 3: Finalize result ─────────────────────────────────────────────

async function finalizeResult(result: WaitResult) {
  "use step";
  const writer = getWritable<AsyncReplyEvent>().getWriter();
  try {
    await writer.write({
      type: "finalized",
      outcome: result.outcome,
      details: result.details,
    });
    await writer.write({ type: "done", outcome: result.outcome });
  } finally {
    writer.releaseLock();
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

function parseCallbackPayload(body: Record<string, unknown>): CallbackPayload {
  if (body?.status === "approved") {
    return {
      status: "approved",
      details: typeof body.details === "string" ? body.details : "Document verified",
    };
  }
  return {
    status: "rejected",
    reason: typeof body.reason === "string" ? body.reason : "Verification failed",
  };
}

/**
 * Step: Emit a single event to the UI stream.
 * Re-acquires the writer inside the step so it survives durable suspension.
 */
async function emit(event: AsyncReplyEvent): Promise<void> {
  "use step";
  const writer = getWritable<AsyncReplyEvent>().getWriter();
  try {
    await writer.write(event);
  } finally {
    writer.releaseLock();
  }
}
