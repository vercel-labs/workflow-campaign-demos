---
slug: batch-processor
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-batch-processor
primitive: durable replay + sleep()
pick: null
---

# Batch Processor — Crash-Proof Batch Processing

Process a large dataset in batches with automatic resume from the last completed batch after a crash.

## Variant A — "Pick up where you left off"


You're processing 10,000 records in batches of 100. Batch 47 crashes. Do you start over?

Traditional: a checkpoint database, crash detection logic, and recovery queries to find the last successful batch.

With WDK, durable replay handles it:

```ts
async function batchProcessor(total = 10_000, batchSize = 1_000) {
  "use workflow";

  const totalBatches = Math.ceil(total / batchSize);

  for (let batch = 1; batch <= totalBatches; batch++) {
    const start = (batch - 1) * batchSize + 1;
    const end = Math.min(total, batch * batchSize);

    await processBatch(batch, start, end); // "use step" — durable
  }

  return { total, batchSize, status: "done" };
}
```

<!-- split -->

Each batch is a `"use step"`. The runtime records completions. Crash on batch 47? The workflow restarts and replays steps 1-46 instantly from the log, then resumes at 47.

No checkpoint table. No recovery query. The durability is built into the execution model.

<!-- split -->

No checkpoint database. No crash detection. No recovery logic. Process, crash, resume. Automatically.

Explore the interactive demo on v0: {v0_link}

## Variant B — "The checkpoint problem"

Every batch job needs checkpointing. Where did I stop? What's left? How do I avoid reprocessing?

Traditional batch frameworks make you manage this: a `last_processed_id` column, a status table, a startup query.

WDK checkpoints every step automatically:

```ts
async function batchProcessor(total = 10_000, batchSize = 1_000) {
  "use workflow";

  const totalBatches = Math.ceil(total / batchSize);

  for (let batch = 1; batch <= totalBatches; batch++) {
    const start = (batch - 1) * batchSize + 1;
    const end = Math.min(total, batch * batchSize);

    await processBatch(batch, start, end); // "use step" — durable
  }

  return { total, batchSize, status: "done" };
}
```

<!-- split -->

Each `"use step"` is a durable checkpoint. Completed steps replay from the log. No re-execution, no side effects repeated.

Add a `sleep()` between batches to avoid rate limits. The sleep is durable too. Crash mid-pause? It resumes with the remaining time.

<!-- split -->

No status table. No `last_processed_id`. No startup recovery. Batches flow through a loop and durability comes free.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Batches that survive anything"

Server restarts. Deploy mid-batch. OOM on record 4,700. Every batch system eventually hits these.

The question is whether you wrote the recovery logic or the framework handles it. Traditional: you write it. WDK: the runtime handles it.

Durable replay means completed steps are never re-executed:

```ts
async function batchProcessor(total = 10_000, batchSize = 1_000) {
  "use workflow";

  const totalBatches = Math.ceil(total / batchSize);

  for (let batch = 1; batch <= totalBatches; batch++) {
    const start = (batch - 1) * batchSize + 1;
    const end = Math.min(total, batch * batchSize);

    await processBatch(batch, start, end); // "use step" — durable
  }

  return { total, batchSize, status: "done" };
}
```

<!-- split -->

Process batch 1 → recorded. Batch 2 → recorded. Crash. Restart. Batches 1-2 replay from log. Batch 3 begins fresh.

`sleep()` between batches adds rate-limiting that also survives crashes. No timers to restore. No state to reconstruct.

<!-- split -->

No recovery code. No checkpoint queries. No idempotency keys for reprocessed batches. Process, crash, resume. Like nothing happened.

Explore the interactive demo on v0: {v0_link}
