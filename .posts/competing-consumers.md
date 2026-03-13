---
slug: competing-consumers
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-competing-consumers
primitive: durable execution with automatic deduplication
pick: null
---

# Competing Consumers — Shared Queue Processing

Multiple workflow instances compete to process items from a shared queue, with only one consumer winning each item.

## Variant A — "Two workers, one job"


Three workers poll the same queue. A message arrives. Two workers grab it simultaneously. One processes it. The other needs to back off without duplicating work.

Traditional: distributed locking, message visibility timeouts, consumer group management, and poison pill handling for messages that keep failing.

With WDK each item is a workflow run with a deterministic ID:

```ts
import { start } from "workflow/api";

// Each queue item maps to a deterministic workflow run ID.
// Duplicate starts for the same ID are no-ops.
async function consumeItem(item: QueueItem) {
  await start({
    id: `process-item-${item.id}`, // deterministic — deduped by runtime
    fn: processItem,
    args: [item],
  });
}

async function processItem(item: QueueItem) {
  "use workflow";

  await validateItem(item);
  await enrichItem(item);
  await storeResult(item);
}
```

<!-- split -->

Same item ID means same workflow run. If two consumers try to start a run for the same item, only one executes. The other is a no-op, deduplicated by the runtime.

No distributed locks. No visibility timeouts. No consumer group coordination. The deduplication is the execution model.

<!-- split -->

Queue fills up. Consumers race. Each item processes exactly once. Failed items retry automatically. No poison pill queue needed.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Exactly-once without distributed locks"

Distributed locks are fragile. Lock expires too early? Duplicate processing. Lock holder crashes? Stuck messages. You end up building a lock manager for the lock manager.

WDK sidesteps locking entirely:

```ts
import { start } from "workflow/api";

// Each queue item maps to a deterministic workflow run ID.
// Duplicate starts for the same ID are no-ops.
async function consumeItem(item: QueueItem) {
  await start({
    id: `process-item-${item.id}`, // deterministic — deduped by runtime
    fn: processItem,
    args: [item],
  });
}

async function processItem(item: QueueItem) {
  "use workflow";

  await validateItem(item);
  await enrichItem(item);
  await storeResult(item);
}
```

<!-- split -->

Each queue item maps to a workflow run ID. The runtime ensures one execution per ID. Concurrent attempts to start the same run are safely deduplicated. No lock, no race.

If a run fails, it retries from the last successful step. Not from scratch. No reprocessing of completed work.

<!-- split -->

No distributed locks. No visibility timeouts. No consumer group rebalancing. No poison pill handling.

One item, one run, one result. The runtime guarantees it.

Explore the interactive demo on v0: {v0_link}

## Variant C — "The queue without the queue infrastructure"

Traditional competing consumers need: a broker with consumer groups, visibility timeouts, dead-letter queues, and monitoring for stuck messages.

WDK replaces the pattern with durable workflow runs:

```ts
import { start } from "workflow/api";

// Each queue item maps to a deterministic workflow run ID.
// Duplicate starts for the same ID are no-ops.
async function consumeItem(item: QueueItem) {
  await start({
    id: `process-item-${item.id}`, // deterministic — deduped by runtime
    fn: processItem,
    args: [item],
  });
}

async function processItem(item: QueueItem) {
  "use workflow";

  await validateItem(item);
  await enrichItem(item);
  await storeResult(item);
}
```

<!-- split -->

Each item triggers a workflow run with a deterministic ID. Multiple triggers for the same ID collapse into one execution. Each step checkpoints, so failures resume mid-workflow, not from the beginning.

No broker. No consumer groups. No visibility timeout tuning. No dead-letter queue.

<!-- split -->

Items arrive. Workflows run. Duplicates are eliminated by the runtime. Failures retry from the last checkpoint.

Competing consumers without the competition.

Explore the interactive demo on v0: {v0_link}
