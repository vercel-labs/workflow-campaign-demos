---
slug: wakeable-reminder
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-wakeable-reminder
primitive: defineHook() + Promise.race() + sleep()
pick: null
---

# Wakeable Reminder — Interruptible Scheduled Notification

Schedule a reminder for a future time, but allow cancel, snooze, or send-now before the timer fires, all via webhook.

## Variant A — "Wake up a sleeping workflow"

You schedule a reminder for 2 hours from now. Then the user wants to snooze it. Or cancel it. Or send it immediately.

Traditionally that means a cron table, a background scheduler, a webhook endpoint to intercept pending jobs, and a state machine to track transitions.

`Promise.race()` between `sleep()` and `defineHook()` handles all of it.

<!-- split -->

`sleep()` starts the countdown. `defineHook()` listens for user actions. Whichever resolves first wins the race.

Cancel? The hook fires, the sleep loses, reminder skipped. Snooze? Re-enter the race with a new `sleep()`. Send now? The hook fires immediately. The workflow was literally asleep and got woken up.

<!-- split -->

No cron table. No scheduler service. No state machine. No race conditions between "cancel" and "already fired."

The reminder is the workflow. The interrupt is a webhook. The logic is a `Promise.race()`.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Snooze without a state machine"

The user hits snooze. You need to cancel the current timer, start a new one, and keep the cancel and send-now options active. Traditionally that means updating a row in a scheduler table, resetting a TTL, and managing state transitions between pending, snoozed, and cancelled.

`Promise.race()` between `sleep()` and `defineHook()` runs in a loop. Snooze resolves the hook, the loop re-enters with a new `sleep()` duration. No state column. No TTL reset.

<!-- split -->

The hook payload determines the action: cancel, snooze, or send-now. Cancel exits the loop. Send-now skips the sleep and fires the reminder. Snooze re-enters the loop with a new sleep duration.

Each iteration is the same pattern. Race a timer against a webhook. Check the result. The loop is the state machine.

<!-- split -->

No scheduler table. No state transitions to manage. No "update the TTL" logic. Snooze is just another lap through the same `Promise.race()` loop with a fresh `sleep()`.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Cancel and already-fired can't collide"

The timer fires at 3:00:00. The user hits cancel at 3:00:01. Did the reminder send? Did the cancel win? With cron-based schedulers, this is a genuine race condition that requires locking or a two-phase check.

`Promise.race()` eliminates the ambiguity. The sleep and the hook are racing in the same durable step. One wins. The other is discarded. There is no window where both can execute.

<!-- split -->

If `sleep()` resolves first, the reminder sends and the hook is irrelevant. If `defineHook()` resolves first with a cancel action, the sleep is irrelevant. The outcome is determined by a single atomic race.

No lock table. No "check if already sent" query. No two-phase commit between the scheduler and the cancel handler.

<!-- split -->

No race condition. No near-miss bugs at timer boundaries. No defensive checks. `Promise.race()` makes the timer and the user action mutually exclusive by construction.

Explore the interactive demo on v0: {v0_link}
