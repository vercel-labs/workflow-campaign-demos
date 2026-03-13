---
slug: status-poller
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-status-poller
primitive: sleep() in a loop + timeout
pick: null
---

# Status Poller — Transcoding Job Monitor

Poll a transcoding job status repeatedly until ready, sleeping between polls, with a max-poll safety valve.

## Variant A — "The waiting game"


You upload a video. The transcoding service says "processing." You need to check back every 10 seconds until it's done, but not forever.

Traditional: a polling loop in the client, poll state in a database, and an external timeout to kill runaway pollers.

With WDK it's a while-loop with `sleep()`:

```ts
import { sleep } from "workflow";

export async function pollTranscodeStatus(jobId: string, maxPolls = 8, intervalMs = 1000) {
  "use workflow";

  for (let poll = 1; poll <= maxPolls; poll++) {
    const state = await checkTranscodeJob(jobId, poll);

    if (state === "ready") {
      return { jobId, status: "completed", pollCount: poll };
    }

    if (poll < maxPolls) {
      await sleep(`${intervalMs}ms`);
    }
  }

  return { jobId, status: "timeout", pollCount: maxPolls };
}
```

<!-- split -->

Each poll is a durable step. `sleep()` pauses between them. A counter enforces max polls. If the server restarts between polls, it picks up at the right iteration.

No poll state in your DB. No client-side setInterval. No external timeout service.

<!-- split -->

Poll. Sleep 10s. Poll again. 30 max attempts. Done or timed out. Either way, you know.

One workflow. One file. Durable polling without infrastructure.

Explore the interactive demo on v0: {v0_link}

## Variant B — "setInterval doesn't survive deploys"

You wrote a poller with setInterval. It worked until the next deploy killed the process. Now you need to track which polls are in-flight, which timed out, and which need restarting.

Traditional: poll records in a database, a background worker to resume them, and a TTL to garbage-collect stale entries.

WDK polling survives restarts by default:

```ts
import { sleep } from "workflow";

export async function pollTranscodeStatus(jobId: string, maxPolls = 8, intervalMs = 1000) {
  "use workflow";

  for (let poll = 1; poll <= maxPolls; poll++) {
    const state = await checkTranscodeJob(jobId, poll);

    if (state === "ready") {
      return { jobId, status: "completed", pollCount: poll };
    }

    if (poll < maxPolls) {
      await sleep(`${intervalMs}ms`);
    }
  }

  return { jobId, status: "timeout", pollCount: maxPolls };
}
```

<!-- split -->

`sleep()` is durable. When the process comes back, the workflow resumes at the exact sleep it was on. Poll 14 of 30? It wakes up and runs poll 15.

No database records. No resume logic. The runtime handles it.

<!-- split -->

Upload → poll every 10s → max 30 attempts → resolve with status.

The whole thing is a loop. The durability is free.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Polling without the poll table"

Every polling system eventually grows a poll_jobs table. Then a worker to sweep it. Then a dead-letter queue for polls that exceeded max retries.

WDK needs none of that:

```ts
import { sleep } from "workflow";

export async function pollTranscodeStatus(jobId: string, maxPolls = 8, intervalMs = 1000) {
  "use workflow";

  for (let poll = 1; poll <= maxPolls; poll++) {
    const state = await checkTranscodeJob(jobId, poll);

    if (state === "ready") {
      return { jobId, status: "completed", pollCount: poll };
    }

    if (poll < maxPolls) {
      await sleep(`${intervalMs}ms`);
    }
  }

  return { jobId, status: "timeout", pollCount: maxPolls };
}
```

<!-- split -->

A while-loop checks status. `sleep()` waits between checks. A counter caps the iterations. Every step persists automatically. No table, no worker, no sweep.

If the status comes back "complete," the loop breaks. If it hits max polls, the workflow returns a timeout result.

<!-- split -->

Durable polling in 20 lines. No poll table. No background worker. No dead-letter queue.

Explore the interactive demo on v0: {v0_link}
