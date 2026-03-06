# Payment Webhooks — Tweet Thread Variations

5 variations for Day 5. Same code screenshot across all — only the prose changes.

**Code screenshot** (used by all variations):

```ts
const webhook = createWebhook({
  token: `order:${orderId}`,
  respondWith: "manual",
});

const ledger = [];

for await (const req of webhook) {
  const entry = await processPaymentEvent(req);
  ledger.push(entry);
  if (entry.type === "refund.created") break;
}

return { orderId, ledger, status: "settled" };
```

---

## Variation A — Infrastructure Enumeration

Classic "So you need X, Y, Z..." opener. Echoes Day 1 and Day 2.

### Tweet 1

# 30 Days of Workflow DevKit — Day 5 — Payment Webhooks

An order fires events — created, authorized, captured, refunded. Each hits a stateless handler. So you need a database, a state machine, reconciliation logic...

Or you track the whole lifecycle in a loop:

### Tweet 2

`createWebhook()` opens a durable endpoint scoped to one order. The `for await` loop suspends between events — zero compute, whether the next hit is seconds or weeks away.

Each iteration is a `"use step"`. Fail mid-event? Only that event retries.

### Tweet 3

No database. No state machine. No reconciliation cron. One loop from payment.created to settled.

Explore the interactive demo on v0:

---

## Variation B — Scenario Opener

Walks through the actual Stripe lifecycle the demo shows.

### Tweet 1

# 30 Days of Workflow DevKit — Day 5 — Payment Webhooks

Customer pays. Stripe fires payment.created. 3D Secure kicks in — requires_action. Then succeeded. Three weeks later: refund.created.

Four events. One order. One for-loop:

### Tweet 2

The webhook is scoped to this order — `order:${orderId}`. Each event lands in a `for await` loop. `ledger` tracks the full history without a database.

The loop breaks on refund.created. Status: settled. The whole lifecycle reads top to bottom.

### Tweet 3

No database rows. No event replay. No state reconstruction. Just a loop that remembers every hit.

Explore the interactive demo on v0:

---

## Variation C — Failure-First

Opens with the recovery problem, like Day 7 (Fan-Out).

### Tweet 1

# 30 Days of Workflow DevKit — Day 5 — Payment Webhooks

payment.failed arrives. Your handler has no memory — was it authorized? Was 3DS required? You query the database, reconstruct the timeline, hope nothing got lost.

Unless the webhook keeps its own memory:

### Tweet 2

Each event is a `"use step"`. If one fails, only that event retries. The rest sit in `ledger` — durable, untouched.

Between events the loop suspends at zero compute. Restart the server? It picks up at the next hit.

### Tweet 3

No state reconstruction. No replay logic. No timeline queries. A for-loop that tracks the order from first charge to settled.

Explore the interactive demo on v0:

---

## Variation D — "What if" Provocation

Short rhetorical opener. Lets the code answer.

### Tweet 1

# 30 Days of Workflow DevKit — Day 5 — Payment Webhooks

What if your webhook tracked an order from first charge to final refund — remembering every event — without a database?

`createWebhook()` does exactly that:

### Tweet 2

The webhook is scoped to one order. `for await` suspends between events at zero compute. Each hit runs as a `"use step"`, retried independently.

`ledger` is a local array. It survives across events, restarts, and deploys.

### Tweet 3

No database rows. No event-sourcing framework. No replay. A local array that tracks the whole payment lifecycle.

Explore the interactive demo on v0:

---

## Variation E — Direct Contrast

Side-by-side framing. Names the old way, then the new way.

### Tweet 1

# 30 Days of Workflow DevKit — Day 5 — Payment Webhooks

Traditional: each webhook hit queries a database to figure out where an order stands.

Workflow: one loop that remembers everything from payment.created to refund.created:

### Tweet 2

`createWebhook()` scopes a durable endpoint to one order. Each iteration is a `"use step"` — retried independently on failure.

Between events the workflow suspends. Zero compute. Restart the server? Picks up at the next hit.

### Tweet 3

No DB queries between events. No state machine. No cleanup cron. One loop that settles the order.

Explore the interactive demo on v0:
