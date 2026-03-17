---
slug: approval-chain
day: null
v0_url: https://v0.app/chat/X3M2W5yZP1O
primitive: Promise.race() + defineHook() + sleep()
pick: null
---

# Approval Chain — Multi-Level Approval with Timeouts

Route approval through multiple levels, manager, director, VP, with per-level timeouts that escalate automatically.

## Variant A — "A race between a human and a clock"

A purchase order needs manager, director, and VP sign-off. Each level gets 24 hours before it escalates.

`defineHook()` creates an approval endpoint per level. `Promise.race()` pits the approval against `sleep("24h")`.

<!-- split -->

Approval arrives? Next level. Timeout wins? Auto-escalate. Each transition is durable — crash mid-chain and it resumes at the right level.

`sleep("24h")` is a real 24h pause, zero compute. `defineHook()` lets the human respond whenever. First one wins.

<!-- split -->

No state machine table. No polling worker. No webhook retry logic. No cron to check expiry. Each level is a race between a human and a clock, all in one file.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Escalation that costs nothing while it waits"

Director hasn't responded. Wait 24h, then escalate to VP. Usually that means a worker polling the clock and a DB row tracking the deadline.

`sleep("24h")` pauses 24 hours using zero compute. When it wakes, the next step escalates. The workflow was off the entire time.

<!-- split -->

`Promise.race()` between `defineHook()` and `sleep()` at each level. Hook creates the approval URL, sleep sets the deadline. First to resolve wins.

Loop through levels: manager approves → director. Director times out → VP. Each transition is a durable step.

<!-- split -->

No cron jobs polling for expired approvals. No background workers burning compute while humans think. No deadline tracking table. The sleep is the deadline, and it costs nothing until it fires.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Three approvers, one file, zero infrastructure"

Manager → director → VP. Each gets a unique approval URL and a timeout. Rejection at any level stops the chain.

`defineHook()` generates the URL. `sleep()` sets the deadline. `Promise.race()` picks the winner. Loop through levels and it builds itself.

<!-- split -->

Each level: create a hook, race it against a sleep, check the result. Approved → continue. Rejected or timed out → exit early.

Crash between director approval and VP notification? Workflow resumes at the VP step. Earlier approvals are already checkpointed.

<!-- split -->

No webhook endpoint configuration. No timeout scheduler. No approval state table. Three levels of approval in a loop, each a race between a human action and a durable timer.

Explore the interactive demo on v0: {v0_link}
