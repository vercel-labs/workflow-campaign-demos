---
slug: pipeline
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-pipeline
primitive: sequential step execution with progress events
pick: null
---

# Pipeline — 4-Stage ETL

Execute a 4-stage ETL pipeline (Extract, Transform, Validate, Load) sequentially with progress updates streamed to the client after each stage.

## Variant A — "ETL without the orchestrator"


Extract. Transform. Validate. Load. Four stages, strict order, and you need to know which stage you're on.

Traditional: a pipeline orchestrator service, a job state table, dependency resolution logic, and a polling UI.

With WDK each stage is a step. Progress events stream automatically:

```ts
export async function pipeline(documentId: string) {
  "use workflow";

  const steps = ["Extract", "Transform", "Validate", "Load"];

  for (let i = 0; i < steps.length; i++) {
    await runPipelineStep(steps[i], i, steps.length);
  }

  return { status: "completed", steps: steps.length };
}

async function runPipelineStep(name: string, index: number, total: number) {
  "use step";
  // Each step runs to completion, then the next begins.
  // Crash after Transform? Resumes at Validate.
}
```

<!-- split -->

Each `"use step"` runs to completion before the next one starts. If the workflow crashes after Transform, it resumes at Validate, not from the beginning.

Progress events hit the client via `getWritable()`. No polling. No job status table.

<!-- split -->

Extract → Transform → Validate → Load. Four steps. One file. Durable progress tracking built in.

No orchestrator. No dependency graph. No state database.

Explore the interactive demo on v0: {v0_link}

## Variant B — "What happens when stage 3 crashes?"

Your ETL pipeline is on stage 3 of 4. The server restarts. Traditional answer: check the job table, figure out what completed, resume manually.

WDK answer: it just resumes at stage 3. Every completed step is checkpointed:

```ts
export async function pipeline(documentId: string) {
  "use workflow";

  const steps = ["Extract", "Transform", "Validate", "Load"];

  for (let i = 0; i < steps.length; i++) {
    await runPipelineStep(steps[i], i, steps.length);
  }

  return { status: "completed", steps: steps.length };
}

async function runPipelineStep(name: string, index: number, total: number) {
  "use step";
  // Each step runs to completion, then the next begins.
  // Crash after Transform? Resumes at Validate.
}
```

<!-- split -->

Steps are durable. Extract finishes, checkpointed. Transform finishes, checkpointed. Crash after Transform? Validate runs next. No re-extraction, no re-transformation.

The client sees progress events for each stage as they complete. Real-time visibility with zero extra code.

<!-- split -->

Four stages. Crash anywhere. Resume exactly where you stopped.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Sequential steps are just... sequential"

Pipeline orchestration frameworks exist because running things in order, durably, used to be hard. State machines, dependency resolvers, checkpoint stores.

In WDK, sequential is the default:

```ts
export async function pipeline(documentId: string) {
  "use workflow";

  const steps = ["Extract", "Transform", "Validate", "Load"];

  for (let i = 0; i < steps.length; i++) {
    await runPipelineStep(steps[i], i, steps.length);
  }

  return { status: "completed", steps: steps.length };
}

async function runPipelineStep(name: string, index: number, total: number) {
  "use step";
  // Each step runs to completion, then the next begins.
  // Crash after Transform? Resumes at Validate.
}
```

<!-- split -->

Write four steps. They run in order. Each one streams a progress event to the client when it completes. If anything fails, the workflow retries that step, not the whole pipeline.

No DAG. No dependency resolution. No orchestration layer.

<!-- split -->

Extract. Transform. Validate. Load. Four functions in a file. Durable. Observable. Resumable.

Explore the interactive demo on v0: {v0_link}
