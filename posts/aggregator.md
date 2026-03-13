---
slug: aggregator
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-aggregator
primitive: Promise.race() + defineHook() + sleep()
pick: null
---

# Aggregator — Collect Signals with Timeout

Collect signals from distributed sources, release when all arrive or a timeout fires, whichever comes first.

## Variant A — "Wait for everyone, but not forever"


Three services need to report in before you can proceed. One might never respond.

Traditional: polling loops, message queues, and timeout handling spread across services.

With WDK, it's `Promise.race()` against a `sleep()`:

```ts
import { defineHook, sleep } from "workflow";

async function aggregator(batchId, timeoutMs = 8000) {
  "use workflow";

  const sources = ["warehouse-a", "warehouse-b", "warehouse-c"];
  const signal = defineHook();

  const hooks = sources.map((source) =>
    signal.create({ token: `${source}:${batchId}` })
  );

  const outcome = await Promise.race([
    Promise.all(hooks).then((results) => ({ type: "ready", results })),
    sleep(`${timeoutMs}ms`).then(() => ({ type: "timeout" })),
  ]);

  // All arrived? Full aggregate. Timeout? Proceed with partial data.
  return processBatch(batchId, outcome);
}
```

<!-- split -->

`defineHook()` creates a webhook for each source. `Promise.race()` pits the collection against a `sleep("60s")` deadline.

All signals arrive? Proceed with full data. Timeout fires first? Proceed with what you have. The workflow handles both paths.

<!-- split -->

No polling loop. No message queue. No timeout sweep job. Hooks, a race, and a sleep.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Partial data is better than no data"

You're aggregating inventory counts from 5 warehouses. Four respond in seconds. One is offline.

Do you wait forever? Block the whole pipeline? Traditional aggregators need a correlation table, a TTL, and a fallback worker.

WDK gives you `Promise.race()`:

```ts
import { defineHook, sleep } from "workflow";

async function aggregator(batchId, timeoutMs = 8000) {
  "use workflow";

  const sources = ["warehouse-a", "warehouse-b", "warehouse-c"];
  const signal = defineHook();

  const hooks = sources.map((source) =>
    signal.create({ token: `${source}:${batchId}` })
  );

  const outcome = await Promise.race([
    Promise.all(hooks).then((results) => ({ type: "ready", results })),
    sleep(`${timeoutMs}ms`).then(() => ({ type: "timeout" })),
  ]);

  // All arrived? Full aggregate. Timeout? Proceed with partial data.
  return processBatch(batchId, outcome);
}
```

<!-- split -->

Each warehouse posts to a `defineHook()` endpoint. The workflow collects results as they arrive. Meanwhile, `sleep("30s")` is ticking.

Timeout wins the race? You proceed with 4 out of 5. Every signal that arrived is already persisted in durable steps.

<!-- split -->

No correlation table. No TTL keys. No fallback worker. Webhooks, a race, and a deadline that actually works.

Explore the interactive demo on v0: {v0_link}

## Variant C — "The collector pattern"

Distributed systems produce events at different times. An aggregator collects them and decides when to release.

Traditionally: a message broker, a stateful consumer, a database for partial results, and a cron for timeouts.

WDK replaces all four:

```ts
import { defineHook, sleep } from "workflow";

async function aggregator(batchId, timeoutMs = 8000) {
  "use workflow";

  const sources = ["warehouse-a", "warehouse-b", "warehouse-c"];
  const signal = defineHook();

  const hooks = sources.map((source) =>
    signal.create({ token: `${source}:${batchId}` })
  );

  const outcome = await Promise.race([
    Promise.all(hooks).then((results) => ({ type: "ready", results })),
    sleep(`${timeoutMs}ms`).then(() => ({ type: "timeout" })),
  ]);

  // All arrived? Full aggregate. Timeout? Proceed with partial data.
  return processBatch(batchId, outcome);
}
```

<!-- split -->

`defineHook()` for ingestion. `Promise.race()` for the deadline. `sleep()` for the timeout. Each piece is a durable primitive that survives crashes.

The aggregation logic is just a loop accumulating results. No external state. No consumer group offsets.

<!-- split -->

Collect from any number of sources. Release on completion or timeout. One file. All durable.

Explore the interactive demo on v0: {v0_link}
