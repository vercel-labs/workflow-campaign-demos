---
slug: async-request-reply
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-async-request-reply
primitive: createWebhook() + Promise.race() + sleep()
pick: null
---

# Async Request-Reply — Wait for the Callback

Submit a request to a vendor API, wait for an async callback via webhook, handle duplicates and timeouts gracefully.

## Variant A — "Fire and wait"


You POST to a vendor. They process it async and hit your webhook when done. Could be 5 seconds. Could be 5 hours.

Traditional: a correlation table mapping request IDs to callbacks, webhook retry logic, and a pub/sub subscription to glue it together.

With WDK, it's `createWebhook()` and a `Promise.race()`:

```ts
import { createWebhook, sleep } from "workflow";

async function asyncRequestReply(documentId) {
  "use workflow";

  const webhook = createWebhook({ respondWith: "manual" });
  await submitVerification(documentId, webhook.token);

  const result = await Promise.race([
    (async () => {
      for await (const request of webhook) {
        const body = await request.json();
        await request.respondWith(Response.json({ ack: true }));
        return body.status === "approved"
          ? { outcome: "verified" }
          : { outcome: "rejected" };
      }
    })(),
    sleep("30s").then(() => ({ outcome: "timed_out" })),
  ]);

  return { documentId, ...result };
}
```

<!-- split -->

`createWebhook()` generates a unique callback URL tied to this workflow run. Send it with your request. The vendor calls it when they're ready.

`Promise.race()` pits the webhook against `sleep("1h")`. Response arrives? Continue. Timeout wins? Handle the failure. No polling in between.

<!-- split -->

No correlation table. No pub/sub. No webhook retry handler. One URL, one race, one timeout.

Explore the interactive demo on v0: {v0_link}

## Variant B — "The callback problem"

Your vendor doesn't do synchronous responses. They accept the request and POST back later. Every integration like this needs the same boilerplate.

Correlation ID. Webhook endpoint. Dedup logic. Timeout sweep. Four pieces of infrastructure for one API call.

WDK collapses it to two primitives:

```ts
import { createWebhook, sleep } from "workflow";

async function asyncRequestReply(documentId) {
  "use workflow";

  const webhook = createWebhook({ respondWith: "manual" });
  await submitVerification(documentId, webhook.token);

  const result = await Promise.race([
    (async () => {
      for await (const request of webhook) {
        const body = await request.json();
        await request.respondWith(Response.json({ ack: true }));
        return body.status === "approved"
          ? { outcome: "verified" }
          : { outcome: "rejected" };
      }
    })(),
    sleep("30s").then(() => ({ outcome: "timed_out" })),
  ]);

  return { documentId, ...result };
}
```

<!-- split -->

`createWebhook()` gives you a URL that resolves a promise inside your workflow. No shared database. No routing table. The URL is scoped to this exact run.

Duplicate callbacks? The webhook resolves once and ignores the rest. The durable step already recorded the result.

<!-- split -->

No dedup table. No correlation database. No timeout cron. Submit, wait, continue.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Webhooks without the plumbing"

Every async vendor integration starts the same way: build a webhook handler, store a correlation ID, set up a timeout, handle retries.

Then do it again for the next vendor. And again.

WDK makes webhooks a primitive:

```ts
import { createWebhook, sleep } from "workflow";

async function asyncRequestReply(documentId) {
  "use workflow";

  const webhook = createWebhook({ respondWith: "manual" });
  await submitVerification(documentId, webhook.token);

  const result = await Promise.race([
    (async () => {
      for await (const request of webhook) {
        const body = await request.json();
        await request.respondWith(Response.json({ ack: true }));
        return body.status === "approved"
          ? { outcome: "verified" }
          : { outcome: "rejected" };
      }
    })(),
    sleep("30s").then(() => ({ outcome: "timed_out" })),
  ]);

  return { documentId, ...result };
}
```

<!-- split -->

`createWebhook()` returns a URL. Pass it to the vendor. When they call it, your workflow resumes with the payload. That's it.

`sleep()` provides the timeout. `Promise.race()` picks the winner. The entire request-reply cycle is a few lines.

<!-- split -->

No webhook router. No correlation store. No retry logic. Each vendor integration is self-contained in one workflow.

Explore the interactive demo on v0: {v0_link}
