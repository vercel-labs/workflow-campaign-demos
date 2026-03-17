---
slug: transactional-outbox
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-transactional-outbox
primitive: multi-step sequence with durable checkpoints
pick: null
---

# Transactional Outbox — Reliable Message Delivery

Persist an outbox record, relay it to a message broker, and confirm delivery, ensuring at-least-once semantics without dual-write bugs.

## Variant A — "The dual-write trap"

You save to the database. Then you publish to the broker. The broker call fails. Now your database has a record that was never delivered.

The traditional fix is an outbox table in the same database, a polling worker to relay undelivered records, and a confirmation step to mark them sent. That means idempotency keys, delivery tracking, and failure handling on top.

With durable steps, each operation is a checkpoint. `persistOrder` commits the record. `pollRelay` sends it to the broker. `publishEvent` and `markSent` confirm delivery.

<!-- split -->

If the relay step fails, the workflow retries from that step, not from scratch. The persist step does not re-execute. Each `"use step"` boundary is an automatic checkpoint that the runtime manages.

No outbox table. No polling interval. No delivery tracking table. No idempotency layer bolted on top. The durability is built into the step boundary.

<!-- split -->

Three durable steps give you at-least-once delivery without a separate outbox infrastructure. Persist. Relay. Confirm. No dual-write bugs. No relay worker. No dead-letter queue.

Explore the interactive demo on v0: {v0_link}

## Variant B — "What if the broker is down?"

Database write succeeds. Broker publish fails. Now you have a committed record with no corresponding event. Customers see the order but downstream services never hear about it.

Polling workers and outbox tables exist to solve this, but they introduce their own failure modes: stale polls, duplicate relays, and orphaned delivery records.

Durable step boundaries make each operation a checkpoint. `persistOrder` runs once and is never repeated. If `pollRelay` fails, the workflow retries from that exact step, not from the beginning.

<!-- split -->

The runtime knows which steps completed. A restart after a broker failure skips the persist step entirely and goes straight to relay. No duplicate database writes. No idempotency keys on the application side.

`publishEvent` confirms the broker received the message. `markSent` updates the record. Each step is atomic from the workflow's perspective.

<!-- split -->

No outbox table polling every 5 seconds. No delivery tracking service. No dual-write coordination logic. Durable checkpoints turn a fragile multi-service dance into a sequential workflow that retries from exactly the right place.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Persist, relay, confirm — nothing else"

The transactional outbox pattern usually means three new pieces of infrastructure: an outbox table, a relay worker, and a delivery tracker. Each one has its own failure modes, monitoring, and deployment pipeline.

Durable steps collapse all three into sequential checkpoint boundaries. `persistOrder` commits the record. `pollRelay` forwards it. `publishEvent` and `markSent` close the loop. Each step runs exactly once on success and retries only itself on failure.

<!-- split -->

The checkpoint boundary is the outbox. When `persistOrder` completes, its result is durable. The workflow will never re-execute it, even after a crash. The relay step picks up from its own boundary, not from the beginning of the workflow.

This eliminates the classic dual-write bug at the architecture level, not through application-level idempotency checks.

<!-- split -->

No outbox table. No polling worker. No delivery tracking database. No idempotency middleware. Three steps, three checkpoints, at-least-once delivery guaranteed by the runtime.

Explore the interactive demo on v0: {v0_link}
