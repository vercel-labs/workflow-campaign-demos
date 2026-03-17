---
slug: event-gateway
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-event-gateway
primitive: Promise.race() + Promise.all() + defineHook() + sleep()
pick: null
---

# Event Gateway — Multi-Signal Aggregation

Wait for multiple required signals (payment, inventory, fraud check) to all arrive, or timeout, before shipping an order.

## Variant A — "The correlation table problem"

Before you ship an order, three things must be true: payment cleared, inventory reserved, fraud check passed. They arrive at different times from different services. Building a correlation table and polling loop per signal gets complicated fast.

`defineHook()` creates a durable signal endpoint for each event. `Promise.all()` gates on all three. `Promise.race()` wraps the gate with a `sleep()` timeout.

<!-- split -->

Whichever resolves first wins. If all signals arrive before the deadline, the order ships. If `sleep()` wins the race, the order times out.

Each hook is durable. If the workflow crashes after payment clears but before fraud passes, it resumes with payment already recorded.

<!-- split -->

No correlation table. No polling loop. No approval service. No completion database. Three hooks, one race, one file.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Three services, three timelines, one deadline"

Payment clears in 2 seconds. Inventory reservation takes 10. Fraud check takes anywhere from 1 second to never. You need all three before you can ship, but you can't wait forever.

`defineHook()` registers a durable endpoint for each signal. `Promise.all()` requires all three. `Promise.race()` pits the gate against a `sleep()` deadline.

<!-- split -->

Signals arrive in any order. The workflow doesn't care which comes first. `Promise.all()` resolves the moment all three hooks have fired. If the deadline hits first, `sleep()` wins the race and the order times out gracefully.

Crash between the second and third signal? The workflow resumes with the first two already recorded. Only the missing signal is still pending.

<!-- split -->

No state machine. No event correlation service. No completion tracking database. Hooks for signals, a race for the deadline, and `Promise.all()` for the gate.

Explore the interactive demo on v0: {v0_link}

## Variant C — "What if the fraud check never comes?"

Payment and inventory are fast. Fraud check depends on a third party that sometimes goes silent. Without a timeout, your order sits in limbo. With a naive timeout, you lose track of which signals already arrived.

`Promise.race()` between `Promise.all()` and `sleep()` gives you a clean answer: either everything arrived or the deadline expired. `defineHook()` makes each signal durable and individually trackable.

<!-- split -->

The fraud service responds at minute 3? The hook captures it. The workflow already timed out at minute 2? The timeout path runs. No ambiguity, no partial states, no signals arriving after you've moved on causing side effects.

Each hook persists independently. The workflow knows exactly which signals arrived and which didn't when it makes its decision.

<!-- split -->

No polling for missing signals. No TTL columns in a database. No cron job sweeping stale orders. A race between completion and a deadline, with durable hooks that survive anything.

Explore the interactive demo on v0: {v0_link}
