---
slug: async-request-reply
day: null
v0_url: https://v0.app/chat/fHayA1ZXNcZ
primitive: createWebhook() + Promise.race() + sleep()
pick: null
---

# Async Request-Reply — Wait for the Callback

Submit a request to a vendor API, wait for an async callback via webhook, handle duplicates and timeouts gracefully.

## Variant A — "Wait for the callback without polling"

You POST to a vendor. They call your webhook when done. Could be 5 seconds or 5 hours.

`createWebhook()` gives you a unique callback URL tied to this run. Pass it with the request. When the vendor's ready, they hit it.

<!-- split -->

`Promise.race()` pits the webhook against `sleep("1h")`. Response arrives? Continue. Timeout? Handle failure. No polling.

Duplicate callbacks? Ignored. The durable step recorded the result on the first one.

<!-- split -->

No correlation table. No pub/sub. No webhook retry handler. No dedup table. One URL, one race, one timeout.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Duplicate callbacks are a non-issue"

Vendor webhook fires 3x because their retry logic is aggressive. Your handler runs downstream logic 3x. Duplicate charges, emails, records.

`createWebhook()` ties the callback to a durable step. First call resolves it. Retries hit a completed step and get ignored.

<!-- split -->

No dedup table. No idempotency key. The durable step is the dedup mechanism. A resolved step cannot resolve again.

`Promise.race()` vs `sleep("1h")` adds a timeout. Vendor never calls back? Sleep wins, workflow handles the failure.

<!-- split -->

No correlation table to match callbacks to requests. No dedup logic to filter retries. No pub/sub to bridge the gap. The webhook URL is the correlation. The durable step is the dedup. The race is the timeout.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Five hours between request and response"

You send a request. The vendor takes 5 hours. Your serverless function timed out 4:59 ago. The callback arrives to nothing.

`createWebhook()` gives you a URL the runtime manages. Workflow sleeps durably. Vendor calls back hours later — runtime wakes it up.

<!-- split -->

Nothing runs while it waits. No long-lived connection. No server holding state. The webhook is the wake-up signal.

`Promise.race()` against `sleep()` caps the wait. Vendor too slow? Timeout wins, workflow takes the fallback path.

<!-- split -->

No long-running process. No connection pool. No keep-alive. The workflow submits the request, goes to sleep, and wakes up when the answer arrives. Minutes or hours, same pattern.

Explore the interactive demo on v0: {v0_link}
