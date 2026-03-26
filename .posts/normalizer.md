---
slug: normalizer
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-normalizer
primitive: for loop + "use step" + format parsers
pick: null
---

# Normalizer — Transform Heterogeneous Inputs into Canonical Format

Receive messages in multiple formats (XML, CSV, legacy JSON), detect the format, parse each into a canonical order shape, and emit normalized results.

```ts
export async function parseToCanonical(messages: DetectedMessage[]) {
  "use step";
  const writer = getWritable<NormalizeEvent>().getWriter();
  const successful: CanonicalOrder[] = [];
  const failed: { messageId: string; error: string }[] = [];

  for (const msg of messages) {
    const canonical = parseMessage(msg); // xml | csv | legacy-json → canonical
    successful.push(canonical);
    await writer.write({ type: "normalize_parse", messageId: msg.id, canonical });
  }

  writer.close();
  return { successful, failed };
}
```

## Variant A — "Three formats, one shape"

XML from the legacy system. CSV from the batch import. JSON from the new API. Three formats, three parsers, three ways to break. You need them all to look the same before anything downstream can use them.

A `for` loop with `"use step"` processes each message independently. Format detection identifies the shape, a parser converts it to the canonical form, and `getWritable()` streams each result as it completes.

<!-- split -->

Each message gets its own durable checkpoint. The detect step inspects the payload and tags its format. The parse step dispatches to the right parser — regex for XML, split for CSV, `JSON.parse()` for legacy JSON. Every parser outputs the same `CanonicalOrder` shape.

Crash after parsing three of six messages? The three completed parses replay instantly from the log. Only the remaining three re-execute.

<!-- split -->

No ETL service. No format-specific queues. No schema registry. A loop, format detection, three parsers, and one canonical shape. Every message normalized, every result streamed.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Partial normalization beats total failure"

Six messages arrive. Five parse cleanly. One has a corrupted CSV row. Do you reject all six and retry the whole batch? Or normalize the five that work and report the one that didn't?

Each message is its own durable step. A failed parse catches the error, records it, and moves to the next message. `getWritable()` streams both successes and failures in real time.

<!-- split -->

The parse step wraps each format conversion in a try/catch. Successful parses produce a `CanonicalOrder` and write a `normalize_parse` event. Failed parses write a `normalize_result` event with the error. The loop continues either way.

Strict mode flips the behavior: any failure throws `FatalError` and stops the workflow. The choice is yours at invocation time.

<!-- split -->

No dead letter queue for malformed messages. No separate error pipeline. No retry-the-whole-batch logic. Parse what you can, report what you can't, and let the caller decide how strict to be.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Format detection you can watch"

Messages arrive without reliable format metadata. The payload might be XML, CSV, or legacy JSON — you need to detect it before you can parse it. And you want to see the detection happen in real time.

A detect step inspects each payload, tags the format, and streams detection events via `getWritable()`. The parse step consumes the tagged messages and converts them to canonical form.

<!-- split -->

Two steps, each with its own writable stream. The detect step emits `normalize_detect` events as it identifies each message's format. The parse step emits `normalize_parse` events as it converts each message. The client receives both event types over SSE and renders a two-phase pipeline.

Every detection and every parse is a durable checkpoint. Crash between detect and parse? Detections replay from the log, parsing resumes where it left off.

<!-- split -->

No format validation service. No pre-processing queue. No schema inference engine. Detect, parse, emit — two steps, one canonical shape, and the whole pipeline visible in real time.

Explore the interactive demo on v0: {v0_link}
