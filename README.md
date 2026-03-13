# 30 Days of Workflow DevKit

A collection of standalone Next.js demos showcasing the [Vercel Workflow DevKit](https://vercel.com/docs/workflow). Each subdirectory is a complete app that also lives in its own repo under `vercel-labs/` for [v0](https://v0.dev) import.

## Demos

| Demo | Pattern |
|------|---------|
| `aggregator` | Aggregator |
| `approval-chain` | Approval Chain |
| `approval-gate` | Approval Gate |
| `async-request-reply` | Async Request-Reply |
| `batch-processor` | Batch Processor |
| `bulkhead` | Bulkhead |
| `cancellable-export` | Cancellable Export |
| `choreography` | Choreography |
| `circuit-breaker` | Circuit Breaker |
| `claim-check` | Claim Check |
| `competing-consumers` | Competing Consumers |
| `content-enricher` | Content Enricher |
| `dead-letter-queue` | Dead Letter Queue |
| `event-gateway` | Event Gateway |
| `fan-out` | Fan-Out |
| `idempotent-receiver` | Idempotent Receiver |
| `message-history` | Message History |
| `namespaced-streams` | Namespaced Streams |
| `onboarding-drip` | Onboarding Drip |
| `pipeline` | Pipeline |
| `process-manager` | Process Manager |
| `resequencer` | Resequencer |
| `retry-backoff` | Retry Backoff |
| `retryable-rate-limit` | Retryable Rate Limit |
| `routing-slip` | Routing Slip |
| `saga` | Saga |
| `scatter-gather` | Scatter-Gather |
| `scheduled-digest` | Scheduled Digest |
| `scheduler-agent-supervisor` | Scheduler-Agent-Supervisor |
| `status-poller` | Status Poller |
| `transactional-outbox` | Transactional Outbox |
| `wakeable-reminder` | Wakeable Reminder |
| `webhook-basics` | Webhook Basics |

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

# Publish demos to v0 as public shareable chats
bun .scripts/v0-publish-public.ts fan-out saga

# Full social pipeline: v0 publish + ray.so images + Typefully drafts
bun .scripts/typefully-publish.ts fan-out --variant A

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
