# Workflow DevKit Demos

48 standalone Next.js apps showcasing the [Vercel Workflow DevKit](https://vercel.com/docs/workflow) — from classic enterprise integration patterns (saga, fan-out, dead-letter queue) to everyday scenarios (approval gates, onboarding drips, cancellable exports). Each demo is a complete app that also lives in its own repo under `vercel-labs/` for [v0](https://v0.dev) import.

## Demos

Every directory is an independent Next.js app implementing a **workflow or integration pattern** with the Workflow DevKit (`"use workflow"`, `"use step"`, durable `sleep`, streaming). Each one includes a real-time UI so you can watch the pattern execute step by step.

| Demo | What it demonstrates | When to use | Reviewed By |
|------|----------------------|-------------|-------------|
| **`aggregator`** | Merge many parallel outcomes into one combined result (pair with scatter-gather / fan-out). | Collect inventory from multiple warehouses with a timeout so stragglers don’t block checkout. | |
| **`approval-chain`** | Route work through a sequence of approvers; advance only when each step signs off. | Purchase orders needing manager → director → VP sign-off with per-level escalation timeouts. | |
| **`approval-gate`** | Pause the workflow until a human approves or rejects, then resume or fail. | Content moderation hold: pause publishing until a reviewer clicks approve or reject. | |
| **`async-request-reply`** | Start work, wait off-thread, and continue when an async callback or signal arrives. | Submit a request to a vendor API and resume when the webhook callback arrives. | |
| **`batch-processor`** | Collect items over time or up to a size, then process them as a single batch. | Process a large CSV import in batches, auto-resuming from the last completed batch after a crash. | |
| **`bulkhead`** | Isolate capacity or failure domains so one overloaded path doesn’t sink the whole system. | Partition order items into isolated groups so one bad SKU doesn’t block the rest of the shipment. | |
| **`cancellable-export`** | Long-running job (e.g. export) that the user can cancel while steps are in flight. | User starts a 100k-row data export and hits “Cancel” mid-flight without waiting for completion. | |
| **`choreography`** | Peers react to events independently—no central orchestrator (vs. saga / process manager). | Order flow where inventory, payment, and shipping react to events with automatic compensation on failure. | |
| **`circuit-breaker`** | Stop calling a failing dependency for a cooldown, then probe for recovery. | Stop hammering a down payment gateway after 3 failures, wait 30s, then test with one probe request. | |
| **`claim-check`** | Pass a small reference through the workflow; store or fetch the heavy payload elsewhere. | Accept a lightweight token instead of passing a 50 MB file through every workflow step. | |
| **`competing-consumers`** | Multiple workers consume the same kind of work for throughput and scale-out. | Multiple workflow instances race to claim items from a shared queue — only one wins each item. | |
| **`content-based-router`** | Branch to different handlers based on fields inside the message or payload. | Classify a support ticket and route it to billing, technical, account, or feedback handlers. | |
| **`content-enricher`** | Look up extra data and attach it before the next step sees the message. | Enrich a sales lead by querying CRM, social, and Clearbit in parallel before routing to sales. | |
| **`correlation-identifier`** | Tie outbound requests to the right workflow run when async replies arrive. | Tag outbound API calls with a correlation ID so async responses match back to the right order. | |
| **`dead-letter-queue`** | After repeated failure, move a message aside for inspection instead of infinite retry. | Route undeliverable messages to a dead-letter queue after 3 retries for ops review. | |
| **`detour`** | Temporarily bypass or replace a step (e.g. maintenance, A/B, fallback path). | Toggle a QA review stage on/off in a deploy pipeline based on a runtime feature flag. | |
| **`event-gateway`** | Normalize many external event shapes into one internal representation. | Wait for payment, inventory, and fraud-check signals to all arrive before shipping an order. | |
| **`event-sourcing`** | Drive behavior from an append-only event log; rebuild or audit state from history. | Append domain events to an immutable log and replay them to detect bugs or migrate projections. | |
| **`fan-out`** | One trigger fans out to parallel branches (often paired with gather/aggregate). | Broadcast an incident alert to Slack, email, SMS, and PagerDuty in parallel. | Pranay |
| **`guaranteed-delivery`** | Persist-and-retry semantics so work isn’t lost across crashes or restarts. | Ensure a payment confirmation is delivered even if the server restarts mid-send. | |
| **`hedge-request`** | Send duplicate requests; take the first successful response to cut tail latency. | Fire the same search query to two replicas and use whichever responds first. | |
| **`idempotent-receiver`** | Handle duplicate deliveries safely (same logical operation, same outcome). | Detect duplicate payment webhooks with an idempotency key and return the cached result. | |
| **`map-reduce`** | Map work in parallel, then reduce partial results into a single answer. | Partition a large analytics dataset into chunks, process in parallel, and merge into one report. | |
| **`message-filter`** | Drop or accept messages based on rules before downstream processing. | Drop low-priority log events before they hit the expensive analytics pipeline. | |
| **`message-history`** | Keep an audit trail of what passed through the flow and in what order. | Track a support ticket through normalize → classify → route → dispatch with full history at each step. | |
| **`message-translator`** | Convert between external and internal message formats at the boundary. | Convert partner XML orders into your internal JSON schema at the API boundary. | |
| **`namespaced-streams`** | Separate streams (e.g. per tenant or topic) so clients only see relevant events. | Emit workflow events to separate UI and ops-telemetry streams simultaneously. | |
| **`normalizer`** | Map heterogeneous inputs into one canonical shape before routing. | Accept orders as XML, CSV, or legacy JSON and transform them into a single canonical shape. | |
| **`onboarding-drip`** | Time-delayed sequence (e.g. emails or nudges) with durable waits between steps. | Send a welcome email on signup, a tips email after 2 days, and a check-in after a week. | |
| **`pipeline`** | Linear chain of stages—each step’s output feeds the next. | Run a 4-stage ETL (extract → transform → validate → load) with live progress streaming. | |
| **`priority-queue`** | Prefer higher-priority work when multiple items are waiting. | Process enterprise-tier jobs before free-tier jobs when the queue is backed up. | |
| **`process-manager`** | Track a multi-step business process and react to events until it completes. | Orchestrate payment → inventory → backorder → shipping → delivery with branching logic. | |
| **`publish-subscribe`** | One publisher, many subscribers—broadcast-style distribution. | A product-update event triggers email, push notification, and analytics subscribers independently. | |
| **`recipient-list`** | Same logical message delivered to a list of recipients (static or dynamic). | Evaluate severity rules at runtime and alert matching channels (Slack, email, PagerDuty). | |
| **`request-reply`** | Call/response style interaction modeled inside a durable workflow. | Send a request to a service, wait for a correlated reply with a deadline, and retry on timeout. | |
| **`resequencer`** | Buffer and reorder out-of-order messages before the next stage. | Buffer out-of-order webhook fragments and release them in the correct sequence. | |
| **`retry-backoff`** | Retry failed steps with increasing delay to avoid hammering flaky dependencies. | Retry a flaky email API with 1s → 2s → 4s backoff instead of failing on the first hiccup. | |
| **`retryable-rate-limit`** | On 429 / rate limits, back off and retry instead of failing immediately. | Sync contacts to an external CRM and auto-retry when the API returns 429 with retry-after. | |
| **`routing-slip`** | Attach an itinerary to the message so each hop knows where to send it next. | Execute a flexible sequence of processing stages defined per-request in a routing slip. | |
| **`saga`** | Long-lived transaction across services using forward steps and compensations. | Upgrade a subscription (reserve seats → capture invoice → provision) with auto-rollback on failure. | |
| **`scatter-gather`** | Fan out to many workers, then collect and merge their replies. | Query 4 shipping providers for quotes in parallel and pick the cheapest one that responds. | |
| **`scheduled-digest`** | Accumulate activity and emit a summary on a schedule (e.g. daily digest). | Open a 1-hour collection window for events, then email a digest when the window closes. | |
| **`scheduler-agent-supervisor`** | Scheduled triggers plus supervised agent/worker style execution. | Dispatch content generation to agents in sequence, checking quality thresholds with escalation. | |
| **`splitter`** | Break one compound message into many smaller messages for downstream steps. | Split a multi-item order into individual line items for independent validation and fulfillment. | |
| **`status-poller`** | Poll an external API or job until it reaches a terminal state, with backoff. | Poll a video transcoding job until it’s ready, sleeping between checks with a max-poll safety valve. | |
| **`throttle`** | Limit how often work runs or how many concurrent operations are allowed. | Cap outbound API calls to 10/second so you don’t blow your third-party rate limit. | |
| **`transactional-outbox`** | Write business data and an “outbox” event in one transaction, then publish reliably. | Persist an order and relay it to a message broker in one transaction for at-least-once delivery. | |
| **`wakeable-reminder`** | Sleep until a deadline *or* wake early when an external event arrives. | Schedule a payment reminder for 3 days out, but let the user cancel, snooze, or pay early via webhook. | |
| **`webhook-basics`** | Ingest HTTP webhooks, validate, and drive workflow steps from external systems. | Accept Stripe or GitHub webhooks, validate signatures, and kick off internal workflow steps. | |
| **`wire-tap`** | Observe or copy messages in flight for logging/debugging without changing the main path. | Mirror production order events to a debug logger without touching the main processing path. | |

## Quick Start

Each demo is independent. Pick one and run it:

```bash
cd fan-out
pnpm install
pnpm dev
```

Open a demo in v0 by following the pattern:
```
https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-fan-out
```

## Scripts

All utility scripts live in `.scripts/` and run with [Bun](https://bun.sh):

```bash
# Git subtree management (interactive menu)
bun .scripts/sync.ts

# Push all subtrees to their individual repos
bun .scripts/sync.ts push

# Re-link a demo as a real subtree (after "no new revisions"; see CLAUDE.md)
bun .scripts/sync.ts repair map-reduce

# Publish demos to v0 as public shareable chats
bun .scripts/v0-publish-public.ts fan-out saga

# Full social pipeline: v0 publish + ray.so images + Typefully drafts
bun .scripts/typefully-publish.ts fan-out --variant A

# Typefully drafts only (set v0_url in .posts/<slug>.md frontmatter first)
bun .scripts/typefully-publish.ts aggregator approval-chain --skip-v0

# 5-day Typefully + v0 links: .posts/DRAFT-SLACK-PICKER.md

# Generate code snippet images from post markdown
bun .scripts/generate-snippet-image.ts fan-out --all

# Parse/inspect post thread structure
bun .scripts/parse-post.ts .posts/saga.md --json
```

### Environment

| Variable | Script | Where |
|----------|--------|-------|
| `V0_API_KEY` | `v0-publish-public.ts` | Environment |
| `TYPEFULLY_API_KEY` | `typefully-publish.ts` | `.env.local` |

`generate-snippet-image.ts` and `typefully-publish.ts` require `puppeteer` (headless Chrome) for ray.so screenshots.

## Tech Stack

- Next.js 16, React 19, App Router
- TypeScript 5 strict, Tailwind CSS v4
- `workflow` package (Vercel Workflow DevKit)
- Bun for scripts and tests

## Repo Structure

This is a **git subtree** organizer. Each demo directory maps to a standalone repo:

```
fan-out/  →  vercel-labs/workflow-fan-out
saga/     →  vercel-labs/workflow-saga
...
```

Do not rename or move demo directories — it breaks the subtree prefix mapping. See `CLAUDE.md` for full subtree workflow details.
