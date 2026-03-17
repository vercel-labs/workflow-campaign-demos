---
slug: competing-consumers
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-competing-consumers
primitive: durable execution with automatic deduplication
pick: null
---

# Competing Consumers — Shared Queue Processing

Multiple workflow instances compete to process items from a shared queue, with only one consumer winning each item.

## Variant A — "Two workers, one message"

Three workers poll the same queue. A message arrives. Two workers grab it simultaneously. One processes it. The other needs to back off without duplicating work.

The usual fix is distributed locking, message visibility timeouts, consumer group management, and poison pill handling for messages that keep failing.

With deterministic workflow IDs, each queue item maps to a workflow run via `start()` with an `id` like `process-item-${item.id}`. Duplicate starts for the same ID are no-ops, deduplicated by the runtime.

<!-- split -->

Same item ID means same workflow run. If two consumers try to start a run for the same item, only one executes. The runtime handles the deduplication at the execution level, not the application level.

Failed items retry automatically from the last successful step. No reprocessing of completed work. No poison pill queue needed.

<!-- split -->

No distributed locks. No visibility timeouts. No consumer group rebalancing. No broker infrastructure. Items arrive, workflows run, duplicates are eliminated by the runtime.

Explore the interactive demo on v0: {v0_link}

## Variant B — "The deduplication is in the ID"

You could build a deduplication layer with Redis locks, visibility timeouts, and consumer group protocols. Or you could make the workflow ID deterministic.

`start()` with `id: process-item-${item.id}` means the same item always maps to the same workflow run. Call it once or call it ten times — the runtime creates one execution and ignores the rest.

<!-- split -->

No race condition between consumers. No lock acquisition. No timeout tuning. The runtime sees the same ID and resolves it to the same run. If the run is already complete, it returns the result. If it is still running, it attaches to the existing execution.

Failed steps retry from their checkpoint, not from the beginning. Completed steps are never re-executed.

<!-- split -->

No Redis. No Zookeeper. No consumer group rebalancing protocol. No visibility timeout configuration. Deterministic IDs give you exactly-once processing semantics from a simple `start()` call.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Scale consumers without coordination"

Adding more consumers usually means reconfiguring consumer groups, rebalancing partitions, and testing that your locking strategy still holds under higher concurrency.

With deterministic workflow IDs, scaling is just adding more callers. Every consumer calls `start()` with the item ID. The runtime deduplicates. No coordination protocol between consumers.

<!-- split -->

Ten consumers can all try to process the same item. Only one workflow run is created. The others get a no-op. No lock contention. No partition rebalancing. No visibility timeout races.

Each workflow run retries failed steps independently. One consumer crashing does not affect any other consumer's in-flight work.

<!-- split -->

No consumer group management. No partition assignment. No distributed lock service. No rebalancing downtime. Add consumers freely and let the runtime handle the rest.

Explore the interactive demo on v0: {v0_link}
