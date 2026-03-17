---
slug: scatter-gather
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-scatter-gather
primitive: Promise.allSettled() + reduce
pick: null
---

# Scatter-Gather — Best Shipping Quote

Query 4 shipping providers in parallel. Pick the cheapest quote. If one provider times out, use the rest.

## Variant A — "The sequential bottleneck"

You need shipping quotes from four providers. One is slow. One might be down. Querying them sequentially wastes time, and querying them in parallel without coordination means you lose track of who failed.

`Promise.allSettled()` fans out to all four providers as independent durable steps. Every call runs in parallel with its own retry logic.

<!-- split -->

Each provider call is a `"use step"`, so failures are isolated. `Promise.allSettled()` collects every result — successes and errors alike — without short-circuiting.

Filter the fulfilled results and `reduce()` to the cheapest quote. If one provider crashed, the other three still contribute.

<!-- split -->

No fan-out queue. No correlation IDs. No aggregation service. No timeout cron. Four parallel calls and a `reduce()`.

Explore the interactive demo on v0: {v0_link}

## Variant B — "One provider crashes. Do you lose all four quotes?"

FedEx returns a quote in 200ms. DHL takes 2 seconds. USPS throws a 500. UPS never responds. With `Promise.all()`, one failure kills the entire batch.

`Promise.allSettled()` waits for every provider to resolve or reject, then hands you the full picture. No short-circuiting.

<!-- split -->

Each provider is a `"use step"` with independent retry logic. USPS gets retried automatically. UPS hits its timeout and fails. FedEx and DHL succeed on the first attempt. All four run in parallel.

`reduce()` across the fulfilled results picks the cheapest surviving quote. The failed providers show up as rejected entries you can log or alert on.

<!-- split -->

No aggregation service. No timeout coordinator. No partial-result database. Parallel calls, independent failures, and a `reduce()` to pick the winner.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Cheapest quote wins, even when providers misbehave"

Four shipping providers. Different latencies. Different reliability. You want the cheapest quote from whoever responds successfully, without waiting for the slowest one to drag everything down.

`Promise.allSettled()` plus `reduce()` turns this into a two-step operation: gather everything in parallel, then pick the best from whatever came back.

<!-- split -->

Each provider call is a durable step. Retries happen automatically for transient failures. If a provider is permanently broken, `FatalError` stops its retries without affecting the others.

The `reduce()` only considers fulfilled results. Three out of four providers responding? You still get the cheapest quote from those three.

<!-- split -->

No fan-out infrastructure. No result correlation. No retry policies per provider. Parallel steps, a reduce, and the cheapest quote wins regardless of which providers cooperated.

Explore the interactive demo on v0: {v0_link}
