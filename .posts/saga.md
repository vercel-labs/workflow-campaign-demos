---
slug: saga
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-saga
primitive: FatalError + compensating transactions
pick: null
---

# Saga — Subscription Upgrade

Upgrade a subscription in 3 steps (reserve seats, capture invoice, provision). If any step fails, compensating transactions roll everything back automatically.

## Variant A — "The undo problem"

You charged the card. Then provisioning failed. Now you need to reverse the charge and release the seats.

Each durable step records a compensating function. If a later step throws `FatalError`, compensations run in reverse automatically.

<!-- split -->

Undo logic lives next to the do logic. Each compensation is a durable step — crashing mid-rollback picks up where it left off.

`FatalError` means "don't retry, roll back." Compensations unwind like a stack.

<!-- split -->

No saga orchestrator. No compensation queue. Just try/catch that survives restarts.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Rollbacks that crash mid-rollback"

Process crashes between compensation two and three. Half-rolled-back. Where did you stop?

Each compensation is a durable step. Crash mid-rollback and the workflow resumes at the exact compensation it was running.

<!-- split -->

`FatalError` triggers the rollback. The workflow walks compensations in reverse. Each one checkpoints on completion — crash at any point and it's safe.

Same durability guarantees for undo as for do.

<!-- split -->

No compensation log. No recovery sweeper. No idempotency checks on rollback steps. The workflow survives crashes in both directions.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Keep the undo next to the do"

Compensation logic drifts when it lives in a different file or service. Colocate each step with its undo and they stay in sync.

Throw `FatalError` and the workflow runs every registered compensation in reverse, each as its own durable step.

<!-- split -->

Reserve seats → register release. Capture invoice → register refund. Provision access → register revoke. Each pair lives together.

`FatalError` during provisioning refunds the invoice, then releases seats. Order is automatic. Durability is automatic.

<!-- split -->

No mapping table. No event bus connecting do-services to undo-services. One file where every action knows how to undo itself.

Explore the interactive demo on v0: {v0_link}
