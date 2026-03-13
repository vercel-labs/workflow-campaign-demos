---
slug: fan-out
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-fan-out
primitive: Promise.allSettled() + FatalError
pick: null
---

# Fan-Out — Parallel Incident Alerting

Broadcast an incident alert to 4 channels (Slack, email, SMS, PagerDuty) in parallel. Handle transient and permanent failures independently per channel.

## Variant A — "Four channels, zero coordination"


Incident fires. Notify Slack, email, SMS, and PagerDuty, all in parallel. If SMS fails, don't block Slack.

Fan out with `Promise.allSettled()` and let each channel fail independently:

```ts
import { FatalError } from "workflow";

export async function incidentFanOut(incidentId: string, message: string) {
  "use workflow";

  const settled = await Promise.allSettled([
    sendSlackAlert(incidentId, message),
    sendEmailAlert(incidentId, message),
    sendSmsAlert(incidentId, message),
    sendPagerDutyAlert(incidentId, message),
  ]);

  const deliveries = settled.map((result, i) =>
    result.status === "fulfilled"
      ? { channel: channels[i], status: "sent", providerId: result.value.providerId }
      : { channel: channels[i], status: "failed", error: result.reason }
  );

  return { incidentId, deliveries };
}

async function sendSlackAlert(incidentId: string, message: string) {
  "use step";
  // Transient errors retry automatically
  // FatalError stops retries for permanent failures
  const response = await slack.post(message);
  if (response.status === 403) throw new FatalError("Invalid API key");
  return { providerId: response.id };
}
```

<!-- split -->

Each channel is a durable step. `Promise.allSettled()` runs all four in parallel. Transient failures retry automatically. Permanent failures throw `FatalError`. No retry, no blocking other channels.

No callback coordinator. No partial failure table. The workflow tracks it all.

<!-- split -->

Slack: delivered. Email: delivered. SMS: carrier down, retrying. PagerDuty: invalid API key, `FatalError`.

Three succeed. One permanently fails. You know exactly what happened and why.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Parallel delivery with independent failure"

Sending an alert to four channels sequentially means channel 4 waits for channels 1–3. Sending in parallel without coordination means you don't know what failed.

`Promise.allSettled()` gives you both: parallel execution and per-channel failure tracking.

```ts
import { FatalError } from "workflow";

export async function incidentFanOut(incidentId: string, message: string) {
  "use workflow";

  const settled = await Promise.allSettled([
    sendSlackAlert(incidentId, message),
    sendEmailAlert(incidentId, message),
    sendSmsAlert(incidentId, message),
    sendPagerDutyAlert(incidentId, message),
  ]);

  const deliveries = settled.map((result, i) =>
    result.status === "fulfilled"
      ? { channel: channels[i], status: "sent", providerId: result.value.providerId }
      : { channel: channels[i], status: "failed", error: result.reason }
  );

  return { incidentId, deliveries };
}

async function sendSlackAlert(incidentId: string, message: string) {
  "use step";
  // Transient errors retry automatically
  // FatalError stops retries for permanent failures
  const response = await slack.post(message);
  if (response.status === 403) throw new FatalError("Invalid API key");
  return { providerId: response.id };
}
```

<!-- split -->

Each step is independent. FatalError marks a channel as permanently failed. The SDK stops retrying it but lets the others continue.

Transient failures retry automatically. Permanent failures stop immediately.

<!-- split -->

No retry policy per client. No coordinator service. No dead letter queue for failed notifications. Four steps, one `allSettled`, one file.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Broadcast without the message broker"

Traditional fan-out needs a message broker, subscriber queues, and retry policies per subscriber. That's infrastructure for what should be a function call.

WDK fan-out is `Promise.allSettled()` over durable steps:

```ts
import { FatalError } from "workflow";

export async function incidentFanOut(incidentId: string, message: string) {
  "use workflow";

  const settled = await Promise.allSettled([
    sendSlackAlert(incidentId, message),
    sendEmailAlert(incidentId, message),
    sendSmsAlert(incidentId, message),
    sendPagerDutyAlert(incidentId, message),
  ]);

  const deliveries = settled.map((result, i) =>
    result.status === "fulfilled"
      ? { channel: channels[i], status: "sent", providerId: result.value.providerId }
      : { channel: channels[i], status: "failed", error: result.reason }
  );

  return { incidentId, deliveries };
}

async function sendSlackAlert(incidentId: string, message: string) {
  "use step";
  // Transient errors retry automatically
  // FatalError stops retries for permanent failures
  const response = await slack.post(message);
  if (response.status === 403) throw new FatalError("Invalid API key");
  return { providerId: response.id };
}
```

<!-- split -->

Four steps run in parallel. Each is independently durable, with crash recovery per channel, not per broadcast. `FatalError` distinguishes "stop trying" from "try again."

The workflow is the broker. The steps are the subscribers. The runtime handles delivery guarantees.

<!-- split -->

Incident alert to Slack, email, SMS, PagerDuty. Parallel. Durable. Independent failure domains. One file.

Explore the interactive demo on v0: {v0_link}
