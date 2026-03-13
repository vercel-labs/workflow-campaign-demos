---
slug: wakeable-reminder
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-wakeable-reminder
primitive: defineHook() + Promise.race() + sleep()
pick: null
---

# Wakeable Reminder — Interruptible Scheduled Notification

Schedule a reminder for a future time, but allow cancel, snooze, or send-now before the timer fires, all via webhook.

## Variant A — "The snooze button problem"


You schedule a reminder for 2 hours from now. Then the user wants to snooze it. Or cancel it. Or send it immediately.

Traditional: a cron table, a background scheduler, a webhook endpoint to intercept pending jobs, and a state machine to track cancel/snooze/send.

With WDK it's `Promise.race()` between `sleep()` and a hook:

```ts
import { defineHook, sleep } from "workflow";

export const reminderActionHook = defineHook<ReminderAction>();

export async function scheduleReminder(userId: string, delayMs: number) {
  "use workflow";

  let sendAt = new Date(Date.now() + delayMs);
  const action = reminderActionHook.create({ token: `reminder:${userId}` });

  const outcome = await Promise.race([
    sleep(sendAt).then(() => ({ kind: "time" as const })),
    action.then((payload) => ({ kind: "action" as const, payload })),
  ]);

  if (outcome.kind === "action") {
    if (outcome.payload.type === "cancel") return { status: "cancelled" };
    if (outcome.payload.type === "snooze") {
      sendAt = new Date(Date.now() + outcome.payload.seconds * 1000);
      await sleep(sendAt);
    }
  }

  await sendReminderEmail(userId, sendAt);
  return { status: "sent" };
}
```

<!-- split -->

`sleep()` starts the countdown. `defineHook()` listens for user actions. `Promise.race()` resolves whichever comes first: the timer or the webhook.

Cancel? The hook fires, the sleep loses the race, reminder skipped. Snooze? Re-enter the race with a new sleep. Send now? Hook fires immediately.

<!-- split -->

One workflow. One race. Cancel, snooze, or send-now, all handled by whichever promise resolves first.

No cron table. No scheduler service. No state machine.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Durable sleep you can interrupt"

`sleep()` in WDK survives restarts. But what if you need to cancel that sleep early?

`defineHook()` gives you an external URL that wakes the workflow. Race them together and you get an interruptible durable timer.

```ts
import { defineHook, sleep } from "workflow";

export const reminderActionHook = defineHook<ReminderAction>();

export async function scheduleReminder(userId: string, delayMs: number) {
  "use workflow";

  let sendAt = new Date(Date.now() + delayMs);
  const action = reminderActionHook.create({ token: `reminder:${userId}` });

  const outcome = await Promise.race([
    sleep(sendAt).then(() => ({ kind: "time" as const })),
    action.then((payload) => ({ kind: "action" as const, payload })),
  ]);

  if (outcome.kind === "action") {
    if (outcome.payload.type === "cancel") return { status: "cancelled" };
    if (outcome.payload.type === "snooze") {
      sendAt = new Date(Date.now() + outcome.payload.seconds * 1000);
      await sleep(sendAt);
    }
  }

  await sendReminderEmail(userId, sendAt);
  return { status: "sent" };
}
```

<!-- split -->

The webhook URL is generated per workflow run. POST to it with `{ action: "cancel" }` and the hook resolves. The sleep loses the race. The workflow continues with cancellation logic.

No polling. No checking a "cancelled" flag in a database. The workflow was literally asleep and got woken up.

<!-- split -->

Schedule a reminder. Sleep until it's due. If a webhook arrives first, cancel, snooze, or send immediately.

Durable timers that respond to external events. One file.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Cron jobs that listen"

Cron fires and forgets. If you need to cancel a scheduled job, you delete the cron entry and hope nothing already picked it up.

WDK reminders are workflows that wait, and listen while they wait:

```ts
import { defineHook, sleep } from "workflow";

export const reminderActionHook = defineHook<ReminderAction>();

export async function scheduleReminder(userId: string, delayMs: number) {
  "use workflow";

  let sendAt = new Date(Date.now() + delayMs);
  const action = reminderActionHook.create({ token: `reminder:${userId}` });

  const outcome = await Promise.race([
    sleep(sendAt).then(() => ({ kind: "time" as const })),
    action.then((payload) => ({ kind: "action" as const, payload })),
  ]);

  if (outcome.kind === "action") {
    if (outcome.payload.type === "cancel") return { status: "cancelled" };
    if (outcome.payload.type === "snooze") {
      sendAt = new Date(Date.now() + outcome.payload.seconds * 1000);
      await sleep(sendAt);
    }
  }

  await sendReminderEmail(userId, sendAt);
  return { status: "sent" };
}
```

<!-- split -->

`Promise.race()` between `sleep("2h")` and `defineHook()`. The workflow is suspended, consuming zero compute, until either the timer fires or a webhook arrives.

Snooze means: resolve the hook, re-enter the race with a longer sleep. The workflow loops. Still one execution. Still durable.

<!-- split -->

No cron table to query. No background scheduler to manage. No race conditions between "cancel" and "already fired."

The reminder is the workflow. The interrupt is a webhook. The logic is a race.

Explore the interactive demo on v0: {v0_link}
