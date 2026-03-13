---
slug: saga
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-saga
primitive: FatalError + compensating transactions
pick: null
---

# Saga — Subscription Upgrade

Upgrade a subscription in 3 steps (reserve seats, capture invoice, provision). If any step fails, compensating transactions roll everything back automatically.

## Variant A — "The undo problem"


You charged the card. Then provisioning failed. Now you need to reverse the charge, release the seats, and email the customer.

Traditional: a rollback table, a compensations queue, and a cron to sweep incomplete sagas.

Or you write try/catch with durable steps:

```ts
async function subscriptionUpgradeSaga(accountId, seats) {
  "use workflow";

  const compensations = [];

  try {
    const reservationId = await reserveSeats(accountId, seats);
    compensations.push(() => releaseSeats(accountId, reservationId));

    const invoiceId = await captureInvoice(accountId, seats);
    compensations.push(() => refundInvoice(accountId, invoiceId));

    const entitlementId = await provisionSeats(accountId, seats);
    compensations.push(() => deprovisionSeats(accountId, entitlementId));

    await sendConfirmation(accountId, seats, invoiceId, entitlementId);
  } catch (error) {
    // Roll back in reverse order
    while (compensations.length > 0) {
      const undo = compensations.pop();
      await undo();
    }
  }
}
```

<!-- split -->

Each step records what it did. If a later step throws a `FatalError`, the workflow runs compensations in reverse order, automatically.

No rollback table. The undo logic lives right next to the do logic.

<!-- split -->

Reserve seats. Capture invoice. Provision access. If step 3 fails, step 2 refunds, step 1 releases.

All in one file. All durable.

Explore the interactive demo on v0: {v0_link}

## Variant B — "What if step 3 fails?"

What if step 3 of 3 fails, and you need to undo steps 1 and 2?

That's a saga. Traditionally you'd need a compensations table, a state machine, and a recovery worker.

With WDK, each step just has a compensate function:

```ts
async function subscriptionUpgradeSaga(accountId, seats) {
  "use workflow";

  const compensations = [];

  try {
    const reservationId = await reserveSeats(accountId, seats);
    compensations.push(() => releaseSeats(accountId, reservationId));

    const invoiceId = await captureInvoice(accountId, seats);
    compensations.push(() => refundInvoice(accountId, invoiceId));

    const entitlementId = await provisionSeats(accountId, seats);
    compensations.push(() => deprovisionSeats(accountId, entitlementId));

    await sendConfirmation(accountId, seats, invoiceId, entitlementId);
  } catch (error) {
    // Roll back in reverse order
    while (compensations.length > 0) {
      const undo = compensations.pop();
      await undo();
    }
  }
}
```

<!-- split -->

`FatalError` means "don't retry, roll back." The workflow calls each compensation in reverse, like unwinding a stack.

Every compensation is a durable step too. Crash mid-rollback? It picks up where it left off.

<!-- split -->

No saga orchestrator. No event sourcing. No compensation queue. Just try/catch that survives restarts.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Distributed transactions without the distributed part"

Distributed transactions are hard. Two-phase commit is fragile. Saga orchestrators are their own microservice.

WDK sagas are a try/catch block:

```ts
async function subscriptionUpgradeSaga(accountId, seats) {
  "use workflow";

  const compensations = [];

  try {
    const reservationId = await reserveSeats(accountId, seats);
    compensations.push(() => releaseSeats(accountId, reservationId));

    const invoiceId = await captureInvoice(accountId, seats);
    compensations.push(() => refundInvoice(accountId, invoiceId));

    const entitlementId = await provisionSeats(accountId, seats);
    compensations.push(() => deprovisionSeats(accountId, entitlementId));

    await sendConfirmation(accountId, seats, invoiceId, entitlementId);
  } catch (error) {
    // Roll back in reverse order
    while (compensations.length > 0) {
      const undo = compensations.pop();
      await undo();
    }
  }
}
```

<!-- split -->

Each `"use step"` is an atomic unit. Attach a compensate function and the runtime handles rollback order if anything throws `FatalError`.

The compensation chain is just your code running in reverse. Durable. Retriable. Inspectable.

<!-- split -->

Upgrade a subscription: reserve → invoice → provision. Failure at any point unwinds cleanly.

Explore the interactive demo on v0: {v0_link}
