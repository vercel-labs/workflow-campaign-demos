---
slug: choreography
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-choreography
primitive: FatalError for compensation + sleep() for handoff delays
pick: null
---

# Choreography — Multi-Participant Order Flow

Orchestrate an order through inventory, payment, and shipping, with event-driven handoffs and compensating transactions when a participant fails.

## Variant A — "When payment fails after inventory reserved"


Order placed. Inventory reserved. Payment declines. Now you need to release the inventory, notify the customer, and log the failure, in the right order.

Traditional: an event bus with subscribers for each participant, a saga table to track progress, and explicit rollback services per step.

With WDK each participant is a step with compensation:

```ts
import { sleep, FatalError } from "workflow";

export async function choreography(orderId: string, items: OrderItem[]) {
  "use workflow";

  await orderServicePlaceOrder(orderId, items);

  const inventory = await inventoryServiceReserve(items);
  if (!inventory.success) {
    await orderServiceCompensate(orderId, "inventory_failed");
    return { outcome: "compensated" };
  }

  await sleep("3s"); // handoff latency between participants

  const payment = await paymentServiceCharge(orderId);
  if (!payment.success) {
    await inventoryServiceCompensate(items, "payment_failed");
    await orderServiceCompensate(orderId, "payment_failed");
    return { outcome: "compensated" };
  }

  const shipping = await shippingServiceShip(orderId, items);
  if (!shipping.success) {
    await paymentServiceCompensate(orderId, "shipping_failed");
    await inventoryServiceCompensate(items, "shipping_failed");
    await orderServiceCompensate(orderId, "shipping_failed");
    return { outcome: "compensated" };
  }

  return { outcome: "fulfilled" };
}
```

<!-- split -->

Reserve inventory. Charge payment. Book shipping. If payment throws `FatalError`, the workflow runs compensations in reverse: release inventory, cancel the reservation.

Each handoff has a `sleep()` to simulate real-world processing delays between services. Each compensation is durable. Crash mid-rollback? It resumes.

<!-- split -->

Four participants. One workflow. Failure at any point triggers automatic compensation in reverse order.

No event bus. No saga table. No rollback microservices.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Choreography without the message broker"

Choreography patterns usually need a message broker. Each service subscribes to events, publishes results, and you pray the ordering is correct.

WDK replaces the broker with sequential durable steps:

```ts
import { sleep, FatalError } from "workflow";

export async function choreography(orderId: string, items: OrderItem[]) {
  "use workflow";

  await orderServicePlaceOrder(orderId, items);

  const inventory = await inventoryServiceReserve(items);
  if (!inventory.success) {
    await orderServiceCompensate(orderId, "inventory_failed");
    return { outcome: "compensated" };
  }

  await sleep("3s"); // handoff latency between participants

  const payment = await paymentServiceCharge(orderId);
  if (!payment.success) {
    await inventoryServiceCompensate(items, "payment_failed");
    await orderServiceCompensate(orderId, "payment_failed");
    return { outcome: "compensated" };
  }

  const shipping = await shippingServiceShip(orderId, items);
  if (!shipping.success) {
    await paymentServiceCompensate(orderId, "shipping_failed");
    await inventoryServiceCompensate(items, "shipping_failed");
    await orderServiceCompensate(orderId, "shipping_failed");
    return { outcome: "compensated" };
  }

  return { outcome: "fulfilled" };
}
```

<!-- split -->

Order → inventory → payment → shipping. Each step is a handoff. `sleep()` adds realistic processing time between participants. If any step fails with `FatalError`, compensations run automatically.

No pub/sub. No event ordering guarantees to worry about. No dead-letter queues. The sequence is the code.

<!-- split -->

The choreography is a function. The handoffs are steps. The rollbacks are compensations attached to each step.

All participants, one file. All durable.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Compensating transactions that actually work"

Compensating transactions sound simple. In practice: which services need rollback? In what order? What if the compensation itself fails?

WDK handles all of it:

```ts
import { sleep, FatalError } from "workflow";

export async function choreography(orderId: string, items: OrderItem[]) {
  "use workflow";

  await orderServicePlaceOrder(orderId, items);

  const inventory = await inventoryServiceReserve(items);
  if (!inventory.success) {
    await orderServiceCompensate(orderId, "inventory_failed");
    return { outcome: "compensated" };
  }

  await sleep("3s"); // handoff latency between participants

  const payment = await paymentServiceCharge(orderId);
  if (!payment.success) {
    await inventoryServiceCompensate(items, "payment_failed");
    await orderServiceCompensate(orderId, "payment_failed");
    return { outcome: "compensated" };
  }

  const shipping = await shippingServiceShip(orderId, items);
  if (!shipping.success) {
    await paymentServiceCompensate(orderId, "shipping_failed");
    await inventoryServiceCompensate(items, "shipping_failed");
    await orderServiceCompensate(orderId, "shipping_failed");
    return { outcome: "compensated" };
  }

  return { outcome: "fulfilled" };
}
```

<!-- split -->

Attach a `compensate` function to each step. If a later step throws `FatalError`, the runtime calls compensations in reverse, and each compensation is itself a durable step.

Compensation fails? It retries. Server crashes mid-compensation? It resumes. The unwinding is as reliable as the forward path.

<!-- split -->

Order flow: reserve → charge → ship. Payment fails? Release inventory. Shipping fails? Refund charge, release inventory.

No manual rollback coordination. No saga orchestrator. Just functions that undo other functions.

Explore the interactive demo on v0: {v0_link}
