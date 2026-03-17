---
slug: status-poller
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-status-poller
primitive: sleep() in a loop + timeout
pick: null
---

# Status Poller — Transcoding Job Monitor

Poll a transcoding job status repeatedly until ready, sleeping between polls, with a max-poll safety valve.

## Variant A — "The polling loop that survives restarts"

You upload a video. The transcoding service says "processing." You need to check back every 10 seconds until it's done, but not forever. Traditional polling means state in a database, a background worker to resume polls, and a TTL to garbage-collect stale entries.

`sleep()` in a loop with a counter gives you durable polling. Each poll is a `"use step"`. Each pause survives restarts.

<!-- split -->

Deploy mid-poll? The workflow resumes at the exact iteration it was on. Poll 14 of 30? It wakes up and runs poll 15. The counter caps iterations so runaway pollers are impossible.

When the status comes back "ready," the loop breaks. If it hits max polls, the workflow returns a timeout result. Either way, you know.

<!-- split -->

No poll table. No background worker. No dead-letter queue. No client-side `setInterval`. Durable polling in a for-loop.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Poll 14 of 30, then the server restarts"

You're on poll 14. The server restarts. Traditional systems lose the poll count, the last status, and the timing. You need a database row tracking iteration number, last poll time, and a background job to resume.

Durable replay makes the loop itself the checkpoint. Each poll is a `"use step"`. Each `sleep()` between polls persists. Restart and the workflow replays polls 1–14 from the log, then continues at 15.

<!-- split -->

The replay is instant — no actual API calls for completed polls. The `sleep()` between polls is durable too. Crash during a 10-second pause and it resumes with the remaining time.

Max poll count is the safety valve. Hit 30 polls without a "ready" response? The loop exits and the workflow returns a timeout. No runaway pollers, no TTL cleanup.

<!-- split -->

No poll tracking table. No iteration counter in Redis. No resume-from-last-poll logic. A for-loop, durable steps, durable sleeps, and a max counter.

Explore the interactive demo on v0: {v0_link}

## Variant C — "setInterval can't survive a deploy"

Client-side polling with `setInterval` dies when the tab closes. Server-side polling with a background worker dies when the process restarts. Both need external state to recover.

`sleep()` in a durable loop is polling that survives everything. Each iteration is a step. Each pause persists. The loop counter is the timeout.

<!-- split -->

Every 10 seconds, the workflow wakes up and checks the transcoding status. "Processing"? Sleep and poll again. "Ready"? Break the loop and proceed. Hit max iterations? Return a timeout result.

Redeploy, restart, crash — the workflow replays completed iterations in milliseconds and picks up at the next poll. No state reconstruction. No missed polls.

<!-- split -->

No `setInterval`. No background worker. No poll state database. No cron-based retry. A for-loop with `sleep()` that happens to be indestructible.

Explore the interactive demo on v0: {v0_link}
