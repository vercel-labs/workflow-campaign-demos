# CLAUDE.md — Workflow Campaign Demos

## What This Repo Is

This is a **subtree organizer** for the "30 Days of Workflow DevKit" demo
collection. It lets you `git clone` once and get every demo project in a
single checkout.

Each subdirectory (e.g., `fan-out/`, `retry-backoff/`) is a complete,
standalone Next.js app. Each one also lives in its own GitHub repo under
`vercel-labs/` so that v0 can import it.

## Why Individual Repos Exist

v0 requires `package.json` at the repository root to create a sandbox. It
cannot import subdirectories from a monorepo — we tested this on 2026-03-03
and the URL `v0.app/chat/api/open?url=.../tree/main/fan-out` returns
"Failed to fetch URL."

So every demo needs its own repo. This organizer repo uses **git subtrees**
to keep them all in one place for convenience.

## What Are Git Subtrees?

Git subtrees let you embed one repo inside another as a plain directory. Unlike
submodules, there's no `.gitmodules` file, no special cloning steps, no broken
links. You just see folders.

The "subtree" part is invisible on GitHub — the directories look like regular
folders. The magic is in two commands:

```bash
# Pull updates FROM an individual repo INTO this organizer
git subtree pull --prefix=fan-out workflow-fan-out main --squash

# Push changes FROM this organizer TO an individual repo
git subtree push --prefix=fan-out workflow-fan-out main
```

`--squash` collapses the individual repo's history into a single merge commit,
keeping this repo's log clean.

## Repo Architecture

```
vercel-labs/workflow-campaign-demos    ← You are here (subtree organizer)
├── fan-out/                          ← subtree of vercel-labs/workflow-fan-out
├── retry-backoff/                    ← subtree of vercel-labs/workflow-retry-backoff
├── approval-gate/                    ← subtree of vercel-labs/workflow-approval-gate
└── ...                               ← one directory per demo
```

Each individual repo:
```
vercel-labs/workflow-{slug}
├── package.json                      ← at root (required for v0)
├── workflows/{slug}.ts               ← real workflow with getWritable() streaming
├── app/api/{slug}/route.ts           ← POST: start() from workflow/api
├── app/api/readable/[runId]/route.ts ← GET: SSE via run.getReadable()
├── app/api/run/[runId]/route.ts      ← GET: run status metadata
├── app/page.tsx                      ← server: readFileSync + Prism code panes
└── app/components/demo.tsx           ← client: SSE connection + interactive UI
```

## Naming Convention

Directory name maps directly to repo name:

| Directory | Individual Repo | v0 URL |
|-----------|----------------|--------|
| `fan-out/` | `vercel-labs/workflow-fan-out` | `https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-fan-out` |
| `retry-backoff/` | `vercel-labs/workflow-retry-backoff` | `https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-retry-backoff` |

Pattern: `vercel-labs/workflow-{directory-name}`

## How to Add a New Demo

### 1. Create the individual repo and push the demo

```bash
SLUG="approval-gate"
gh repo create "vercel-labs/workflow-${SLUG}" --public \
  --description "${SLUG} — Workflow DevKit Example"

# From the demo's source directory:
cd /path/to/approval-gate
git init && git add -A
git commit -m "feat: ${SLUG} demo with real Workflow DevKit APIs"
git remote add origin "https://github.com/vercel-labs/workflow-${SLUG}.git"
git push -u origin main
```

### 2. Add it as a subtree in this organizer

```bash
# From this repo's root:
git remote add "workflow-${SLUG}" "https://github.com/vercel-labs/workflow-${SLUG}.git"
git subtree add --prefix="${SLUG}" "workflow-${SLUG}" main --squash
git push origin main
```

### 3. Verify the v0 URL

```
https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-{slug}
```

## How to Update a Demo

There are two workflows depending on where you make the edit.

### Edit in this organizer repo (recommended)

```bash
# Make your changes in the subdirectory
vim retry-backoff/workflows/retry-backoff.ts

# Commit normally
git add -A && git commit -m "fix: update retry-backoff workflow"

# Push to this organizer
git push origin main

# Push the subdirectory changes to the individual repo
git subtree push --prefix=retry-backoff workflow-retry-backoff main
```

### Edit in the individual repo directly

```bash
# Someone pushed a fix to vercel-labs/workflow-retry-backoff
# Pull it into this organizer:
git subtree pull --prefix=retry-backoff workflow-retry-backoff main --squash
git push origin main
```

## How to Update Dependencies Across All Demos

### Bump the workflow package version

