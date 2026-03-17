---
slug: batch-processor
day: null
v0_url: https://v0.app/chat/veJkYzFjTZY
primitive: durable replay + sleep()
pick: null
---

# Batch Processor — Crash-Proof Batch Processing

Process a large dataset in batches with automatic resume from the last completed batch after a crash.

## Variant A — "The checkpoint table you don't need"

Processing 10k records. Batch 47 crashes. Now you need a checkpoint DB, crash detection, and recovery queries.

Durable replay handles it. Each batch is a `"use step"`. The runtime logs every completion.

<!-- split -->

Crash on batch 47? Restart replays steps 1–46 from the log, then resumes at 47. No re-execution, no repeated side effects.

Add `sleep()` between batches for rate limiting. It's durable too — crash mid-pause and it resumes with time remaining.

<!-- split -->

No checkpoint table. No `last_processed_id` column. No crash detection. No recovery queries. Process, crash, resume. Automatically.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Crash on batch 47. Resume at batch 47."

Batch crashes mean figuring out what ran, what didn't, what ran halfway. Idempotency keys, checkpoint tables, recovery scripts.

Durable replay kills all of it. Each batch is a `"use step"` logged on completion. Restart and steps 1–46 replay from the log.

<!-- split -->

No API calls, no DB writes during replay — just reading the log. Batch 47 picks up fresh.

Rate limiting? `sleep()` between steps is durable. Crash during a sleep and it resumes with time remaining.

<!-- split -->

No idempotency keys. No checkpoint database. No recovery scripts. No "did this batch already run?" queries. The log is the checkpoint, and replay is the recovery.

Explore the interactive demo on v0: {v0_link}

## Variant C — "10,000 records, zero recovery code"

Batch processing is easy. Crash recovery is where the complexity hides — checkpoint tables, dedup logic, recovery jobs.

Durable steps make the runtime the checkpoint. Each batch is a `"use step"`, each completion logged. Recovery is replay.

<!-- split -->

A loop where each iteration is a step. Crash anywhere — replay finishes in milliseconds, then resumes at the failed batch.

`sleep()` between batches for throttling. Also durable — crash mid-nap and it wakes with time remaining.

<!-- split -->

No checkpoint infrastructure. No recovery job. No crash detection heuristics. No manual restart procedures. A loop, durable steps, and the runtime handles the rest.

Explore the interactive demo on v0: {v0_link}
