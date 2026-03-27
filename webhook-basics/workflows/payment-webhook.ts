import { createWebhook, getWritable, type RequestWithResponse } from "workflow";

export type WebhookEvent =
  | { type: "webhook_ready"; token: string }
  | { type: "event_received"; eventType: string; amount?: number }
  | { type: "response_sent"; eventType: string; action: string }
  | { type: "done"; status: "settled"; ledgerSize: number };

const MAX_EVENTS = 50;

export async function paymentWebhook(orderId: string) {
  "use workflow";

  const webhook = createWebhook({
    respondWith: "manual",
  });

  await emit<WebhookEvent>({ type: "webhook_ready", token: webhook.token });

  const ledger: { type: string; amount?: number; processedAt: string }[] = [];

  for await (const request of webhook) {
    const entry = await processPaymentEvent(request);
    ledger.push(entry);
    if (entry.type === "refund.created" || entry.type === "order.completed") break;
    if (ledger.length >= MAX_EVENTS) break;
  }

  await emit<WebhookEvent>({ type: "done", status: "settled", ledgerSize: ledger.length });

  return { orderId, webhookUrl: webhook.url, ledger, status: "settled" as const };
}

/**
 * Step: Emit a single event to the UI stream.
 * Re-acquires the writer inside the step so it survives durable suspension.
 */
async function emit<T>(event: T): Promise<void> {
  "use step";
  const writer = getWritable<T>().getWriter();
  try {
    await writer.write(event);
  } finally {
    writer.releaseLock();
  }
}

async function processPaymentEvent(
  request: RequestWithResponse
) {
  "use step";

  const writer = getWritable<WebhookEvent>().getWriter();

  try {
    const body = await request.json().catch(() => ({}));
    const type = body?.type ?? "unknown";
    const amount = typeof body?.amount === "number" ? body.amount : undefined;

    await writer.write({ type: "event_received", eventType: type, amount });

    let action = "ignored";

    if (type === "payment.created") {
      action = "received";
      await request.respondWith(Response.json({ ack: true, action }));
    } else if (type === "payment.requires_action") {
      action = "awaiting customer";
      await request.respondWith(Response.json({ ack: true, action }));
    } else if (type === "payment.succeeded") {
      action = "captured";
      await request.respondWith(Response.json({ ack: true, action }));
    } else if (type === "payment.failed") {
      action = "flagged for review";
      await request.respondWith(Response.json({ ack: true, action }));
    } else if (type === "refund.created") {
      action = "refunded";
      await request.respondWith(Response.json({ ack: true, action }));
    } else {
      await request.respondWith(Response.json({ ack: true, action }));
    }

    await writer.write({ type: "response_sent", eventType: type, action });

    return { type, amount, processedAt: new Date().toISOString() };
  } finally {
    writer.releaseLock();
  }
}
