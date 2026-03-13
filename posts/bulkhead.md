---
slug: bulkhead
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-bulkhead
primitive: Promise.allSettled() + sleep()
pick: null
---

# Bulkhead — Isolated Parallel Processing

Partition items into isolated compartments processed in parallel. One failure doesn't sink the others.

## Variant A — "One bad item can't take down the batch"


You're processing 20 items. Item 7 throws. Traditional parallel processing? The whole batch fails. Or you catch everything and lose visibility.

A bulkhead isolates each compartment. With WDK it's `Promise.allSettled()` over durable steps:

```ts
export async function bulkhead(
  jobId: string,
  items: string[],
  maxConcurrency: number
) {
  "use workflow";

  const results = [];
  let compartmentIndex = 0;

  for (let i = 0; i < items.length; i += maxConcurrency) {
    compartmentIndex++;
    const batch = items.slice(i, i + maxConcurrency);

    // Run compartment in parallel — failures are isolated
    const outcomes = await Promise.allSettled(
      batch.map((item, idx) => processItem(item, compartmentIndex, idx))
    );

    for (const outcome of outcomes) {
      results.push(
        outcome.status === "fulfilled"
          ? outcome.value
          : { ok: false, error: String(outcome.reason) }
      );
    }

    // Durable pacing between compartments
    if (i + maxConcurrency < items.length) {
      await sleep("1s");
    }
  }

  return { results, compartments: compartmentIndex };
}

async function processItem(item: string, compartment: number, idx: number) {
  "use step";
  // Each item is isolated — a failure here won't affect other items
  const result = await callExternalService(item);
  return { item, compartment, ok: true, ...result };
}
```

<!-- split -->

Each item runs in its own `"use step"`, isolated and retried independently. `Promise.allSettled()` waits for every result, success or failure.

Item 7 throws? Items 1-6 and 8-20 are untouched. You get a full report of what succeeded and what didn't.

<!-- split -->

No thread pool configuration. No process isolation. No manual error boundaries. `allSettled` gives you bulkheads for free.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Failure isolation without infrastructure"

In ship design, a bulkhead stops water from flooding the entire hull. In software, the same idea keeps one failure from cascading.

Traditional: thread pools, process workers, or queue-based isolation with per-item dead letter queues.

WDK gives you isolation with `Promise.allSettled()`:

```ts
export async function bulkhead(
  jobId: string,
  items: string[],
  maxConcurrency: number
) {
  "use workflow";

  const results = [];
  let compartmentIndex = 0;

  for (let i = 0; i < items.length; i += maxConcurrency) {
    compartmentIndex++;
    const batch = items.slice(i, i + maxConcurrency);

    // Run compartment in parallel — failures are isolated
    const outcomes = await Promise.allSettled(
      batch.map((item, idx) => processItem(item, compartmentIndex, idx))
    );

    for (const outcome of outcomes) {
      results.push(
        outcome.status === "fulfilled"
          ? outcome.value
          : { ok: false, error: String(outcome.reason) }
      );
    }

    // Durable pacing between compartments
    if (i + maxConcurrency < items.length) {
      await sleep("1s");
    }
  }

  return { results, compartments: compartmentIndex };
}

async function processItem(item: string, compartment: number, idx: number) {
  "use step";
  // Each item is isolated — a failure here won't affect other items
  const result = await callExternalService(item);
  return { item, compartment, ok: true, ...result };
}
```

<!-- split -->

Each compartment is a durable step. Steps run in parallel. A failure in one step doesn't cancel or affect the others.

Add `sleep()` between compartment groups to control throughput. The sleep is durable. Crash between groups and it picks up on schedule.

<!-- split -->

No thread pools. No dead letter queues. No process boundaries. Each item is isolated by the step boundary itself.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Parallel, isolated, durable"

Process items in parallel. Isolate failures. Retry individually. Resume after crashes.

That's four requirements. Traditionally, four different pieces of infrastructure.

With WDK, it's one pattern:

```ts
export async function bulkhead(
  jobId: string,
  items: string[],
  maxConcurrency: number
) {
  "use workflow";

  const results = [];
  let compartmentIndex = 0;

  for (let i = 0; i < items.length; i += maxConcurrency) {
    compartmentIndex++;
    const batch = items.slice(i, i + maxConcurrency);

    // Run compartment in parallel — failures are isolated
    const outcomes = await Promise.allSettled(
      batch.map((item, idx) => processItem(item, compartmentIndex, idx))
    );

    for (const outcome of outcomes) {
      results.push(
        outcome.status === "fulfilled"
          ? outcome.value
          : { ok: false, error: String(outcome.reason) }
      );
    }

    // Durable pacing between compartments
    if (i + maxConcurrency < items.length) {
      await sleep("1s");
    }
  }

  return { results, compartments: compartmentIndex };
}

async function processItem(item: string, compartment: number, idx: number) {
  "use step";
  // Each item is isolated — a failure here won't affect other items
  const result = await callExternalService(item);
  return { item, compartment, ok: true, ...result };
}
```

<!-- split -->

`Promise.allSettled()` runs all compartments in parallel. Each is a `"use step"`, durable and independently retriable. Failures are captured, not thrown.

`sleep()` between batches of compartments adds backpressure. Durable backpressure that survives restarts.

<!-- split -->

No orchestrator. No worker pools. No error boundary frameworks. Parallel steps, settled results, full isolation.

Explore the interactive demo on v0: {v0_link}
