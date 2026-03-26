---
slug: detour
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-detour
primitive: if (qaMode) — conditional pipeline stages
pick: null
---

# Detour — Conditional QA Pipeline

Add or skip processing stages in a deployment pipeline based on a runtime toggle. When QA mode is on, the pipeline detours through extra review stages. When off, it runs the direct path.

## Variant A — "The Friday deploy dilemma"

Your deployment pipeline has three steps: build, lint, deploy. Most of the time that's fine. But on Fridays, or before a big release, you want QA review, staging tests, and a security scan in the middle.

You could maintain two separate pipelines. Or you could use a detour.

<!-- split -->

A single `if (qaMode)` in the workflow adds three QA stages between lint and deploy. The same pipeline, conditionally extended. No duplicate workflows, no routing logic based on message content.

Build and lint always run. Deploy always runs last. The detour only affects the middle.

<!-- split -->

One pipeline. One toggle. Three extra stages when you need them, zero when you don't. No conditional routing services, no pipeline branching infrastructure.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Same pipeline, different rigor"

Dev pushes go straight to production: build, lint, deploy. Release candidates need QA review, staging verification, and a security scan before they ship.

Two different rigor levels, same underlying pipeline. The detour pattern makes this a runtime decision, not an architecture decision.

<!-- split -->

The workflow accepts a `qaMode` boolean. When true, three additional durable steps run between lint and deploy. Each step streams progress events, so the UI shows exactly where the pipeline is — including whether it's in the detour.

Crash during the security scan? Only the scan re-runs. Build and lint replay from the log instantly.

<!-- split -->

No pipeline duplication. No environment-specific workflow definitions. One workflow, one toggle, and the pipeline adapts to the required rigor level.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Skip the detour, not the safety"

Every deploy runs build and lint. Those are non-negotiable. But QA review, staging tests, and security scans? Those are expensive. You only run them when the stakes justify it.

The detour pattern lets you conditionally include expensive stages without maintaining separate pipeline definitions.

<!-- split -->

`if (qaMode)` wraps the QA stages in a single durable step that emits `detour_entered` and `detour_exited` events. The client knows exactly when the pipeline enters and leaves the detour. Each QA sub-step streams its own progress.

Direct path: 3 steps, fast. Detour path: 6 steps, thorough. Same workflow file.

<!-- split -->

No feature flags service. No pipeline orchestrator deciding which stages to run. A boolean and an if statement. The simplest possible conditional processing in a durable workflow.

Explore the interactive demo on v0: {v0_link}
