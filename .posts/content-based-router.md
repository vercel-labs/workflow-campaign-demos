---
slug: content-based-router
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-content-based-router
primitive: if/else branching + "use step"
pick: null
---

# Content-Based Router — Route Tickets by Classification

Classify a support ticket's content, then route it to the right specialized handler — billing, technical, account, or feedback — each with its own durable step pipeline.

## Variant A — "One queue, four destinations"

Every support ticket lands in the same queue. Billing questions need payment lookups. Technical issues need stack traces. Account problems need identity verification. Feedback needs product team routing.

A content-based router inspects the message, classifies it, and sends it down the right path — all in one workflow.

<!-- split -->

The `classifyContent()` step scores keywords against a rules table and returns a type with a confidence score. Then a simple `if/else` branch dispatches to the matching handler.

Each handler is its own `"use step"` with isolated retry logic. A billing handler crashing doesn't affect the technical pipeline running in parallel for a different ticket.

<!-- split -->

No external rules engine. No routing table in a database. No message bus with topic filters. Classification and routing live in the same workflow file, and each branch is a durable step that survives restarts.

Explore the interactive demo on v0: {v0_link}

## Variant B — "What happens when classification is wrong?"

The ticket says "refund" but it's actually a technical bug in the billing page. The classifier picks billing. The billing handler runs three steps and resolves it as an invoice adjustment.

With a traditional router, you'd need a re-routing mechanism, a dead letter queue for misclassified tickets, and an audit trail across services.

<!-- split -->

Here the entire route — classify, branch, handle — is one workflow execution. The confidence score from classification is streamed to the UI. If the score is low, a human can see it in real time and intervene before the handler completes.

Each handler step emits progress events via `getWritable()`. "Verify account billing status" → "Check payment history" → "Generate resolution." Every state transition is visible and logged.

<!-- split -->

No separate audit service. No event replay to reconstruct what happened. The workflow execution *is* the audit trail. Classification confidence, routing decision, and handler steps are all streamed events in a single run.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Four handlers, zero coordination overhead"

Billing needs three steps. Technical needs four. Account needs three. Feedback needs three. Each handler has different logic, different external calls, different failure modes.

Traditionally you'd build four microservices, a router service, a message bus, and correlation logic to track which ticket went where.

<!-- split -->

With `"use step"` each handler is a self-contained function with its own retry behavior. The billing handler verifies account status, checks payment history, and generates a resolution. The technical handler reproduces the issue, analyzes the stack trace, applies a fix, and verifies.

All four handlers share the same `getWritable()` streaming pattern. The client receives typed events — `handler_processing`, `handler_complete` — regardless of which branch executed.

<!-- split -->

No service mesh. No message broker. No routing configuration to deploy separately. One workflow file with a classifier, a branch, and four handler functions. The runtime handles durability, retries, and streaming.

Explore the interactive demo on v0: {v0_link}
