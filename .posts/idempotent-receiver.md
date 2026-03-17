---
slug: idempotent-receiver
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-idempotent-receiver
primitive: durable state (workflow keyed by idempotency key)
pick: null
---

# Idempotent Receiver — Duplicate Payment Detection

Detect duplicate payment requests using an idempotency key. Return the cached result for duplicates without reprocessing the payment.

## Variant A — "The double-charge nightmare"

A client retries a payment request. Your server processes it again. The customer gets charged twice. Support ticket incoming.

The standard fix is a distributed cache or database lookup for the idempotency key, expiration policies, and race condition handling with locks or compare-and-swap.

The workflow ID is the idempotency key. When you call `start()` with the same key, the runtime resolves it to the same run. Already completed? Return the cached result. Still running? Attach to the existing execution.

<!-- split -->

Durable state means the result persists without a cache TTL. No expired keys leading to reprocessing after cache eviction. Two requests with the same key start the same workflow. The first one runs through `processPayment`. The second one gets the result of the first.

The runtime handles the deduplication. No application-level locking. No compare-and-swap logic.

<!-- split -->

No Redis. No distributed lock. No TTL management. No expiration sweeps. The durable execution model gives you idempotency for free. Process once, return the same result forever.

Explore the interactive demo on v0: {v0_link}

## Variant B — "What happens when the cache expires?"

You store the idempotency key in Redis with a 24-hour TTL. Day two, the client retries. The key is gone. The payment processes again. The customer calls. You dig through logs trying to figure out if it is a legitimate retry or a duplicate.

TTL-based idempotency is a time bomb. Durable workflow state has no expiration. The workflow ID is the idempotency key, and `start()` with the same ID returns the same result whether it has been one minute or one year.

<!-- split -->

`processPayment` runs exactly once for a given workflow ID. Every subsequent `start()` call with that ID resolves to the completed run and returns the cached result. No cache lookup. No TTL renewal. No expiration sweep job.

If the first request is still in progress, the second request attaches to the running workflow instead of creating a new one.

<!-- split -->

No cache eviction surprises. No TTL tuning. No "was this a real retry or a duplicate?" investigations. Durable state means the idempotency key never expires and the result never needs recomputation.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Idempotency without a cache layer"

Most idempotency implementations start with "add Redis" and end with TTL policies, race condition handling, cache warming, and eviction monitoring. The cache becomes its own service to maintain.

The workflow ID is the idempotency key. No separate cache. No separate lookup. `start()` with the same ID returns the same execution. The runtime is the deduplication layer.

<!-- split -->

Two requests hit your API with the same idempotency key. Both call `start()` with that key as the workflow ID. The first creates a run and executes `processPayment`. The second resolves to the same run and gets the result.

No lock contention. No compare-and-swap. No "check cache, then process, then write cache" sequence with its own race conditions.

<!-- split -->

No Redis cluster. No cache invalidation bugs. No TTL management. No expiration-triggered reprocessing. The durable execution runtime is the idempotency layer. One fewer service to deploy, monitor, and debug.

Explore the interactive demo on v0: {v0_link}
