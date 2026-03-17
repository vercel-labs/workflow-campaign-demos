---
slug: process-manager
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-process-manager
primitive: sleep() for durable wait + branching logic
pick: null
---

# Process Manager — Multi-Stage Order Fulfillment

Orchestrate a multi-stage order: payment, inventory, reservation, shipping, delivery, with branching logic for backorders and durable waits for restocking.

## Variant A — "The state machine you don't need"

Payment clears. Inventory check says backordered. Now your order needs to wait 48 hours for restocking, then resume shipping. Traditional process managers need a state machine, a transition table in Postgres, a background job scheduler, and a cron that polls for resumable orders.

`sleep("48h")` makes the workflow durably pause and resume itself. Branching logic is just `if/else`.

<!-- split -->

Each stage is a `"use step"`. Backorder? `sleep("48h")` and recheck. Payment failed? Return early and cancel. The sleep survives restarts, redeployments, and infrastructure changes.

Crash mid-shipment? The workflow resumes at the shipping step. Sleep for 48 hours? It wakes up at exactly 48 hours.

<!-- split -->

No state transition table. No BPMN diagrams. No timer service. No scheduler. Just an async function that happens to survive anything.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Backorder? Sleep 48 hours and pick up where you left off."

The order is paid. Inventory says out of stock. Restocking takes two days. In a traditional system, you save the order state, schedule a background job for 48 hours from now, and hope the job runner is still healthy when it fires.

`sleep("48h")` pauses the workflow durably. No external scheduler. No state to save. The workflow just waits and resumes at the exact moment.

<!-- split -->

The backorder branch is an `if` statement. The wait is a `sleep()`. The recheck is the next step. Redeploy during the 48-hour pause? The workflow wakes up on schedule. Infrastructure restart? Same thing.

Payment branch, backorder branch, shipping branch — all just `if/else` in a single function. Each stage is a `"use step"` with its own retry behavior.

<!-- split -->

No state machine library. No workflow engine. No timer database. No job scheduler polling for resumable orders. Branching logic in code, durable sleeps for waits, and the runtime handles persistence.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Five stages, three branches, one function"

Payment. Inventory. Backorder wait. Shipping. Delivery confirmation. Traditional process managers model this as a state machine with a transition table, a persistence layer, a scheduler for timed transitions, and a recovery system for crashes.

This is an async function with `if/else` branches and `sleep()` calls. Each stage is a `"use step"`. Each wait is durable. Each branch is code.

<!-- split -->

Payment fails? Early return. Inventory available? Skip to shipping. Backordered? `sleep("48h")` and recheck. The control flow reads like the business logic because it is the business logic.

Crash at any stage and the workflow replays completed steps from the log, then resumes at the exact point of failure. Durable sleeps wake up on schedule regardless of restarts.

<!-- split -->

No BPMN engine. No state transition table. No workflow DSL. No cron jobs. A single function that branches, waits, retries, and survives infrastructure failures.

Explore the interactive demo on v0: {v0_link}
