---
slug: event-gateway
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-event-gateway
primitive: Promise.race() + Promise.all() + defineHook() + sleep()
pick: null
---

# Event Gateway — Multi-Signal Aggregation

Wait for multiple required signals (payment, inventory, fraud check) to all arrive, or timeout, before shipping an order.

## Variant A — "Three signals, one gate"


Before you ship an order, three things must be true: payment cleared, inventory reserved, fraud check passed. They arrive at different times from different services.

Traditional: correlation IDs in a database, a polling loop per signal, a state machine to track which signals arrived, a timeout sweep.

Or you compose `Promise.all()` with `defineHook()` and `sleep()`:

```ts
import { defineHook, sleep } from "workflow";

export const orderSignal = defineHook<{ ok: true }>();

const SIGNAL_KINDS = ["payment", "inventory", "fraud"] as const;

export async function eventGateway(orderId: string, timeoutMs = 10_000) {
  "use workflow";

  // Create a hook for each required signal
  const hooks = SIGNAL_KINDS.map((kind) => ({
    kind,
    hook: orderSignal.create({ token: `${kind}:${orderId}` }),
  }));

  // Race: all signals arrive vs. timeout
  const outcome = await Promise.race([
    Promise.all(hooks.map(({ hook }) => hook)).then(() => "ready" as const),
    sleep(`${timeoutMs}ms`).then(() => "timeout" as const),
  ]);

  if (outcome === "timeout") {
    return { orderId, status: "timeout" };
  }

  await shipOrder(orderId);
  return { orderId, status: "shipped" };
}
```

<!-- split -->

Each signal is a hook. `Promise.all()` waits for all three. `Promise.race()` wraps the gate with a `sleep()` timeout. If all signals arrive, the order ships. If the timeout wins, the order cancels.

No correlation table. No polling. The workflow is the gate.

<!-- split -->

Payment clears at T+2s. Inventory confirms at T+5s. Fraud passes at T+8s. Gate opens. Order ships.

Or: fraud check stalls. Timeout fires at T+30s. Order cancels. All durable. All in one file.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Race the clock"

Waiting for multiple async signals is easy. Waiting for all of them with a timeout is where it gets messy.

Traditional: a multi-step approval service, DB-backed correlation, completion polling, timeout cron.

WDK: `Promise.race()` between `Promise.all(hooks)` and `sleep(timeout)`:

```ts
import { defineHook, sleep } from "workflow";

export const orderSignal = defineHook<{ ok: true }>();

const SIGNAL_KINDS = ["payment", "inventory", "fraud"] as const;

export async function eventGateway(orderId: string, timeoutMs = 10_000) {
  "use workflow";

  // Create a hook for each required signal
  const hooks = SIGNAL_KINDS.map((kind) => ({
    kind,
    hook: orderSignal.create({ token: `${kind}:${orderId}` }),
  }));

  // Race: all signals arrive vs. timeout
  const outcome = await Promise.race([
    Promise.all(hooks.map(({ hook }) => hook)).then(() => "ready" as const),
    sleep(`${timeoutMs}ms`).then(() => "timeout" as const),
  ]);

  if (outcome === "timeout") {
    return { orderId, status: "timeout" };
  }

  await shipOrder(orderId);
  return { orderId, status: "shipped" };
}
```

<!-- split -->

`defineHook()` creates a signal endpoint for each external event. `Promise.all()` gates on every signal. `Promise.race()` adds the deadline. Whichever resolves first wins.

Each hook is durable. If the workflow crashes after payment clears but before fraud passes, it resumes with payment already recorded.

<!-- split -->

No approval service. No correlation IDs. No completion polling. Three hooks, one race, one file.

Explore the interactive demo on v0: {v0_link}

## Variant C — "The AND gate for async events"

You need payment AND inventory AND fraud check before shipping. That's a logical AND gate across three async, unreliable sources, with a timeout.

Compose the primitives:

```ts
import { defineHook, sleep } from "workflow";

export const orderSignal = defineHook<{ ok: true }>();

const SIGNAL_KINDS = ["payment", "inventory", "fraud"] as const;

export async function eventGateway(orderId: string, timeoutMs = 10_000) {
  "use workflow";

  // Create a hook for each required signal
  const hooks = SIGNAL_KINDS.map((kind) => ({
    kind,
    hook: orderSignal.create({ token: `${kind}:${orderId}` }),
  }));

  // Race: all signals arrive vs. timeout
  const outcome = await Promise.race([
    Promise.all(hooks.map(({ hook }) => hook)).then(() => "ready" as const),
    sleep(`${timeoutMs}ms`).then(() => "timeout" as const),
  ]);

  if (outcome === "timeout") {
    return { orderId, status: "timeout" };
  }

  await shipOrder(orderId);
  return { orderId, status: "shipped" };
}
```

<!-- split -->

`defineHook()` for each signal. `Promise.all()` for the AND logic. `sleep()` for the deadline. `Promise.race()` to pick the winner.

Four primitives, one pattern. Each signal survives restarts independently. The gate evaluates when all have resolved, or when time runs out.

<!-- split -->

Three external services. Three hooks. One gate. One timeout. Zero infrastructure beyond the workflow file.

Explore the interactive demo on v0: {v0_link}
