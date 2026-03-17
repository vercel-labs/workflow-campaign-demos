---
slug: pipeline
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-pipeline
primitive: sequential step execution with progress events
pick: null
---

# Pipeline — 4-Stage ETL

Execute a 4-stage ETL pipeline (Extract, Transform, Validate, Load) sequentially with progress updates streamed to the client after each stage.

## Variant A — "Know which stage you're on"

Extract. Transform. Validate. Load. Four stages in strict order, and you need to know which stage you're on.

Traditionally that means a pipeline orchestrator, a job state table, and a polling UI to track progress.

With `"use step"`, each stage runs to completion before the next begins. Progress events stream to the client via `getWritable()`.

<!-- split -->

If the workflow crashes after Transform, it resumes at Validate, not from the beginning. Each completed step is checkpointed automatically.

The client sees progress events for each stage as they complete. Real-time visibility with zero extra code. No polling. No job status table.

<!-- split -->

No orchestrator. No dependency graph. No state database. Four steps in a for-loop, durable and observable out of the box.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Crash after stage two, resume at stage three"

Your ETL pipeline processes a million records. It crashes after Transform. Without checkpointing, you start over from Extract. With a job table, you need to query the last completed stage and wire up resume logic.

Durable steps checkpoint automatically. Each completed stage is recorded by the runtime. Restart the workflow and it skips straight to Validate.

<!-- split -->

`getWritable()` streams a progress event after each stage completes. The client knows you're on stage three without polling a database. The server knows where to resume without querying a job table.

Checkpointing and progress are the same mechanism. A completed step is both the resume point and the progress event.

<!-- split -->

No job status table. No resume logic. No "last completed stage" column. The runtime tracks what finished and skips it on restart. Four stages, automatic checkpoints, real-time progress.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Real-time pipeline progress without polling"

Your ETL runs for minutes. The user stares at a spinner. They refresh the page and lose track entirely. You build a polling endpoint, a job status table, and a progress column.

`getWritable()` pushes progress events to the client as each stage completes. No polling interval. No stale reads. The client renders pipeline progress the moment it happens.

<!-- split -->

Each stage is a step. Each step emits a progress event on completion via `getWritable()`. The client connects to the SSE stream and accumulates events. Four stages, four events, a real-time progress bar.

Refresh the page? Reconnect to the stream. The workflow is still running. Completed steps replay their events.

<!-- split -->

No polling endpoint. No progress column. No refresh-and-lose-state. The pipeline streams its own progress, and the UI is always current.

Explore the interactive demo on v0: {v0_link}
