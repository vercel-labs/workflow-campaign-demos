---
slug: routing-slip
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-routing-slip
primitive: sequential step execution with dynamic routing
pick: null
---

# Routing Slip — Dynamic Processing Pipeline

Execute a flexible sequence of processing stages defined in a routing slip, each stage completing before the next begins.

## Variant A — "The stages are data, not code paths"

The request arrives with a slip: validate, enrich, transform, deliver. Another request arrives with just: validate, deliver. The processing stages are data, not code.

A `for` loop over the slip array, with each iteration running as a `"use step"`, gives you a durable dynamic pipeline.

<!-- split -->

Each stage becomes a checkpointed step. If the workflow crashes after stage 2 of 4, it resumes at stage 3. The slip can be different for every request, but the durability guarantee is the same for all of them.

The slip defines the route. The steps make it crash-safe. Different requests take different paths through the same workflow.

<!-- split -->

No pipeline engine. No stage registry. No dispatch configuration. No routing table. Just a loop over an array of durable steps.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Crash at stage 3 of 5"

Your pipeline has five stages. The process crashes after completing stage 3. When it restarts, does it re-run stages 1 through 3 or pick up at stage 4?

Each stage in the routing slip runs as a `"use step"`. Completed steps are checkpointed. The workflow resumes at the exact stage where it left off.

<!-- split -->

The slip is just an array of stage names. A `for` loop iterates the array, executing each stage as a durable step. The step boundary is the checkpoint — once a stage completes, it is never re-executed.

Different requests carry different slips. A three-stage request and a seven-stage request run through the same workflow with the same durability guarantee.

<!-- split -->

No checkpoint table. No stage progress tracker. No idempotency layer. The durable step boundary is the checkpoint, and the loop index is the progress indicator.

Explore the interactive demo on v0: {v0_link}

## Variant C — "One workflow, many routes"

Request A needs validation, enrichment, and delivery. Request B needs validation and delivery. Request C needs enrichment, transformation, and delivery. Three different routes through the same set of processing stages.

The routing slip is an array attached to each request. The workflow loops over whatever stages the slip contains.

<!-- split -->

Each stage in the slip becomes a `"use step"` call. The workflow does not know in advance how many stages a request will have or which ones. It simply iterates the array and executes each one durably.

Adding a new stage means adding a string to the slip. Removing a stage means removing it. No workflow code changes required.

<!-- split -->

No routing table to update. No pipeline configuration file. No stage registry to maintain. The slip is the route, and the loop makes it durable.

Explore the interactive demo on v0: {v0_link}
