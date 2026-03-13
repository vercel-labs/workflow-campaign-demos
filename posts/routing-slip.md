---
slug: routing-slip
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-routing-slip
primitive: sequential step execution with dynamic routing
pick: null
---

# Routing Slip — Dynamic Processing Pipeline

Execute a flexible sequence of processing stages defined in a routing slip, each stage completing before the next begins.

## Variant A — "The order comes with the message"


The request arrives with a slip: validate → enrich → transform → deliver. Another request arrives with: validate → deliver. The processing stages are data, not code.

Traditional: a routing table in the database, a state machine per slip, separate worker pools per stage, and a dispatcher to route between them.

With WDK you loop over the slip and run each stage as a step:

```ts
export async function routingSlip(orderId: string, slip: string[]) {
  "use workflow";

  const results = [];

  for (let i = 0; i < slip.length; i++) {
    const result = await processStage(orderId, slip[i], i);
    results.push(result);
  }

  return { status: "completed", orderId, stages: results };
}

async function processStage(orderId: string, stage: string, index: number) {
  "use step";
  // Each stage runs as a durable step.
  // The slip defines the route — different requests, different paths.
}
```

<!-- split -->

The slip is an array. The loop is a `for`. Each stage is a `"use step"` that runs the right handler. Dynamic routing is just iteration over durable steps.

No routing table. No dispatcher. No worker-per-stage.

<!-- split -->

Different requests, different routes, same workflow. The slip defines the path. The steps make it durable.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Dynamic pipelines without a pipeline engine"

Sometimes the processing stages aren't fixed at build time. They come with the request: a routing slip that says which stages to run and in what order.

Traditional pipeline engines handle this with configuration tables, stage registries, and dispatch layers. WDK handles it with a loop:

```ts
export async function routingSlip(orderId: string, slip: string[]) {
  "use workflow";

  const results = [];

  for (let i = 0; i < slip.length; i++) {
    const result = await processStage(orderId, slip[i], i);
    results.push(result);
  }

  return { status: "completed", orderId, stages: results };
}

async function processStage(orderId: string, stage: string, index: number) {
  "use step";
  // Each stage runs as a durable step.
  // The slip defines the route — different requests, different paths.
}
```

<!-- split -->

Read the slip. Iterate. Each entry becomes a durable step. If the workflow crashes after stage 2 of 4, it resumes at stage 3. The completed stages are checkpointed.

The slip can be different for every request. The durability is the same for all of them.

<!-- split -->

No pipeline engine. No stage registry. No dispatch configuration. Just a loop over an array of steps.

Explore the interactive demo on v0: {v0_link}

## Variant C — "A for-loop that survives crashes"

The routing slip pattern is just: here's a list of things to do, do them in order. The hard part was always making that durable.

WDK makes a for-loop durable:

```ts
export async function routingSlip(orderId: string, slip: string[]) {
  "use workflow";

  const results = [];

  for (let i = 0; i < slip.length; i++) {
    const result = await processStage(orderId, slip[i], i);
    results.push(result);
  }

  return { status: "completed", orderId, stages: results };
}

async function processStage(orderId: string, stage: string, index: number) {
  "use step";
  // Each stage runs as a durable step.
  // The slip defines the route — different requests, different paths.
}
```

<!-- split -->

Each iteration creates a `"use step"`. Each step is checkpointed on completion. The slip can have 3 stages or 30. The pattern is identical.

Crash after any stage? Resume at the next one. The slip is data. The execution is durable.

<!-- split -->

Validate. Enrich. Transform. Deliver. Or just validate and deliver. The workflow adapts to the slip. Every path is crash-safe.

Explore the interactive demo on v0: {v0_link}
