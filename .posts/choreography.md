---
slug: choreography
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-choreography
primitive: FatalError for compensation + sleep() for handoff delays
pick: null
---

# Choreography — Multi-Participant Order Flow

Orchestrate an order through inventory, payment, and shipping, with event-driven handoffs and compensating transactions when a participant fails.

## Variant A — "Payment declines after inventory is reserved"

Order placed. Inventory reserved. Payment declines. Now you need to release the inventory, notify the customer, and log the failure — in the right order.

Each participant is a durable step. When a later step throws `FatalError`, compensations run in reverse automatically.

<!-- split -->

`sleep()` between steps simulates real-world handoff latency between services. Each compensation is itself a durable step, so crashing mid-rollback means the unwinding resumes exactly where it left off.

Payment fails after inventory was reserved? The workflow releases inventory, then cancels the order. Shipping fails? It refunds the charge, releases inventory, then cancels the order. The reverse ordering is explicit in the code.

<!-- split -->

No event bus. No saga table. No rollback microservices. Four participants, one workflow file, and compensating transactions that actually survive crashes.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Crash mid-rollback"

The scariest moment in a distributed order flow is not when payment fails. It is when the compensation to release inventory also crashes halfway through.

Each compensation is its own durable step. If the workflow dies while unwinding, it resumes the rollback from the exact step that was interrupted.

<!-- split -->

`FatalError` triggers the compensation chain. Each undo action — refund payment, release inventory, cancel order — is a checkpointed step. The workflow tracks which compensations have completed and which remain.

`sleep()` between compensations models real handoff latency. A crash during that sleep resumes when the durable timer fires, not from the beginning.

<!-- split -->

No manual rollback tracking. No compensation state table. No idempotency keys to manage yourself. The workflow engine remembers where it was, even mid-undo.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Four services, one file"

Inventory service. Payment gateway. Shipping provider. Notification system. Four participants that need to coordinate, and each one can fail independently.

A `for` loop of durable steps walks forward through participants. A `FatalError` at any point triggers the reverse walk through compensations.

<!-- split -->

Each participant is a `"use step"` boundary. Forward steps execute in order with `sleep()` modeling real handoff delays. When a step throws `FatalError`, the workflow iterates backward through completed participants, running each compensation as its own durable step.

The compensation order is explicit — last committed participant undoes first.

<!-- split -->

No event bus connecting services. No saga orchestrator table. No distributed transaction coordinator. One workflow file with forward steps and their matching compensations.

Explore the interactive demo on v0: {v0_link}
