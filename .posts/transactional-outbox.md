---
slug: transactional-outbox
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-transactional-outbox
primitive: multi-step sequence with durable checkpoints
pick: null
---

# Transactional Outbox — Reliable Message Delivery

Persist an outbox record, relay it to a message broker, and confirm delivery, ensuring at-least-once semantics without dual-write bugs.

## Variant A — "The dual-write trap"


You save to the database. Then you publish to the broker. The broker call fails. Now your DB has a record that was never delivered.

Traditional: an outbox table in the same DB, a polling worker to relay undelivered records, and a confirmation step to mark them sent.

With WDK each operation is a durable step:

```ts
export async function transactionalOutbox(orderId: string, payload: string) {
  "use workflow";

  const { outboxId } = await persistOrder(orderId, payload);
  const { brokerId } = await pollRelay(outboxId);
  await publishEvent(outboxId, brokerId);
  return markSent(orderId, outboxId, brokerId);
}
```

<!-- split -->

Step 1 persists the record. Step 2 relays to the broker. Step 3 confirms delivery. If step 2 fails, the workflow retries it. The record from step 1 is already committed.

No outbox table. No polling worker. The durability is built into the step boundary.

<!-- split -->

Persist. Relay. Confirm. At-least-once delivery without a separate outbox infrastructure.

One workflow. Three steps. No dual-write bugs.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Why the outbox pattern exists"

The outbox pattern exists because you can't atomically write to a database and a message broker in one transaction.

So you write to an outbox table instead, and a background worker picks it up. That worker needs idempotency keys, delivery tracking, and failure handling.

WDK replaces the worker with durable steps:

```ts
export async function transactionalOutbox(orderId: string, payload: string) {
  "use workflow";

  const { outboxId } = await persistOrder(orderId, payload);
  const { brokerId } = await pollRelay(outboxId);
  await publishEvent(outboxId, brokerId);
  return markSent(orderId, outboxId, brokerId);
}
```

<!-- split -->

Each step is an atomic checkpoint. If the relay step fails, the workflow retries from that step, not from scratch. The persist step doesn't re-execute.

No polling interval. No delivery tracking table. No idempotency layer on top.

<!-- split -->

At-least-once semantics from durable execution. The outbox pattern without the outbox.

Explore the interactive demo on v0: {v0_link}

## Variant C — "At-least-once without the infrastructure"

At-least-once delivery usually means: outbox table, relay worker, confirmation flag, dead-letter queue, and a monitoring dashboard to watch it all.

WDK collapses that to a step sequence:

```ts
export async function transactionalOutbox(orderId: string, payload: string) {
  "use workflow";

  const { outboxId } = await persistOrder(orderId, payload);
  const { brokerId } = await pollRelay(outboxId);
  await publishEvent(outboxId, brokerId);
  return markSent(orderId, outboxId, brokerId);
}
```

<!-- split -->

Write the record. Send to the broker. Confirm delivery. Each step checkpoints automatically. Failure at any point resumes from the last successful step.

No relay worker. No confirmation flags. No dead-letter queue. The runtime guarantees progress.

<!-- split -->

Three steps. At-least-once delivery. Zero extra infrastructure.

Explore the interactive demo on v0: {v0_link}
