---
slug: bulkhead
day: null
v0_url: https://v0.app/chat/0LXZOKw1AbS
primitive: Promise.allSettled() + sleep()
pick: null
---

# Bulkhead — Isolated Parallel Processing

Partition items into isolated compartments processed in parallel. One failure doesn't sink the others.

## Variant A — "One bad item sinks the whole batch"

Processing 20 items in parallel sounds great until item 7 throws and tanks the whole batch.

`Promise.allSettled()` over durable steps gives you isolation and a per-item outcome map.

<!-- split -->

Each item runs in its own `"use step"` — failures stay contained. `Promise.allSettled()` collects every result, successes and failures alike.

`sleep()` between groups paces throughput. The sleep is durable, so a crash just resumes on schedule.

<!-- split -->

No thread pools. No process isolation. No dead letter queues. No manual error boundaries. Each item is isolated by the step boundary itself, and you get a complete outcome map for free.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Pacing without a rate limiter"

You have 200 items and a downstream API that chokes past 20 concurrent requests. Skip the rate limiter — chunk items into compartments.

Run each group through `Promise.allSettled()`, then `sleep()` between batches.

<!-- split -->

Each compartment runs items as parallel durable steps. When it finishes, the workflow sleeps before the next batch. Crash between compartments? It wakes on schedule.

Every item is tracked individually regardless of which compartment ran it.

<!-- split -->

No external rate limiter. No token bucket. No queue manager. Just chunked parallel execution with durable pauses between batches.

Explore the interactive demo on v0: {v0_link}

## Variant C — "The complete outcome map"

You processed 50 items. Three failed. Which three? When you catch errors globally, you lose the per-item detail. When you fail fast, you lose the other 47 results.

`Promise.allSettled()` gives you the full picture — every item reports its own success or failure.

<!-- split -->

Each item is its own durable step inside `Promise.allSettled()`. Failures stay in the step that threw. Successes complete independently. The settled array is your outcome map.

`sleep()` between batches paces throughput — no external rate limiter needed.

<!-- split -->

No dead letter queue to drain. No error log to correlate. No manual retry list to build. The settled results are the outcome map, and every item's fate is accounted for.

Explore the interactive demo on v0: {v0_link}
