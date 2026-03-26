---
name: publish
description: Publish a single demo to v0 and optionally create Typefully drafts. Use when the user says "publish", "publish to v0", or "create typefully draft" for a demo.
---

# Publish a Demo

Publish a single workflow demo to v0 (and optionally Typefully) with pre-flight checks.

## Workflow

### Step 1: Select a demo

Present the user with a list of available demos. Discover them by listing directories in the project root that contain a `package.json` (skip directories starting with `.`).

Use `AskUserQuestion` with the demos as options so the user can pick one.

### Step 2: Pre-flight checks

Before publishing, verify:

1. **Uncommitted changes** — Run `git status` on the demo directory. If there are uncommitted changes touching the selected demo's prefix, warn the user and ask whether to continue.

2. **Subtree sync** — Run these git commands from the project root:
   ```
   git fetch workflow-{slug} main
   git rev-parse workflow-{slug}/main        → remote SHA
   git subtree split --prefix={slug}         → local SHA
   ```
   If the SHAs differ, the subtree is out of sync. Offer to push it:
   ```
   bun .scripts/sync.ts push-one
   ```
   Let the user pick the demo interactively, or run:
   ```
   git subtree push --prefix={slug} workflow-{slug} main
   ```

3. **Environment** — Confirm `V0_API_KEY` is set. If publishing to Typefully, confirm `TYPEFULLY_API_KEY` exists in `.env.local`.

### Step 3: Publish to v0

Run:
```bash
bun .scripts/v0-publish-public.ts {slug} -y --skip-sync-check
```
Use `--skip-sync-check` because we already verified sync in step 2. Use `-y` to skip the interactive confirmation.

Report the v0 URL from the output.

### Step 4: Ask about Typefully

Ask the user if they also want to create Typefully thread drafts for this demo.

If yes, check that `.posts/{slug}.md` exists. If it does, run:
```bash
bun .scripts/typefully-publish.ts {slug} --validate
```
If validation passes, ask which variant(s) to publish (A, B, C, or all), then run:
```bash
bun .scripts/typefully-publish.ts {slug} --variant {variant}
```
Or without `--variant` for all variants.

Report the Typefully draft URLs from the output.

## Notes

- The `.posts/` directory contains social media thread content (renamed from `posts/`)
- The v0 publish script uses the `v0-sdk` to create a public chat from the demo's GitHub repo (`vercel-labs/workflow-{slug}`)
- The typefully script orchestrates: v0 publish → ray.so image generation → Typefully API draft creation
- If running typefully-publish standalone, it will also call v0-publish internally, so skip step 3 in that case
