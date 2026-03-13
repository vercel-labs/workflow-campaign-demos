---
slug: idempotent-receiver
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-idempotent-receiver
primitive: durable state (workflow keyed by idempotency key)
pick: null
---

# Idempotent Receiver — Duplicate Payment Detection

Detect duplicate payment requests using an idempotency key. Return the cached result for duplicates without reprocessing the payment.

## Variant A — "Same request, same result"


The client retries a payment request. Your server processes it again. The customer gets charged twice. Support ticket incoming.

Traditional: a distributed cache or DB lookup for the idempotency key, expiration policies, race condition handling with locks or compare-and-swap.

Or you key the workflow by the idempotency key, and duplicates resolve to the same run:

```ts
export async function idempotentReceiver(
  idempotencyKey: string,
  amount: number,
  currency: string
) {
  "use workflow";

  // Workflow keyed by idempotencyKey — same key = same run
  const cached = await checkIdempotencyKey(idempotencyKey);

  if (cached) {
    // Duplicate request — return cached result, no reprocessing
    return { idempotencyKey, deduplicated: true, result: cached };
  }

  const result = await processPayment(idempotencyKey, amount, currency);
  return { idempotencyKey, deduplicated: false, result };
}

async function processPayment(key: string, amount: number, currency: string) {
  "use step";
  const result = await chargeCard({ amount, currency });
  // Result stored durably — future duplicate requests get this back
  return result;
}
```

<!-- split -->

The workflow ID is the idempotency key. Second request with the same key? Same workflow. Already completed? Return the cached result. Still running? Attach to the existing run.

No cache layer. No lock contention. No TTL expiration. Durable state is the dedup mechanism.

<!-- split -->

Payment request arrives. Workflow runs. Result stored. Same request arrives again. Same result returned. No reprocessing.

No distributed lock. No Redis lookup. No race conditions.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Idempotency without the cache"

Every payment API needs idempotency. The standard solution: store the idempotency key in Redis, set a TTL, check before processing, handle the race condition when two requests arrive simultaneously.

WDK: the workflow ID is the idempotency key:

```ts
export async function idempotentReceiver(
  idempotencyKey: string,
  amount: number,
  currency: string
) {
  "use workflow";

  // Workflow keyed by idempotencyKey — same key = same run
  const cached = await checkIdempotencyKey(idempotencyKey);

  if (cached) {
    // Duplicate request — return cached result, no reprocessing
    return { idempotencyKey, deduplicated: true, result: cached };
  }

  const result = await processPayment(idempotencyKey, amount, currency);
  return { idempotencyKey, deduplicated: false, result };
}

async function processPayment(key: string, amount: number, currency: string) {
  "use step";
  const result = await chargeCard({ amount, currency });
  // Result stored durably — future duplicate requests get this back
  return result;
}
```

<!-- split -->

Two requests with the same key start the same workflow. The first one runs. The second one gets the result of the first. The runtime handles the dedup. No application-level locking.

Durable state means the result persists without a cache TTL. No expired keys. No reprocessing after cache eviction.

<!-- split -->

No Redis. No compare-and-swap. No expiration sweep. The workflow is the idempotency record.

Explore the interactive demo on v0: {v0_link}

## Variant C — "The cheapest dedup is no dedup"

Deduplication infrastructure is surprisingly expensive: a cache cluster, TTL management, lock coordination, and fallback logic when the cache is down.

What if the dedup was just... how workflows work?

```ts
export async function idempotentReceiver(
  idempotencyKey: string,
  amount: number,
  currency: string
) {
  "use workflow";

  // Workflow keyed by idempotencyKey — same key = same run
  const cached = await checkIdempotencyKey(idempotencyKey);

  if (cached) {
    // Duplicate request — return cached result, no reprocessing
    return { idempotencyKey, deduplicated: true, result: cached };
  }

  const result = await processPayment(idempotencyKey, amount, currency);
  return { idempotencyKey, deduplicated: false, result };
}

async function processPayment(key: string, amount: number, currency: string) {
  "use step";
  const result = await chargeCard({ amount, currency });
  // Result stored durably — future duplicate requests get this back
  return result;
}
```

<!-- split -->

Key the workflow by the idempotency key. The runtime guarantees one execution per key. Duplicate requests attach to the existing run and receive the same result.

No separate dedup layer. No cache. No locks. The durable execution model gives you idempotency for free.

<!-- split -->

Process once. Return the same result forever. No infrastructure beyond the workflow itself.

Explore the interactive demo on v0: {v0_link}
