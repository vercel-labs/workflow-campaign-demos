---
slug: fan-out
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-fan-out
primitive: Promise.allSettled() + FatalError
pick: null
---

# Fan-Out — Parallel Incident Alerting

Broadcast an incident alert to 4 channels (Slack, email, SMS, PagerDuty) in parallel. Handle transient and permanent failures independently per channel.

## Variant A — "The sequential bottleneck"

Sending an alert to four channels sequentially means the last channel waits for the first three.

If you send them in parallel without coordination, you lose track of which specific channels failed.

`Promise.allSettled()` provides the best of both worlds.

<!-- split -->

Using `Promise.allSettled()` provides parallel execution alongside per-channel failure tracking.

Each step is independent, so throwing a `FatalError` stops retries for that specific channel while the others continue.

<!-- split -->

This setup handles transient retries automatically while stopping permanent failures immediately.

You can track everything without a coordinator service, dead letter queues, or complex retry policies.

Explore the interactive demo on v0: {v0_link}

## Variant B — "What happens when one channel is permanently dead?"

SMS provider is down for good. Email is slow. PagerDuty works fine. You need all three results, not just the first failure.

`Promise.all()` would reject the moment SMS fails. `Promise.allSettled()` waits for every channel and reports each result individually.

<!-- split -->

Throw a FatalError inside the SMS step and it stops retrying immediately. Email keeps retrying transient errors. PagerDuty completes first attempt. All three run in parallel.

The settled results tell you exactly which channels succeeded, retried, or gave up.

<!-- split -->

No coordinator service. No per-channel retry policies. No dead letter queue. Parallel steps with independent failure handling in a single `Promise.allSettled()` call.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Retryable vs fatal, per channel"

Transient errors should retry. Permanent errors should stop. And you need that decision made per channel, not globally.

`FatalError` is the kill switch for a single step. Throw it and retries stop for that step only. Every other step continues independently.

<!-- split -->

Wrap all four channel steps in `Promise.allSettled()`. Each step handles its own retry logic. A 500 from the SMS provider? Retries automatically. An invalid API key? `FatalError` stops it cold.

The workflow completes when every channel has either succeeded or permanently failed.

<!-- split -->

No global error handler deciding the fate of all channels. No retry configuration spread across services. Each channel owns its failure mode, and `Promise.allSettled()` collects the results.

Explore the interactive demo on v0: {v0_link}
