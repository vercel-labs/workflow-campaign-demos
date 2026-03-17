---
slug: aggregator
day: null
v0_url: https://v0.app/chat/FFBFRueIqgw
primitive: Promise.race() + defineHook() + sleep()
pick: null
---

# Aggregator — Collect Signals with Timeout

Collect signals from three distributed sources, release when all arrive or a timeout fires, whichever comes first.

## Variant A — "Wait for all, but not forever"

Three warehouses report inventory. One might never respond. Waiting forever blocks the pipeline. Ignoring stragglers loses data.

`Promise.race()` between `defineHook()` endpoints and a `sleep()` deadline solves both.

<!-- split -->

Durable hook per source. `Promise.all()` waits for every signal. `Promise.race()` pits completion against the `sleep()` timeout.

```ts
const received = new Map<string, SignalPayload>();
const hooks = SOURCES.map((source) => {
  const hook = aggregatorSignal.create({ token: `${source}:${batchId}` });
  return hook.then((payload) => { received.set(source, payload); });
});

const outcome = await Promise.race([
  Promise.all(hooks).then(() => ({ type: "ready" as const })),
  sleep(`${timeoutMs}ms`).then(() => ({ type: "timeout" as const })),
]);
const snapshot = new Map(received);
```

Timeout fires first? Snapshot what arrived and proceed with partial data. Every received signal is already persisted.

<!-- split -->

No polling loop. No correlation table. No timeout sweep job. Hooks, a race, and a sleep — all durable.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Proceed with partial data"

Two warehouses report in. The third times out. You still need to move forward with what you have.

`Promise.race()` between completion and a deadline means you always proceed.

<!-- split -->

Durable hook per source. A `Map` tracks arrivals. When the race resolves, the workflow snapshots the map so late arrivals can't mutate the summary.

Timeout wins? Every signal that arrived is safe. You know exactly who responded.

<!-- split -->

No polling for stragglers. No dead letter queue for missing signals. The race resolves, you snapshot what arrived, and move forward.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Durable hooks that survive crashes"

Two signals arrive. Process crashes. When it restarts, are those signals gone?

`defineHook()` persists each signal on arrival. The workflow resumes with both intact and keeps waiting for the third — or the `sleep()` deadline.

<!-- split -->

Each hook is a durable endpoint. Payloads persist immediately. `Promise.race()` against `sleep()` ensures it never waits forever.

Crash at any point — resume with all received data and the remaining deadline.

<!-- split -->

No write-ahead log. No signal persistence layer. No recovery logic. Durable hooks, surviving signals, and a ticking timeout.

Explore the interactive demo on v0: {v0_link}
