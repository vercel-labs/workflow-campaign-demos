---
slug: event-sourcing
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-event-sourcing
primitive: getWritable() + append-only event log + projection replay
pick: null
---

# Event Sourcing — Append Events Now, Rebuild State Later

Validate commands against the current projection, append domain events to an immutable log, and replay them to rebuild state from scratch.

## Variant A — "Never lose a state transition"

You mutate the current state on every update. A bug corrupts the data and there's no audit trail. The only recovery is restoring from a backup.

With event sourcing, the event log is the source of truth. The current state is just a projection — rebuilt by replaying every event from the beginning.

<!-- split -->

Each command is validated against the current projection. Valid commands produce exactly one domain event. Invalid commands are rejected without mutating anything.

The projection is a pure fold over the event log. Replay it to rebuild state, debug an issue, or verify consistency.

<!-- split -->

No database triggers. No change-data-capture pipeline. No separate event store. The workflow is the event log and the projection is rebuilt in a single replay step.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Commands that validate themselves"

An order can't ship before payment is authorized. A cancelled order can't be shipped. These rules live in the command validation — not in database constraints or middleware.

Each command checks the current projection before appending an event. If the state transition is invalid, the command is rejected and the event log stays unchanged.

<!-- split -->

`CreateOrder` → `AuthorizePayment` → `ReserveInventory` → `ShipOrder` is the valid path. Try to skip a step and the workflow rejects the command with a reason.

The event log only grows. Invalid commands don't append events. The projection always reflects the valid state transitions.

<!-- split -->

No middleware validation chain. No database constraints checking order status. No separate validation service. The workflow validates, appends, and projects — all in one place.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Replay to verify"

You've been running the order system for months. A new requirement changes how shipping works. How do you verify the new projection logic against existing data?

Replay the event log through the new projection function. If the result matches, the migration is safe. If it doesn't, you know exactly which events diverge.

<!-- split -->

The replay step walks the event log from the beginning, applying each domain event to an empty projection. The final state should match the live projection exactly.

This isn't just a consistency check — it's how you migrate projection logic safely. New business rules? Replay and compare.

<!-- split -->

No migration scripts. No dual-write period. No shadow mode. Replay the log, compare the projections, and deploy with confidence.

Explore the interactive demo on v0: {v0_link}
