# Workflow Campaign Demos

All 30 Days of Workflow DevKit demos in one checkout. Each subdirectory is a
git subtree linked to its own standalone repo.

## Quick start

```bash
git clone https://github.com/vercel-labs/workflow-campaign-demos.git
cd workflow-campaign-demos/fan-out
pnpm install && pnpm dev
```

## Open any demo in v0

Each demo has its own repo, so v0 can import it directly:

| Demo | v0 Link |
|------|---------|
| aggregator | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-aggregator) |
| approval-chain | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-approval-chain) |
| approval-gate | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-approval-gate) |
| batch-processor | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-batch-processor) |
| bulkhead | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-bulkhead) |
| cancellable-export | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-cancellable-export) |
| circuit-breaker | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-circuit-breaker) |
| claim-check | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-claim-check) |
| content-enricher | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-content-enricher) |
| dead-letter-queue | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-dead-letter-queue) |
| event-gateway | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-event-gateway) |
| fan-out | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-fan-out) |
| namespaced-streams | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-namespaced-streams) |
| onboarding-drip | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-onboarding-drip) |
| pipeline | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-pipeline) |
| retry-backoff | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-retry-backoff) |
| retryable-rate-limit | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-retryable-rate-limit) |
| routing-slip | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-routing-slip) |
| saga | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-saga) |
| scatter-gather | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-scatter-gather) |
| scheduled-digest | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-scheduled-digest) |
| scheduler-agent-supervisor | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-scheduler-agent-supervisor) |
| status-poller | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-status-poller) |
| wakeable-reminder | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-wakeable-reminder) |
| webhook-basics | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-webhook-basics) |

## Subtree workflow

This repo uses `git subtree` — each directory maps to `vercel-labs/workflow-{slug}`.

```bash
# Pull latest from an individual repo
git subtree pull --prefix=fan-out workflow-fan-out main --squash

# Push local changes to an individual repo
git subtree push --prefix=fan-out workflow-fan-out main
```
