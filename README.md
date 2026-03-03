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
| fan-out | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-fan-out) |
| retry-backoff | [Open in v0](https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-retry-backoff) |

## Subtree workflow

This repo uses `git subtree` — each directory maps to `vercel-labs/workflow-{slug}`.

```bash
# Pull latest from an individual repo
git subtree pull --prefix=fan-out workflow-fan-out main --squash

# Push local changes to an individual repo
git subtree push --prefix=fan-out workflow-fan-out main
```
