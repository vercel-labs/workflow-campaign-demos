---
slug: message-history
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-message-history
primitive: step-level error handling + history envelope
pick: null
---

# Message History — Support Ticket Pipeline

Route a support ticket through normalize, classify, route, and dispatch, with full history tracking at every step.

## Variant A — "Where did step 1 go?"

A support ticket flows through four steps. Something breaks at step 3. You check the audit log to see what happened at step 1. Entries are missing because one of the earlier steps forgot to write its log.

The usual fix is a separate audit database, per-step triggers, and a reconstruction service to piece it all together after the fact.

Instead, each step appends to a history envelope that flows through the workflow using `"use step"` functions. Every step receives the message plus its full history and appends its own result before passing forward.

<!-- split -->

The envelope itself becomes the audit trail. `normalizeTicket` cleans the input and logs it. `classifySeverity` assigns priority and logs it. `chooseRoute` picks a team and logs it. `dispatchTicket` sends and logs it. Each function uses `appendHistory()` to record its step name, status, and timestamp.

If a step fails, the history shows exactly what succeeded before the failure. No missing entries. No log reconstruction. Durable steps mean the envelope persists across restarts.

<!-- split -->

No audit log database. No triggers. No correlation ID lookup. No external reconstruction service. The message carries its own history through every step, and the workflow output includes the complete processing trace.

Explore the interactive demo on v0: {v0_link}

## Variant B — "The audit trail that writes itself"

Every compliance team asks the same question: show me exactly what happened to this ticket, in order, with timestamps. Building that from scattered logs across four services is a weekend project.

A history envelope carried inside the workflow means every step inherits the full trace and appends its own entry. `appendHistory()` records the step name, status, and timestamp automatically. No separate logging infrastructure required.

<!-- split -->

`normalizeTicket`, `classifySeverity`, `chooseRoute`, `dispatchTicket` — each one reads the envelope, does its work, and adds a line. The envelope is the source of truth. If `chooseRoute` fails, you see exactly what `normalizeTicket` and `classifySeverity` produced before the failure.

Durable steps mean the envelope survives crashes. Restart the workflow and the history picks up where it left off.

<!-- split -->

No log aggregation pipeline. No correlation IDs stitched together after the fact. No missing entries from steps that forgot to emit events. One envelope, four steps, complete traceability from input to dispatch.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Four steps, zero log gaps"

Four processing steps. Four chances for a log entry to go missing. Traditional pipelines scatter their audit data across services, and reconstruction requires correlating timestamps, IDs, and formats that never quite match.

The history envelope pattern keeps every step's output in one object. Each `"use step"` function receives the envelope, processes the ticket, and appends its result via `appendHistory()` before passing it forward.

<!-- split -->

The envelope grows as the ticket moves. Normalize appends cleaned data. Classify appends severity. Route appends team assignment. Dispatch appends delivery confirmation. At any point, the current state of the envelope tells you everything that happened.

When a step fails, the envelope shows the last successful state. No gaps. No guessing which step ran and which didn't.

<!-- split -->

No external audit service. No per-step logging triggers. No post-hoc reconstruction. The message carries its complete history, and the workflow output is the audit trail. Four steps, zero log gaps.

Explore the interactive demo on v0: {v0_link}
