---
slug: retryable-rate-limit
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-retryable-rate-limit
primitive: RetryableError with retryAfter
pick: null
---

# Retryable Rate Limit — CRM Contact Sync

Sync a contact to an external CRM API, automatically retrying when the API returns 429 with a retry-after header.

## Variant A — "The API said wait"


You hit the CRM API. It returns 429. The `retry-after` header says 30 seconds.

Traditional: parse the header, calculate backoff, store retry state, schedule a delayed job, hope the worker picks it up at the right time.

With WDK you throw `new RetryableError()` with `retryAfter` and the runtime handles the rest:

```ts
import { RetryableError } from "workflow";

export async function syncCrmContact(contactId: string) {
  "use workflow";

  const contact = await fetchContact(contactId);
  await upsertIntoWarehouse(contactId, contact);
  return { contactId, status: "synced" };
}

async function fetchContact(contactId: string) {
  "use step";

  const res = await fetch(`https://crm.example.com/contacts/${contactId}`);

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("retry-after") ?? "30") * 1000;
    throw new RetryableError("CRM rate-limited (429)", { retryAfter });
  }

  return res.json();
}
```

<!-- split -->

`RetryableError` tells the runtime: "this failed, but try again." The `retryAfter` property tells it exactly when. The workflow durably pauses and resumes at the right moment.

No retry queue. No backoff calculator. No scheduled job.

<!-- split -->

Hit the API. Get rate-limited. Throw `RetryableError`. Wait exactly as long as the API asked. Retry. Done.

No cron. No retry table. No exponential backoff library.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Retry-after without the retry infrastructure"

Every API has rate limits. Every integration needs retry logic. Traditionally that means: parse headers, implement exponential backoff, store retry state per request, and run a scheduler.

WDK reduces it to one error class:

```ts
import { RetryableError } from "workflow";

export async function syncCrmContact(contactId: string) {
  "use workflow";

  const contact = await fetchContact(contactId);
  await upsertIntoWarehouse(contactId, contact);
  return { contactId, status: "synced" };
}

async function fetchContact(contactId: string) {
  "use step";

  const res = await fetch(`https://crm.example.com/contacts/${contactId}`);

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("retry-after") ?? "30") * 1000;
    throw new RetryableError("CRM rate-limited (429)", { retryAfter });
  }

  return res.json();
}
```

<!-- split -->

Catch a 429. Read the `retry-after` header. Throw `new RetryableError("Rate limited", { retryAfter: seconds })`.

The runtime pauses the workflow for exactly that duration, durably. No timer service. No job queue. The step just re-runs when the time is up.

<!-- split -->

Your retry logic is three lines: catch, read header, throw. The infrastructure does the waiting.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Rate limits are a sleep problem"

Rate limiting is fundamentally simple: wait, then try again. But building "wait durably" from scratch is a whole system: retry queues, state persistence, timer workers.

WDK makes it one throw:

```ts
import { RetryableError } from "workflow";

export async function syncCrmContact(contactId: string) {
  "use workflow";

  const contact = await fetchContact(contactId);
  await upsertIntoWarehouse(contactId, contact);
  return { contactId, status: "synced" };
}

async function fetchContact(contactId: string) {
  "use step";

  const res = await fetch(`https://crm.example.com/contacts/${contactId}`);

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("retry-after") ?? "30") * 1000;
    throw new RetryableError("CRM rate-limited (429)", { retryAfter });
  }

  return res.json();
}
```

<!-- split -->

`RetryableError` vs `FatalError`. That's the entire retry vocabulary. Retryable means try again. The optional `retryAfter` tells the runtime how long to wait. Fatal means stop.

The wait is durable. Deploy during the pause? Restart the server? The retry still fires on schedule.

<!-- split -->

Sync a CRM contact. Respect rate limits. Retry automatically. No backoff library. No retry queue. No scheduler.

Explore the interactive demo on v0: {v0_link}
