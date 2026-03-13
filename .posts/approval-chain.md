---
slug: approval-chain
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-approval-chain
primitive: Promise.race() + defineHook() + sleep()
pick: null
---

# Approval Chain — Multi-Level Approval with Timeouts

Route approval through multiple levels, manager, director, VP, with per-level timeouts that escalate automatically.

## Variant A — "Three approvals, three deadlines"


A purchase order needs manager → director → VP sign-off. Each level has 24 hours. If nobody responds, it escalates or times out.

Traditional: a state machine in a database, polling workers, and external webhook handlers.

With WDK, each level is a `Promise.race()` between a hook and a `sleep()`:

```ts
import { defineHook, sleep } from "workflow";

async function approvalChain(expenseId, amount) {
  "use workflow";

  const levels = getApprovalLevelsForAmount(amount);

  for (const level of levels) {
    const hook = defineHook().create({
      token: `approval:${expenseId}:${level.role}`,
    });

    const result = await Promise.race([
      hook.then((p) => ({ type: "decision", payload: p })),
      sleep(level.timeout).then(() => ({ type: "timeout" })),
    ]);

    if (result.type === "timeout") continue; // escalate
    if (!result.payload.approved) return { status: "rejected" };
    return { status: "approved", decidedBy: level.role };
  }

  return { status: "expired" };
}
```

<!-- split -->

`defineHook()` creates an approval endpoint for each level. `Promise.race()` pits the approval against `sleep("24h")`.

Approval arrives? Move to the next level. Timeout wins? Escalate or reject. Each transition is a durable step. Crash mid-chain and it resumes at the right level.

<!-- split -->

No state machine table. No polling worker. No webhook retry logic. A loop, a hook, and a race at each level.

Explore the interactive demo on v0: {v0_link}

## Variant B — "The escalation ladder"

Manager didn't respond in 24 hours. Now the director needs to see it. Director is out? VP gets it with a shorter deadline.

Building this traditionally means a state column, a cron to check expiry, and a notification service watching for transitions.

WDK makes escalation a for-loop:

```ts
import { defineHook, sleep } from "workflow";

async function approvalChain(expenseId, amount) {
  "use workflow";

  const levels = getApprovalLevelsForAmount(amount);

  for (const level of levels) {
    const hook = defineHook().create({
      token: `approval:${expenseId}:${level.role}`,
    });

    const result = await Promise.race([
      hook.then((p) => ({ type: "decision", payload: p })),
      sleep(level.timeout).then(() => ({ type: "timeout" })),
    ]);

    if (result.type === "timeout") continue; // escalate
    if (!result.payload.approved) return { status: "rejected" };
    return { status: "approved", decidedBy: level.role };
  }

  return { status: "expired" };
}
```

<!-- split -->

Each approval level is an iteration. `defineHook()` gives the approver a unique URL. `sleep()` sets the deadline. `Promise.race()` picks the winner.

The entire escalation ladder is visible in one file. No state transitions hidden in database triggers or queue handlers.

<!-- split -->

No cron. No state column. No notification microservice. Each level is a race between a human and a clock.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Human-in-the-loop, durably"

Most approval workflows break when they hit real humans. People are slow. Systems restart. Deadlines span days.

Traditional tools struggle with long waits: persistent state, polling, and careful timeout management.

WDK waits as long as it takes:

```ts
import { defineHook, sleep } from "workflow";

async function approvalChain(expenseId, amount) {
  "use workflow";

  const levels = getApprovalLevelsForAmount(amount);

  for (const level of levels) {
    const hook = defineHook().create({
      token: `approval:${expenseId}:${level.role}`,
    });

    const result = await Promise.race([
      hook.then((p) => ({ type: "decision", payload: p })),
      sleep(level.timeout).then(() => ({ type: "timeout" })),
    ]);

    if (result.type === "timeout") continue; // escalate
    if (!result.payload.approved) return { status: "rejected" };
    return { status: "approved", decidedBy: level.role };
  }

  return { status: "expired" };
}
```

<!-- split -->

`sleep("24h")` is a real 24-hour pause. Zero compute. Zero cost. The workflow resumes exactly on the deadline.

`defineHook()` lets the human respond at any time. Whichever happens first, human or clock, the `Promise.race()` resolves.

<!-- split -->

Manager → Director → VP. Each with a deadline. Each durable across restarts. One file, readable top to bottom.

Explore the interactive demo on v0: {v0_link}
