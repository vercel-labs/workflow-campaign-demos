# 30 Days of Workflow DevKit

A collection of standalone Next.js demos showcasing the [Vercel Workflow DevKit](https://vercel.com/docs/workflow). Each subdirectory is a complete app that also lives in its own repo under `vercel-labs/` for [v0](https://v0.dev) import.

## Demos

Each directory is a standalone Next.js app named after a common **enterprise integration / workflow pattern**. Demos use the Workflow DevKit (`"use workflow"`, `"use step"`, durable `sleep`, streaming) to show how that pattern behaves with retries, pauses, and real-time UI.

| Demo | What it demonstrates |
|------|----------------------|
| **`aggregator`** | Merge many parallel outcomes into one combined result (pair with scatter-gather / fan-out). |
| **`approval-chain`** | Route work through a sequence of approvers; advance only when each step signs off. |
| **`approval-gate`** | Pause the workflow until a human approves or rejects, then resume or fail. |
| **`async-request-reply`** | Start work, wait off-thread, and continue when an async callback or signal arrives. |
| **`batch-processor`** | Collect items over time or up to a size, then process them as a single batch. |
| **`bulkhead`** | Isolate capacity or failure domains so one overloaded path doesn’t sink the whole system. |
| **`cancellable-export`** | Long-running job (e.g. export) that the user can cancel while steps are in flight. |
| **`choreography`** | Peers react to events independently—no central orchestrator (vs. saga / process manager). |
| **`circuit-breaker`** | Stop calling a failing dependency for a cooldown, then probe for recovery. |
| **`claim-check`** | Pass a small reference through the workflow; store or fetch the heavy payload elsewhere. |
| **`competing-consumers`** | Multiple workers consume the same kind of work for throughput and scale-out. |
| **`content-based-router`** | Branch to different handlers based on fields inside the message or payload. |
| **`content-enricher`** | Look up extra data and attach it before the next step sees the message. |
| **`correlation-identifier`** | Tie outbound requests to the right workflow run when async replies arrive. |
| **`dead-letter-queue`** | After repeated failure, move a message aside for inspection instead of infinite retry. |
| **`detour`** | Temporarily bypass or replace a step (e.g. maintenance, A/B, fallback path). |
| **`event-gateway`** | Normalize many external event shapes into one internal representation. |
| **`event-sourcing`** | Drive behavior from an append-only event log; rebuild or audit state from history. |
| **`fan-out`** | One trigger fans out to parallel branches (often paired with gather/aggregate). |
| **`guaranteed-delivery`** | Persist-and-retry semantics so work isn’t lost across crashes or restarts. |
| **`hedge-request`** | Send duplicate requests; take the first successful response to cut tail latency. |
| **`idempotent-receiver`** | Handle duplicate deliveries safely (same logical operation, same outcome). |
| **`map-reduce`** | Map work in parallel, then reduce partial results into a single answer. |
| **`message-filter`** | Drop or accept messages based on rules before downstream processing. |
| **`message-history`** | Keep an audit trail of what passed through the flow and in what order. |
| **`message-translator`** | Convert between external and internal message formats at the boundary. |
| **`namespaced-streams`** | Separate streams (e.g. per tenant or topic) so clients only see relevant events. |
| **`normalizer`** | Map heterogeneous inputs into one canonical shape before routing. |
| **`onboarding-drip`** | Time-delayed sequence (e.g. emails or nudges) with durable waits between steps. |
| **`pipeline`** | Linear chain of stages—each step’s output feeds the next. |
| **`priority-queue`** | Prefer higher-priority work when multiple items are waiting. |
| **`process-manager`** | Track a multi-step business process and react to events until it completes. |
| **`publish-subscribe`** | One publisher, many subscribers—broadcast-style distribution. |
| **`recipient-list`** | Same logical message delivered to a list of recipients (static or dynamic). |
| **`request-reply`** | Call/response style interaction modeled inside a durable workflow. |
| **`resequencer`** | Buffer and reorder out-of-order messages before the next stage. |
| **`retry-backoff`** | Retry failed steps with increasing delay to avoid hammering flaky dependencies. |
| **`retryable-rate-limit`** | On 429 / rate limits, back off and retry instead of failing immediately. |
| **`routing-slip`** | Attach an itinerary to the message so each hop knows where to send it next. |
| **`saga`** | Long-lived transaction across services using forward steps and compensations. |
| **`scatter-gather`** | Fan out to many workers, then collect and merge their replies. |
| **`scheduled-digest`** | Accumulate activity and emit a summary on a schedule (e.g. daily digest). |
| **`scheduler-agent-supervisor`** | Scheduled triggers plus supervised agent/worker style execution. |
| **`splitter`** | Break one compound message into many smaller messages for downstream steps. |
| **`status-poller`** | Poll an external API or job until it reaches a terminal state, with backoff. |
| **`throttle`** | Limit how often work runs or how many concurrent operations are allowed. |
| **`transactional-outbox`** | Write business data and an “outbox” event in one transaction, then publish reliably. |
| **`wakeable-reminder`** | Sleep until a deadline *or* wake early when an external event arrives. |
| **`webhook-basics`** | Ingest HTTP webhooks, validate, and drive workflow steps from external systems. |
| **`wire-tap`** | Observe or copy messages in flight for logging/debugging without changing the main path. |

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
