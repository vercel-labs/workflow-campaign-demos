---
slug: scheduled-digest
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-scheduled-digest
primitive: defineHook() + Promise.race() + sleep()
pick: null
---

# Scheduled Digest — Time-Windowed Event Collection

Open a time window, collect events via webhook during the window, then email a digest when the window closes.

## Variant A — "Collect now, send later"


Open a 1-hour window. Events arrive via webhook: 3, 10, maybe 50. When the hour ends, bundle them into one email digest.

Traditional: an event queue, a background job that fires at window boundaries, a pub/sub system for incoming events, and a separate aggregation service.

With WDK you combine `defineHook()`, `Promise.race()`, and `sleep()`:

```ts
import { sleep, defineHook } from "workflow";

export const digestEvent = defineHook<DigestEventPayload>();

export async function collectAndSendDigest(digestId: string, userId: string, windowMs: number) {
  "use workflow";

  const hook = digestEvent.create({ token: `digest:${digestId}` });
  const windowClosed = sleep(`${windowMs}ms`).then(() => ({ kind: "window_closed" as const }));
  const events: DigestEventPayload[] = [];

  while (true) {
    const outcome = await Promise.race([
      hook.then((payload) => ({ kind: "event" as const, payload })),
      windowClosed,
    ]);

    if (outcome.kind === "window_closed") break;
    events.push(outcome.payload);
  }

  if (events.length > 0) await sendDigestEmail(userId, events);
}
```

<!-- split -->

`defineHook()` receives events during the window. `sleep("1h")` sets the deadline. `Promise.race()` lets the workflow process each incoming event while waiting for the timer.

When the sleep resolves, the window closes. Aggregate. Send the digest.

<!-- split -->

No event queue. No aggregation service. No cron job. One workflow that collects, waits, and sends.

Explore the interactive demo on v0: {v0_link}

## Variant B — "A time window is just a sleep"

You need to batch events into a digest. Open a window, collect everything that arrives, close the window, send the email.

Traditional: a queue for incoming events, a scheduler to close the window, an aggregator to build the digest, and a sender. Four moving parts.

WDK needs three primitives:

```ts
import { sleep, defineHook } from "workflow";

export const digestEvent = defineHook<DigestEventPayload>();

export async function collectAndSendDigest(digestId: string, userId: string, windowMs: number) {
  "use workflow";

  const hook = digestEvent.create({ token: `digest:${digestId}` });
  const windowClosed = sleep(`${windowMs}ms`).then(() => ({ kind: "window_closed" as const }));
  const events: DigestEventPayload[] = [];

  while (true) {
    const outcome = await Promise.race([
      hook.then((payload) => ({ kind: "event" as const, payload })),
      windowClosed,
    ]);

    if (outcome.kind === "window_closed") break;
    events.push(outcome.payload);
  }

  if (events.length > 0) await sendDigestEmail(userId, events);
}
```

<!-- split -->

`defineHook()` is the webhook endpoint that pushes events into the running workflow. `sleep()` is the durable timer that defines the window. `Promise.race()` is the glue that processes events while the timer ticks.

The workflow is the queue, the scheduler, and the aggregator. All in one.

<!-- split -->

Open window. Collect events. Close window. Send digest. Four lines of intent, zero infrastructure.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Webhooks during a durable sleep"

The interesting part isn't the sleep. It's that the workflow can receive webhooks while sleeping.

`defineHook()` keeps the door open. Events arrive and get buffered in workflow state. When `sleep()` completes, you have everything that came in during the window:

```ts
import { sleep, defineHook } from "workflow";

export const digestEvent = defineHook<DigestEventPayload>();

export async function collectAndSendDigest(digestId: string, userId: string, windowMs: number) {
  "use workflow";

  const hook = digestEvent.create({ token: `digest:${digestId}` });
  const windowClosed = sleep(`${windowMs}ms`).then(() => ({ kind: "window_closed" as const }));
  const events: DigestEventPayload[] = [];

  while (true) {
    const outcome = await Promise.race([
      hook.then((payload) => ({ kind: "event" as const, payload })),
      windowClosed,
    ]);

    if (outcome.kind === "window_closed") break;
    events.push(outcome.payload);
  }

  if (events.length > 0) await sendDigestEmail(userId, events);
}
```

<!-- split -->

`Promise.race([hook.wait(), sleep("1h")])` processes events as they arrive, but stops collecting when the hour is up. Each event is durably stored. Crash mid-window? Resume with all previously collected events intact.

No external event store. The workflow is the buffer.

<!-- split -->

Collect for an hour. Send one digest. Survive any crash during the window. No queue. No cron. No aggregation service.

Explore the interactive demo on v0: {v0_link}
