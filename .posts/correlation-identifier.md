---
slug: correlation-identifier
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-correlation-identifier
primitive: sleep() + getWritable() for request/response pairing
pick: null
---

# Correlation Identifier — Async Request/Response Matching

Tag each outbound async request with a unique correlation ID so the response can be matched back to the original caller.

## Variant A — "Fire and forget, then match later"

You send a request to an external service. Minutes later, a response arrives on a webhook. How do you know which request it belongs to?

Stamp a unique correlation ID on every outbound request. When the response comes back, match it by that ID. No shared state, no polling.

<!-- split -->

The workflow generates a correlation ID, attaches it to the request, then uses `sleep()` to durably wait for the async response. When it arrives, the correlation ID links it back to the original request.

If the response never arrives, `sleep()` expires and the workflow marks it as timed out — no orphaned requests, no leaked state.

<!-- split -->

One workflow, one correlation ID, one matched response. No correlation tables, no message broker, no manual bookkeeping. The workflow itself is the correlation store.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Multiple services, one pattern"

Payment API, inventory API, shipping API — each has its own async response time. You need to track which response belongs to which request across all of them.

A correlation ID per request means each service response can be matched independently, regardless of arrival order.

<!-- split -->

Each workflow step emits structured events: `correlation_id_generated`, `request_sent`, `response_received`, `correlation_matched`. The client sees every state transition in real time.

Hash-based payload verification confirms the response content matches what was requested — not just the ID, but the data integrity.

<!-- split -->

The correlation ID pattern works the same whether you're calling one service or twenty. Each request gets its own workflow run, its own correlation ID, its own durable wait.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Durable waiting beats polling"

Polling for a response wastes compute. Webhooks without correlation lose track of the original request. You need durable waiting with automatic matching.

`sleep()` in a workflow step is a durable pause — the process can restart, redeploy, or crash. When the response arrives, the workflow resumes exactly where it left off.

<!-- split -->

The correlation ID is generated in the first step, attached to the outbound request in the second, and used to match the inbound response in the third. Each step is independently retryable.

If the response arrives before the timeout, it's matched and delivered. If not, the workflow emits a timeout event and completes cleanly.

<!-- split -->

No cron jobs checking for stale requests. No external correlation database. No message queue. Just a workflow that generates an ID, waits durably, and matches the response when it arrives.

Explore the interactive demo on v0: {v0_link}