```bash
NEW_VERSION="4.1.0-beta.60"

for dir in */; do
  [ -f "${dir}package.json" ] || continue
  if grep -q '"workflow"' "${dir}package.json"; then
    cd "$dir"
    jq --arg v "$NEW_VERSION" '.dependencies.workflow = $v' package.json > tmp.json
    mv tmp.json package.json
    cd ..
    echo "Updated ${dir}"
  fi
done

git add -A && git commit -m "chore: bump workflow to ${NEW_VERSION}"
```

### Sync shared files (globals.css, tsconfig.json, etc.)

These files are identical across all demos:

| File | Purpose |
|------|---------|
| `app/globals.css` | Theme tokens + syntax palette |
| `app/layout.tsx` | Geist fonts + metadata shell |
| `postcss.config.mjs` | Tailwind v4 config |
| `tsconfig.json` | TypeScript strict + workflow plugin |
| `next.config.ts` | `withWorkflow()` wrapper |
| `.gitignore` | Standard Next.js ignores |

To sync from a canonical source (e.g., `fan-out`):

```bash
SOURCE="fan-out"
for dir in */; do
  [ -f "${dir}package.json" ] || continue
  [ "$dir" = "${SOURCE}/" ] && continue
  for f in app/globals.css app/layout.tsx postcss.config.mjs tsconfig.json next.config.ts .gitignore; do
    [ -f "${SOURCE}/${f}" ] && [ -f "${dir}${f}" ] && cp "${SOURCE}/${f}" "${dir}${f}"
  done
done
git add -A && git commit -m "chore: sync shared files from ${SOURCE}"
```

### Push all changes to individual repos

```bash
for dir in */; do
  [ -f "${dir}package.json" ] || continue
  SLUG="${dir%/}"
  REMOTE="workflow-${SLUG}"
  # Check if remote exists
  if git remote get-url "$REMOTE" &>/dev/null; then
    echo "Pushing ${SLUG}..."
    git subtree push --prefix="${SLUG}" "${REMOTE}" main
  else
    echo "SKIP: no remote '${REMOTE}' (run: git remote add ${REMOTE} https://github.com/vercel-labs/${REMOTE}.git)"
  fi
done
```

## Tech Stack (Every Demo)

- Next.js 16 + React 19 + App Router
- TypeScript 5 strict
- Tailwind CSS v4
- `workflow` package (Vercel Workflow DevKit)
- `prism-react-renderer` for syntax highlighting
- Geist font family

## How Each Demo Works

Every demo follows the same architecture:

1. **Workflow** (`workflows/*.ts`) — Uses `"use workflow"` and `"use step"`
   directives. Steps call `getWritable()` to stream progress events to the
   client. Uses `sleep()` for durable pauses, `FatalError` to prevent SDK
   auto-retry when the workflow owns retry logic.

2. **Start API** (`app/api/{slug}/route.ts`) — POST handler that calls
   `start()` from `workflow/api` to enqueue the workflow.

3. **SSE Stream** (`app/api/readable/[runId]/route.ts`) — GET handler that
   pipes `run.getReadable()` through a `TransformStream` to serialize objects
   as `data: {...}\n\n` SSE frames.

4. **Client Demo** (`app/components/demo.tsx`) — Connects to the SSE stream
   via `fetch`, accumulates events in React state, derives a snapshot for
   the UI (attempt ladder, execution log, code workbench sync).

5. **Code Panes** (`app/page.tsx`) — Server component that reads the actual
   workflow source with `readFileSync`, extracts functions with
   `extractFunctionBlock()`, highlights with Prism, and passes pre-rendered
   HTML to the client. Line maps are computed dynamically so highlights
   survive code edits.

## Troubleshooting

### "Failed to fetch URL" on v0

v0 needs `package.json` at the repo root. Make sure you're using the
individual repo URL, not a subdirectory of this organizer:

```
WRONG: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-campaign-demos/tree/main/fan-out
RIGHT: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-fan-out
```

### Subtree push fails with conflicts

If someone edited the individual repo directly and also edited the same file
here, you'll get conflicts. Resolve by pulling first:

```bash
git subtree pull --prefix=fan-out workflow-fan-out main --squash
# Resolve any conflicts
git subtree push --prefix=fan-out workflow-fan-out main
```

### "No remote" error during push-all

Add the remote first:

```bash
git remote add workflow-fan-out https://github.com/vercel-labs/workflow-fan-out.git
```

### Demo builds locally but fails on v0

Check that the demo doesn't use symlinks or reference files outside its
directory. v0 sandboxes only see the repo contents. `readFileSync` with
`process.cwd()` works on Vercel but may behave differently in v0's sandbox.
