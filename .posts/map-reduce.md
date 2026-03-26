---
slug: map-reduce
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-map-reduce
primitive: Promise.all() + partitionInput()
pick: null
---

# Map-Reduce — Parallel Partition Processing

Partition input into chunks, process each chunk in parallel, and reduce the results into a single aggregate.

## Variant A — "Process in parallel, aggregate durably"

You have a large dataset. Processing it sequentially takes too long. Processing it all at once exceeds memory limits.

Partition the input into chunks, map each chunk in parallel with `Promise.all()`, and reduce into a final result. Each map step is a durable step that survives crashes.

<!-- split -->

`partitionInput()` splits the data into chunks. `Promise.all()` maps every chunk through `mapPartition()` in parallel. Each partition runs as its own durable step.

When all partitions complete, `reduceResults()` combines the partial results into a single aggregate — total sum, count, and average.

<!-- split -->

No orchestrator service. No manual partitioning. No coordination layer. Partition, map in parallel, reduce — three operations, all durable.

Explore the interactive demo on v0: {v0_link}

## Variant B — "What if a partition crashes mid-map?"

Three partitions are mapping in parallel. Partition 1 finishes. Partition 2 crashes. Partition 0 is still running.

The workflow resumes partition 2 from its last durable checkpoint. Partition 0 continues unaffected. Partition 1's result is already persisted. The reduce step waits for all three.

<!-- split -->

Each `mapPartition()` call is a separate durable step. `Promise.all()` coordinates them. A crash in one partition doesn't affect the others — the runtime resumes only the failed step.

When all partitions complete (including the recovered one), `reduceResults()` runs exactly once with the full set of partial results.

<!-- split -->

No retry logic in your code. No checkpointing library. No partition state management. The workflow runtime handles recovery, and `Promise.all()` handles coordination.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Scale by changing chunk size"

Same data, different chunk sizes. Chunk size 3 gives you 3 partitions running in parallel. Chunk size 1 gives you 9 partitions — maximum parallelism, more overhead. Chunk size 9 gives you 1 partition — no parallelism, minimal overhead.

The trade-off is yours to make. The workflow code doesn't change.

<!-- split -->

`partitionInput(items, chunkSize)` handles the split. `Promise.all()` maps the partitions regardless of how many there are. `reduceResults()` combines whatever comes back.

Change the chunk size parameter and the parallelism changes with it. The workflow structure — partition, map, reduce — stays identical.

<!-- split -->

No configuration files. No deployment changes. No infrastructure scaling. One parameter controls the parallelism, and the durable runtime handles the rest.

Explore the interactive demo on v0: {v0_link}
