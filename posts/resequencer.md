---
slug: resequencer
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-resequencer
primitive: Promise.race() + defineHook() + buffer management
pick: null
---

# Resequencer — Out-of-Order Message Reassembly

Buffer out-of-order message fragments arriving via webhook and release them in correct sequence as each piece lands.

## Variant A — "Messages arrive out of order"


Fragment 3 arrives. Then fragment 1. Then fragment 4. Then fragment 2. You need to emit them 1-2-3-4.

Traditional: a resequencing service, a buffer store, sequence validation logic, a periodic drain job, and timeout handling for missing fragments.

With WDK you buffer in workflow state and release on each `defineHook()` call:

```ts
import { defineHook } from "workflow";

export const fragmentHook = defineHook<{ seq: number; payload: string }>();

export async function resequencer(batchId: string, expectedCount: number) {
  "use workflow";

  const hooks = [];
  for (let i = 1; i <= expectedCount; i++) {
    hooks.push({ seq: i, hook: fragmentHook.create({ token: `${batchId}:${i}` }) });
  }

  const buffer = new Map();
  const ordered = [];
  let nextExpected = 1;
  const pending = new Map(hooks.map(({ seq, hook }) => [seq, hook.then(d => ({ seq, payload: d.payload }))]));

  while (ordered.length < expectedCount) {
    const result = await Promise.race([...pending.values()]);
    pending.delete(result.seq);

    if (result.seq === nextExpected) {
      ordered.push(result.payload);
      nextExpected++;
      while (buffer.has(nextExpected)) {
        ordered.push(buffer.get(nextExpected));
        buffer.delete(nextExpected++);
      }
    } else {
      buffer.set(result.seq, result.payload);
    }
  }

  return { batchId, ordered };
}
```

<!-- split -->

Each incoming fragment triggers a hook. The workflow checks: is this the next expected sequence number? If yes, release it and flush any buffered successors. If no, buffer it.

The buffer is just workflow state. Durable. No external store.

<!-- split -->

Fragments arrive in any order. They leave in the right order. No buffer database. No drain cron. No resequencing service.

One workflow. One buffer. Correct ordering.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Ordering without a queue"

Out-of-order delivery is a fact of distributed systems. The standard fix: a dedicated resequencing service with a buffer store, sequence tracking, and a timer to flush stale entries.

WDK replaces all of it with a hook and a loop:

```ts
import { defineHook } from "workflow";

export const fragmentHook = defineHook<{ seq: number; payload: string }>();

export async function resequencer(batchId: string, expectedCount: number) {
  "use workflow";

  const hooks = [];
  for (let i = 1; i <= expectedCount; i++) {
    hooks.push({ seq: i, hook: fragmentHook.create({ token: `${batchId}:${i}` }) });
  }

  const buffer = new Map();
  const ordered = [];
  let nextExpected = 1;
  const pending = new Map(hooks.map(({ seq, hook }) => [seq, hook.then(d => ({ seq, payload: d.payload }))]));

  while (ordered.length < expectedCount) {
    const result = await Promise.race([...pending.values()]);
    pending.delete(result.seq);

    if (result.seq === nextExpected) {
      ordered.push(result.payload);
      nextExpected++;
      while (buffer.has(nextExpected)) {
        ordered.push(buffer.get(nextExpected));
        buffer.delete(nextExpected++);
      }
    } else {
      buffer.set(result.seq, result.payload);
    }
  }

  return { batchId, ordered };
}
```

<!-- split -->

`defineHook()` receives each fragment. `Promise.race()` waits for the next one or a timeout. The workflow holds a buffer in local state, durable across restarts.

When the next expected fragment arrives, release it. If buffered fragments now form a contiguous run, flush them all.

<!-- split -->

No buffer database. No sequence validation service. No periodic drain. Just a workflow that holds fragments until they're ready.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Durable buffering in 50 lines"

Building a resequencer from scratch means: a buffer store, sequence tracking, gap detection, timeout handling, and a drain mechanism. That's a microservice.

WDK makes the workflow itself the buffer:

```ts
import { defineHook } from "workflow";

export const fragmentHook = defineHook<{ seq: number; payload: string }>();

export async function resequencer(batchId: string, expectedCount: number) {
  "use workflow";

  const hooks = [];
  for (let i = 1; i <= expectedCount; i++) {
    hooks.push({ seq: i, hook: fragmentHook.create({ token: `${batchId}:${i}` }) });
  }

  const buffer = new Map();
  const ordered = [];
  let nextExpected = 1;
  const pending = new Map(hooks.map(({ seq, hook }) => [seq, hook.then(d => ({ seq, payload: d.payload }))]));

  while (ordered.length < expectedCount) {
    const result = await Promise.race([...pending.values()]);
    pending.delete(result.seq);

    if (result.seq === nextExpected) {
      ordered.push(result.payload);
      nextExpected++;
      while (buffer.has(nextExpected)) {
        ordered.push(buffer.get(nextExpected));
        buffer.delete(nextExpected++);
      }
    } else {
      buffer.set(result.seq, result.payload);
    }
  }

  return { batchId, ordered };
}
```

<!-- split -->

Fragments arrive via `defineHook()`. The workflow stores them in an array, sorted by sequence number. When the next expected number is present, it emits and advances.

Crash mid-reassembly? The buffer survives. The sequence pointer survives. It picks up exactly where it left off.

<!-- split -->

Receive out of order. Emit in order. Survive crashes. No external state.

Explore the interactive demo on v0: {v0_link}
