---
slug: message-history
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-message-history
primitive: step-level error handling + history envelope
pick: null
---

# Message History — Support Ticket Pipeline

Route a support ticket through normalize, classify, route, and dispatch, with full history tracking at every step.

## Variant A — "Every step leaves a receipt"


A support ticket flows through four steps: normalize, classify, route, dispatch. Something goes wrong at step 3. What happened at step 1? You check the audit log. It's missing entries.

Traditional: an audit log database, triggers per step, a separate service to rebuild history on demand, and hope that every step remembered to write its log entry.

Or each step appends to a history envelope that flows through the workflow:

```ts
export async function messageHistory(subject: string, body: string) {
  "use workflow";

  let envelope = { subject, body, severity: null, route: null, history: [] };

  envelope = await normalizeTicket(envelope);
  envelope = await classifySeverity(envelope);
  envelope = await chooseRoute(envelope);
  envelope = await dispatchTicket(envelope);

  return envelope; // includes full history from every step
}

async function normalizeTicket(envelope) {
  "use step";
  const normalized = envelope.subject.trim().toLowerCase();
  return appendHistory(
    { ...envelope, subject: normalized },
    { step: "normalize", status: "succeeded" }
  );
}
```

<!-- split -->

Every step receives the message plus its history. Every step appends its result before passing forward. The envelope is the audit trail. No external log needed.

Step fails? The history shows exactly what happened before the failure. No missing entries. No log reconstruction.

<!-- split -->

Normalize: cleaned input, logged. Classify: priority high, logged. Route: team assigned, logged. Dispatch: sent, logged. Full history in one object.

No audit log DB. No triggers. No reconstruction service.

Explore the interactive demo on v0: {v0_link}

## Variant B — "The message is the log"

Audit trails for multi-step pipelines usually mean a separate logging service, a correlation ID, and a query to reconstruct what happened after the fact.

What if the message itself carried its history?

```ts
export async function messageHistory(subject: string, body: string) {
  "use workflow";

  let envelope = { subject, body, severity: null, route: null, history: [] };

  envelope = await normalizeTicket(envelope);
  envelope = await classifySeverity(envelope);
  envelope = await chooseRoute(envelope);
  envelope = await dispatchTicket(envelope);

  return envelope; // includes full history from every step
}

async function normalizeTicket(envelope) {
  "use step";
  const normalized = envelope.subject.trim().toLowerCase();
  return appendHistory(
    { ...envelope, subject: normalized },
    { step: "normalize", status: "succeeded" }
  );
}
```

<!-- split -->

Each durable step wraps its output in a history entry: timestamp, step name, result, any errors. The next step receives the full envelope. The pipeline output includes the complete processing history.

Step-level error handling means a failure at classify doesn't lose the normalize result. The history envelope captures both successes and failures.

<!-- split -->

No external audit log. No correlation ID lookup. No "rebuild from events" step. The message carries its own history through every step.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Pipeline observability for free"

Four steps. Four potential failure points. Traditional observability: instrument each step, ship logs to a collector, correlate by request ID, build a dashboard.

Or let the workflow carry its own history:

```ts
export async function messageHistory(subject: string, body: string) {
  "use workflow";

  let envelope = { subject, body, severity: null, route: null, history: [] };

  envelope = await normalizeTicket(envelope);
  envelope = await classifySeverity(envelope);
  envelope = await chooseRoute(envelope);
  envelope = await dispatchTicket(envelope);

  return envelope; // includes full history from every step
}

async function normalizeTicket(envelope) {
  "use step";
  const normalized = envelope.subject.trim().toLowerCase();
  return appendHistory(
    { ...envelope, subject: normalized },
    { step: "normalize", status: "succeeded" }
  );
}
```

<!-- split -->

The history envelope accumulates as the message flows. Normalize appends. Classify appends. Route appends. Dispatch appends. At the end, you have a complete trace, not in a log aggregator, but in the workflow output.

Durable steps mean crash recovery doesn't lose history. The envelope persists across restarts.

<!-- split -->

Support ticket in. Four steps. Full trace out. No log aggregator. No correlation service. No missing entries.

Explore the interactive demo on v0: {v0_link}
