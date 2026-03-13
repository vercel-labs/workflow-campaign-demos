---
slug: process-manager
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-process-manager
primitive: sleep() for durable wait + branching logic
pick: null
---

# Process Manager — Multi-Stage Order Fulfillment

Orchestrate a multi-stage order: payment, inventory, reservation, shipping, delivery, with branching logic for backorders and durable waits for restocking.

## Variant A — "The order that waits"


Payment clears. Inventory check says backordered. Now your order needs to wait 48 hours for restocking, then resume shipping.

Traditional: an order state machine, a state transition table in Postgres, a background job scheduler, and a cron that polls for resumable orders.

With WDK you call `sleep("48h")` and the workflow resumes itself:

```ts
import { sleep } from "workflow";

export async function processManager(orderId: string, items: string[]) {
  "use workflow";

  let state = "received";

  state = await validatePayment(orderId);
  if (state === "payment_failed") return await cancelOrder(orderId);

  state = await checkInventory(orderId, items);

  if (state === "backordered") {
    await sleep("48h"); // durable — survives restarts
    state = await recheckInventory(orderId);
  }

  await reserveInventory(orderId, items);
  await shipOrder(orderId);
  await confirmDelivery(orderId);

  return { orderId, finalState: "completed" };
}
```

<!-- split -->

The branching logic is just `if/else`. Backorder? Sleep. In stock? Ship. The `sleep()` is durable. It survives restarts, redeployments, and infrastructure changes.

No state transition table. No scheduler. No polling cron.

<!-- split -->

Payment → inventory check → backorder wait → shipping → delivery. Five stages, branching paths, durable pauses.

One file. Regular TypeScript. No workflow engine.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Branching without a state machine"

Order fulfillment has branches. In stock? Ship it. Backordered? Wait, then ship. Failed payment? Cancel everything.

Traditional process managers model this as a state machine with a transition table. Each state is a row. Each transition is a rule.

WDK process managers model this as code:

```ts
import { sleep } from "workflow";

export async function processManager(orderId: string, items: string[]) {
  "use workflow";

  let state = "received";

  state = await validatePayment(orderId);
  if (state === "payment_failed") return await cancelOrder(orderId);

  state = await checkInventory(orderId, items);

  if (state === "backordered") {
    await sleep("48h"); // durable — survives restarts
    state = await recheckInventory(orderId);
  }

  await reserveInventory(orderId, items);
  await shipOrder(orderId);
  await confirmDelivery(orderId);

  return { orderId, finalState: "completed" };
}
```

<!-- split -->

`if (backordered)` → `sleep("48h")` → check again. That's the branch. The `sleep()` is durable. The workflow literally pauses for 48 hours and picks up where it left off.

No state column. No transition rules. No background job to wake it up.

<!-- split -->

Payment. Inventory. Branching. Waiting. Shipping. Delivery. All the complexity of order fulfillment, none of the infrastructure.

Explore the interactive demo on v0: {v0_link}

## Variant C — "A workflow engine in a function"

Process managers coordinate long-running, multi-step business processes. Traditionally that means a workflow engine: BPMN diagrams, state persistence, timer services.

WDK gives you the same durability in a TypeScript function:

```ts
import { sleep } from "workflow";

export async function processManager(orderId: string, items: string[]) {
  "use workflow";

  let state = "received";

  state = await validatePayment(orderId);
  if (state === "payment_failed") return await cancelOrder(orderId);

  state = await checkInventory(orderId, items);

  if (state === "backordered") {
    await sleep("48h"); // durable — survives restarts
    state = await recheckInventory(orderId);
  }

  await reserveInventory(orderId, items);
  await shipOrder(orderId);
  await confirmDelivery(orderId);

  return { orderId, finalState: "completed" };
}
```

<!-- split -->

Each stage is a `"use step"`. Branching is `if/else`. Durable waits are `sleep()`. The runtime checkpoints after every step and resumes after every pause.

Crash mid-shipment? It resumes at shipping. Sleep for 48 hours? It wakes up at 48 hours.

<!-- split -->

No BPMN. No state database. No timer service. Just an async function that happens to survive anything.

Explore the interactive demo on v0: {v0_link}
