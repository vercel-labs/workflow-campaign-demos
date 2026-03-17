---
slug: dead-letter-queue
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-dead-letter-queue
primitive: built-in retry with attempt tracking via getStepMetadata()
pick: null
---

# Dead Letter Queue — Undeliverable Message Handling

Process messages with automatic retries. After max retries, route undeliverable messages to a dead letter queue instead of losing them silently.

## Variant A — "Where do failed messages go?"

Your message processor retries 3 times. All 3 fail. Where does the message go? Nowhere. It vanishes. You find out when a customer complains.

Traditionally that means a manual retry counter, a DLQ table, a separate worker to process dead letters, and alerting on DLQ depth.

`getStepMetadata()` exposes the attempt number natively. Your workflow checks it and decides to retry or route to dead letter.

<!-- split -->

Below the threshold, throw the error and let the runtime retry automatically. At the limit, catch the error and write the message to a dead letter step instead.

Both paths are durable steps. Both survive crashes. Crash between retry 2 and 3? It resumes at retry 3, not retry 1.

<!-- split -->

No manual retry loops. No separate DLQ worker. No silent drops. The workflow is the retry policy and the dead letter queue, all in one file.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Retry and dead-letter in the same step"

Retry logic lives in one service. Dead letter routing lives in another. A message fails, gets retried by service A, exhausts retries, and needs to be routed by service B. That handoff is where messages get lost.

`getStepMetadata()` gives you the attempt number inside the step itself. Check the number, decide the fate. Below the limit, throw and let the runtime retry. At the limit, route to a dead letter step. Same file. Same workflow.

<!-- split -->

The routing decision happens at the point of failure, not in a separate system. No handoff. No message bus between the retry service and the DLQ service. The step knows its own attempt count and acts on it.

Both the retry path and the dead letter path are durable. A crash between any attempt resumes exactly where it left off.

<!-- split -->

No retry service. No DLQ service. No handoff protocol. No lost messages in transit between systems. The retry policy and the dead letter route are two branches of the same conditional.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Know the attempt number without counting it yourself"

You implement retry logic. You need a counter. You store it in a database or pass it through a message header. You increment it on each attempt. You check it before each retry. You handle the off-by-one error.

`getStepMetadata()` gives you the attempt number for free. The runtime already tracks it. Your code reads the number and makes a decision. No counter variable. No database column. No message header.

<!-- split -->

Attempt one fails? The runtime retries automatically and increments the counter. Attempt two fails? Same thing. Attempt three fails and `getStepMetadata()` reports attempt three? Route to dead letter instead of throwing.

The step metadata is native to the runtime. It survives crashes. It is always accurate. It cannot drift from the actual attempt count.

<!-- split -->

No manual counter. No counter persistence. No off-by-one bugs. The runtime counts attempts natively, and `getStepMetadata()` exposes that count to your decision logic.

Explore the interactive demo on v0: {v0_link}
