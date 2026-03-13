---
slug: dead-letter-queue
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-dead-letter-queue
primitive: built-in retry with attempt tracking via getStepMetadata()
pick: null
---

# Dead Letter Queue — Undeliverable Message Handling

Process messages with automatic retries. After max retries, route undeliverable messages to a dead letter queue instead of losing them silently.

## Variant A — "Where do failed messages go?"


Your message processor retries 3 times. All 3 fail. Where does the message go? Nowhere. It vanishes. You find out when a customer complains.

Traditional: a manual retry counter, a DLQ table, a separate worker to process dead letters, and alerting on DLQ depth.

Or you track attempts with `getStepMetadata()` and route failures durably:

```ts
import { getStepMetadata } from "workflow";

const MAX_ATTEMPTS = 3;

export async function deadLetterQueue(messages: string[]) {
  "use workflow";

  const results = [];
  for (const messageId of messages) {
    results.push(await processMessage(messageId));
  }
  return results;
}

async function processMessage(messageId: string) {
  "use step";

  const { attempt } = getStepMetadata();

  try {
    const result = await deliverMessage(messageId);
    return { messageId, status: "delivered", attempts: attempt };
  } catch (error) {
    if (attempt >= MAX_ATTEMPTS) {
      // Route to DLQ instead of retrying forever
      return { messageId, status: "dead_lettered", attempts: attempt, error };
    }
    throw error; // Let the runtime retry
  }
}
```

<!-- split -->

The workflow knows its own attempt count. After N failures, it writes the message to a dead letter step instead of retrying again. The DLQ is just another durable step, not a separate system.

No DLQ table. No sweep worker. No silent drops.

<!-- split -->

Message arrives. Step fails. Retry 1, retry 2, retry 3. All fail. Message routes to DLQ step with full context: error, payload, attempt history.

Nothing lost. Everything inspectable.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Retry-aware workflows"

Most retry logic is bolted on. You wrap a try/catch in a loop, increment a counter, check a threshold, then... hope you remembered to persist the failed message somewhere.

`getStepMetadata()` gives you the attempt count natively:

```ts
import { getStepMetadata } from "workflow";

const MAX_ATTEMPTS = 3;

export async function deadLetterQueue(messages: string[]) {
  "use workflow";

  const results = [];
  for (const messageId of messages) {
    results.push(await processMessage(messageId));
  }
  return results;
}

async function processMessage(messageId: string) {
  "use step";

  const { attempt } = getStepMetadata();

  try {
    const result = await deliverMessage(messageId);
    return { messageId, status: "delivered", attempts: attempt };
  } catch (error) {
    if (attempt >= MAX_ATTEMPTS) {
      // Route to DLQ instead of retrying forever
      return { messageId, status: "dead_lettered", attempts: attempt, error };
    }
    throw error; // Let the runtime retry
  }
}
```

<!-- split -->

The workflow tracks retries as part of its durable state. No external counter. No Redis key with a TTL. When attempts exceed the threshold, a `FatalError` stops retries and a DLQ step captures the message.

Crash between retry 2 and 3? It resumes at retry 3. Not retry 1.

<!-- split -->

No manual retry loops. No separate DLQ worker. No lost messages. The workflow is the retry policy and the dead letter queue.

Explore the interactive demo on v0: {v0_link}

## Variant C — "The last stop for bad messages"

Every message processing system needs a dead letter queue. Most teams build it as a separate service: a table, a worker, an alert, a dashboard.

With WDK, the DLQ is a step in the same workflow:

```ts
import { getStepMetadata } from "workflow";

const MAX_ATTEMPTS = 3;

export async function deadLetterQueue(messages: string[]) {
  "use workflow";

  const results = [];
  for (const messageId of messages) {
    results.push(await processMessage(messageId));
  }
  return results;
}

async function processMessage(messageId: string) {
  "use step";

  const { attempt } = getStepMetadata();

  try {
    const result = await deliverMessage(messageId);
    return { messageId, status: "delivered", attempts: attempt };
  } catch (error) {
    if (attempt >= MAX_ATTEMPTS) {
      // Route to DLQ instead of retrying forever
      return { messageId, status: "dead_lettered", attempts: attempt, error };
    }
    throw error; // Let the runtime retry
  }
}
```

<!-- split -->

`getStepMetadata()` exposes the attempt number. Your workflow checks it, decides to retry or route to dead letter. Both paths are durable steps. Both survive crashes.

The dead letter step captures the original payload, the error, and the full attempt history. No data loss.

<!-- split -->

Process. Fail. Retry. Fail again. Route to DLQ. All in one file. All durable. All observable.

Explore the interactive demo on v0: {v0_link}
