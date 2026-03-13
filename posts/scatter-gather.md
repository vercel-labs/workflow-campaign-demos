---
slug: scatter-gather
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-scatter-gather
primitive: Promise.allSettled() + reduce
pick: null
---

# Scatter-Gather — Best Shipping Quote

Query 4 shipping providers in parallel. Pick the cheapest quote. If one provider times out, use the rest.

## Variant A — "Cheapest quote wins"


You need shipping quotes from 4 providers. One is slow. One might be down.

Traditional: a fan-out queue, a correlation table, and a timeout sweep.

Or `Promise.allSettled()` with durable steps:

```ts
async function scatterGather(packageId) {
  "use workflow";

  const settled = await Promise.allSettled([
    fetchFedExQuote(packageId),  // each is "use step"
    fetchUpsQuote(packageId),
    fetchDhlQuote(packageId),
    fetchUspsQuote(packageId),
  ]);

  const quotes = settled
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);

  const winner = quotes.reduce((best, cur) =>
    cur.price < best.price ? cur : best
  );

  return { packageId, winner };
}
```

<!-- split -->

Each provider call is a `"use step"`, retried independently. `Promise.allSettled()` waits for all of them, failures included.

Filter the successes, reduce to the cheapest. Done.

<!-- split -->

No fan-out queue. No correlation IDs. No timeout cron. Four parallel calls and a `reduce()`.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Parallel calls, partial failures"

Fire 4 API calls. Two return in 200ms. One takes 3 seconds. One fails.

You still need the best result from whoever responded. That's scatter-gather.

With WDK, it's `Promise.allSettled()`:

```ts
async function scatterGather(packageId) {
  "use workflow";

  const settled = await Promise.allSettled([
    fetchFedExQuote(packageId),  // each is "use step"
    fetchUpsQuote(packageId),
    fetchDhlQuote(packageId),
    fetchUspsQuote(packageId),
  ]);

  const quotes = settled
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);

  const winner = quotes.reduce((best, cur) =>
    cur.price < best.price ? cur : best
  );

  return { packageId, winner };
}
```

<!-- split -->

Each call is its own durable step with independent retries. `allSettled` never throws. You get every result or every error.

Pick the winner from the successes. Log the failures. Move on.

<!-- split -->

No orchestrator. No aggregation service. Four steps, one reduce, best quote selected.

Explore the interactive demo on v0: {v0_link}

## Variant C — "The RFQ pattern"

Request for Quote: ask multiple vendors, pick the best offer.

In infrastructure, this means fan-out, collect, aggregate, decide. Usually 4 services and a correlation database.

In WDK, it's one workflow:

```ts
async function scatterGather(packageId) {
  "use workflow";

  const settled = await Promise.allSettled([
    fetchFedExQuote(packageId),  // each is "use step"
    fetchUpsQuote(packageId),
    fetchDhlQuote(packageId),
    fetchUspsQuote(packageId),
  ]);

  const quotes = settled
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value);

  const winner = quotes.reduce((best, cur) =>
    cur.price < best.price ? cur : best
  );

  return { packageId, winner };
}
```

<!-- split -->

`Promise.allSettled()` fans out to all providers. Each is a durable step. If one crashes mid-call, only that step retries.

The rest of your quotes are safe. No shared failure modes.

<!-- split -->

Scatter. Gather. Pick the cheapest. No message broker. No aggregation database. No correlation table.

Explore the interactive demo on v0: {v0_link}
