# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

A **git subtree organizer** for the "30 Days of Workflow DevKit" demo collection. Each subdirectory is a complete standalone Next.js app that also lives in its own repo under `vercel-labs/` (required for v0 import — v0 needs `package.json` at repo root).

Pattern: directory `fan-out/` → repo `vercel-labs/workflow-fan-out` → v0 URL `https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-fan-out`

## Commands

Each demo is an independent Next.js app. Always `cd` into a demo directory first:

```bash
cd fan-out
pnpm install        # most demos use pnpm (25/33); some use npm
pnpm dev            # start dev server
pnpm build          # production build
pnpm lint           # next lint
```

Tests use Bun's test runner (not Jest/Vitest):
```bash
cd fan-out
bun test                                    # run all tests in the demo
bun test app/page-snippet.test.ts           # run a single test file
```

There is no root-level package.json — no monorepo commands. Each demo is fully isolated.

## Root Scripts (`.scripts/`)

All root-level utility scripts live in `.scripts/` and run with `bun`. They manage the campaign lifecycle: subtree sync, v0 publishing, social media, and image generation.

| Script | Purpose | When to use |
|--------|---------|-------------|
| `bun .scripts/sync.ts` | Git subtree sync (pull/push/status/add) | After committing changes to push subtrees to individual repos, or to onboard new demos |
| `bun .scripts/v0-publish-public.ts` | Publish demos to v0 as public shareable chats | When a demo is ready to share — creates a `v0.app/chat/...` URL via the v0 SDK |
| `bun .scripts/typefully-publish.ts` | Parse posts into X thread drafts, generate ray.so images, upload to Typefully | When publishing social content for a demo — orchestrates v0 publish + image gen + Typefully API |
| `bun .scripts/generate-snippet-image.ts` | Generate ray.so code snippet PNGs from post markdown | When you need a standalone code image without the full Typefully pipeline |
| `bun .scripts/parse-post.ts` | Parse `posts/*.md` into structured thread data | For inspecting/debugging post structure, or as a library (`parsePostFile()` is exported) |

### Environment requirements

- `v0-publish-public.ts` requires `V0_API_KEY` in environment
- `typefully-publish.ts` requires `TYPEFULLY_API_KEY` in `.env.local`
- `generate-snippet-image.ts` requires `puppeteer` (uses headless Chrome for ray.so screenshots)

## Git Subtree Workflow

**CRITICAL: Every subdirectory is a git subtree.** Do not reorganize, rename, or move demo directories — this breaks the subtree prefix mapping.

Each demo has a named remote: `workflow-{slug}` → `vercel-labs/workflow-{slug}.git`

### Edit a demo here (recommended)
```bash
# Edit files, commit normally, then push to both repos:
git push origin main
git subtree push --prefix=fan-out workflow-fan-out main
```

### Pull changes made in the individual repo
```bash
git subtree pull --prefix=fan-out workflow-fan-out main --squash
```

### Push all subtrees at once
```bash
bun .scripts/sync.ts push          # push all configured subtrees
bun .scripts/sync.ts push-one      # interactive picker for a single demo
```

### Add a new demo
```bash
bun .scripts/sync.ts add           # interactive: creates GitHub repo, adds remote, pushes subtree
bun .scripts/sync.ts init-new      # batch: creates repos for all demos missing remotes
```

## Demo Architecture (Every Demo Follows This)

Each demo has 5 layers that connect together:

1. **Workflow** (`workflows/{slug}.ts`) — `"use workflow"` + `"use step"` directives. Steps call `getWritable()` to stream typed events to the client. Uses `sleep()` for durable pauses, `FatalError` to prevent SDK auto-retry.

2. **Start API** (`app/api/{slug}/route.ts`) — POST handler calling `start()` from `workflow/api` to enqueue the workflow.

3. **SSE Stream** (`app/api/readable/[runId]/route.ts`) — GET handler piping `run.getReadable()` through a `TransformStream` to emit `data: {...}\n\n` SSE frames.

4. **Client Demo** (`app/components/demo.tsx`) — `"use client"` component connecting to SSE, accumulating events in React state, rendering interactive UI with code workbench sync.

5. **Code Panes** (`app/page.tsx`) — Server component that reads the workflow source with `readFileSync`, extracts function blocks with `extractFunctionBlock()`, highlights with Prism/sugar-high, and computes line maps dynamically so code highlights survive edits.

## Shared Files Across Demos

These files should be kept identical across all demos. When updating, sync from a canonical source (e.g., `fan-out/`):

| File | Purpose |
|------|---------|
| `app/globals.css` | Theme tokens + syntax palette |
| `app/layout.tsx` | Geist fonts + metadata shell |
| `postcss.config.mjs` | Tailwind v4 config |
| `tsconfig.json` | TypeScript strict + workflow plugin |
| `next.config.ts` | `withWorkflow()` wrapper |
| `.gitignore` | Standard Next.js ignores |

Sync command:
```bash
SOURCE="fan-out"
for dir in */; do
  [ -f "${dir}package.json" ] || continue
  [ "$dir" = "${SOURCE}/" ] && continue
  for f in app/globals.css app/layout.tsx postcss.config.mjs tsconfig.json next.config.ts .gitignore; do
    [ -f "${SOURCE}/${f}" ] && [ -f "${dir}${f}" ] && cp "${SOURCE}/${f}" "${dir}${f}"
  done
done
```

## Bump Workflow Package Across All Demos

```bash
NEW_VERSION="4.2.0-beta.65"
for dir in */; do
  [ -f "${dir}package.json" ] || continue
  grep -q '"workflow"' "${dir}package.json" && \
    jq --arg v "$NEW_VERSION" '.dependencies.workflow = $v' "${dir}package.json" > tmp.json && \
    mv tmp.json "${dir}package.json"
done
```

## Tech Stack

- Next.js 16, React 19, App Router
- TypeScript 5 strict
- Tailwind CSS v4
- `workflow` package (Vercel Workflow DevKit) with `withWorkflow()` Next.js plugin
- `prism-react-renderer` / `sugar-high` for syntax highlighting
- Geist font family
- Bun for test runner

## Key Constraints

- v0 cannot import subdirectories from monorepos — that's why each demo needs its own repo
- `readFileSync(join(process.cwd(), "workflows/..."))` is used at build time to read workflow source for code panes — don't move workflow files without updating page.tsx
- `extractFunctionBlock()` in page.tsx finds functions by string marker matching — renaming exported functions requires updating the markers
- Demo workflows use simulated delays and `getWritable()` for UI streaming; production workflows wouldn't need these
