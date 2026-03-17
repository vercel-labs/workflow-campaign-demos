---
slug: scheduled-digest
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-scheduled-digest
primitive: defineHook() + Promise.race() + sleep()
pick: null
---

# Scheduled Digest — Time-Windowed Event Collection

Open a time window, collect events via webhook during the window, then email a digest when the window closes.

## Variant A — "Replace the cron job and the queue"

Open a one-hour window. Events trickle in via webhook — 3, 10, maybe 50. When the hour ends, bundle them into one email digest.

Three primitives make this work: `defineHook()` to receive events, `sleep()` to set the deadline, and `Promise.race()` to process events while the timer ticks.

<!-- split -->

`defineHook()` keeps the door open for incoming webhooks. `Promise.race()` lets the workflow handle each event as it arrives while `sleep("1h")` counts down in the background.

When the sleep resolves, the window closes. The workflow aggregates everything that arrived and sends the digest. Crash mid-window? It resumes with all previously collected events intact.

<!-- split -->

No event queue. No aggregation service. No cron job. One workflow that collects, waits, and sends — and the workflow itself is the buffer.

Explore the interactive demo on v0: {v0_link}

## Variant B — "The workflow is the buffer"

Most digest systems need three pieces: a queue to buffer events, a cron job to trigger processing, and a service to aggregate and send. That is three things to deploy, monitor, and keep in sync.

A single workflow replaces all three. `defineHook()` is the ingestion point. Durable state is the buffer. `sleep()` is the timer.

<!-- split -->

Events arrive via webhook and accumulate in the workflow's durable state. `Promise.race()` processes each event as it lands while `sleep()` counts down the collection window.

When the timer fires, the workflow reads everything it collected and sends the digest. If the process crashes mid-window, the collected events survive and the timer resumes from where it left off.

<!-- split -->

No external queue to drain. No cron scheduler to configure. No aggregation lambda to deploy. The workflow is the queue, the timer, and the processor.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Crash-safe event collection"

Your digest collects events for an hour. At minute 47, the process crashes. When it restarts, are the first 47 minutes of events gone?

With durable workflow state, every event that arrived via `defineHook()` is persisted the moment it is processed. The `sleep()` deadline is also durable — it remembers how much time remains.

<!-- split -->

`Promise.race()` handles the interleaving: process incoming hook events while the sleep counts down. Each event is recorded in a durable step, so a crash cannot lose collected data.

When the workflow resumes, it has every event from before the crash plus any new ones that arrived while it was down. The sleep fires on its original schedule.

<!-- split -->

No write-ahead log. No checkpoint service. No recovery procedure. The workflow's durable state is the checkpoint, and the sleep is the alarm clock that survives restarts.

Explore the interactive demo on v0: {v0_link}
