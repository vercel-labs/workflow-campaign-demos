---
name: draft
description: End-to-end publish + Typefully draft pipeline for a single demo. Use when the user says "draft", "create draft", "typefully draft", or wants to publish a demo and create social thread drafts in one go.
---

# Draft a Demo

Full pipeline: select a demo, publish to v0, generate snippet image, and create Typefully thread drafts.

## Workflow

### Step 1: Select a demo

Discover demos by listing directories in the project root that contain a `package.json` (skip directories starting with `.`). Present them with `AskUserQuestion` so the user can pick one.

### Step 2: Pre-flight checks

1. **Uncommitted changes** — Run `git status`. If changes touch the selected demo's prefix, warn the user and ask whether to continue.

2. **Subtree sync** — Run from project root:
   ```
   git fetch workflow-{slug} main
   git rev-parse workflow-{slug}/main        → remote SHA
   git subtree split --prefix={slug}         → local SHA
   ```
   If SHAs differ, offer to push: `git subtree push --prefix={slug} workflow-{slug} main`

3. **Post file** — Confirm `.posts/{slug}.md` exists. If not, tell the user and abort — the Typefully pipeline requires it.

4. **Environment** — Confirm `V0_API_KEY` is set and `TYPEFULLY_API_KEY` exists in `.env.local`.

### Step 3: Validate tweet lengths

Run:
```bash
bun .scripts/typefully-publish.ts {slug} --validate
```
If any tweets exceed the 280-character limit, show which ones are over and by how much. Help the user edit `.posts/{slug}.md` to fix them, then re-validate until it passes.

### Step 4: Select variant(s)

Ask the user which variant(s) to draft using `AskUserQuestion`:
- Variant A
- Variant B
- Variant C
- All variants

### Step 5: Run the full pipeline

The typefully-publish script handles v0 publish, image generation, and Typefully draft creation in one run:

```bash
bun .scripts/typefully-publish.ts {slug} --variant {variant}
```
Or without `--variant` for all variants.

This will:
1. Publish to v0 (calls v0-publish-public.ts internally)
2. Generate a ray.so code snippet image from the post's code block
3. Upload the image to Typefully
4. Create thread drafts for each selected variant

### Step 6: Report results

From the script output, extract and report:
- The v0 URL (`https://v0.app/chat/...`)
- Each Typefully draft URL (`https://typefully.com/?d=...`)
- Each share URL (`https://typefully.com/t/...`)

## Notes

- The `.posts/` directory contains social media thread content
- `typefully-publish.ts` calls `v0-publish-public.ts` internally — do NOT run v0-publish separately
- The `{v0_link}` placeholder in post markdown gets replaced with the live v0 URL at publish time
- Image generation requires `puppeteer` (headless Chrome for ray.so screenshots)
- If the post has no code block, image generation is skipped but the draft still gets created using the existing `.posts/{slug}.png` if present
