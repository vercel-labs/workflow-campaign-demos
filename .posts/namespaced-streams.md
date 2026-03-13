---
slug: namespaced-streams
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-namespaced-streams
primitive: getWritable({ namespace: "..." })
pick: null
---

# Namespaced Streams — Multi-Channel Event Routing

Emit workflow events to multiple independent streams (draft and telemetry) simultaneously, each with its own subscriber.

## Variant A — "One workflow, two audiences"


Your workflow generates draft content and telemetry data. The UI needs the drafts. The ops dashboard needs the metrics. Both at the same time.

Traditional: two message brokers, pub/sub topics, correlation IDs to stitch events back to the right run.

With WDK you call `getWritable({ namespace: "..." })` and each stream gets its own channel:

```ts
import { getWritable } from "workflow";

export async function generatePost(topic: string) {
  "use workflow";

  const draft = getWritable({ namespace: "draft" }).getWriter();
  const telemetry = getWritable({ namespace: "telemetry" }).getWriter();

  await telemetry.write({ type: "start", name: "generatePost" });

  const outline = await buildOutline(topic);
  await draft.write({ type: "chunk", text: outline });
  await telemetry.write({ type: "tokens", input: 45, output: 120 });

  const sections = await writeSections(topic, outline);
  for (const section of sections) {
    await draft.write({ type: "chunk", text: section });
  }

  await telemetry.write({ type: "done", totalTokens: 945 });
}
```

<!-- split -->

One workflow, multiple namespaces. The draft stream pushes content to the editor UI. The telemetry stream pushes timing and status to your dashboard.

No broker. No correlation IDs. Each namespace is just a scoped writable you subscribe to independently.

<!-- split -->

Write to `"draft"`. Write to `"telemetry"`. Each consumer reads only the events it cares about.

One workflow file. Zero pub/sub infrastructure.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Stop multiplexing your event streams"

You have one workflow emitting events for two completely different consumers. So you tag every event, filter on the client, and pray nothing mis-routes.

`getWritable({ namespace: "draft" })` gives you a dedicated channel. `getWritable({ namespace: "telemetry" })` gives you another:

```ts
import { getWritable } from "workflow";

export async function generatePost(topic: string) {
  "use workflow";

  const draft = getWritable({ namespace: "draft" }).getWriter();
  const telemetry = getWritable({ namespace: "telemetry" }).getWriter();

  await telemetry.write({ type: "start", name: "generatePost" });

  const outline = await buildOutline(topic);
  await draft.write({ type: "chunk", text: outline });
  await telemetry.write({ type: "tokens", input: 45, output: 120 });

  const sections = await writeSections(topic, outline);
  for (const section of sections) {
    await draft.write({ type: "chunk", text: section });
  }

  await telemetry.write({ type: "done", totalTokens: 945 });
}
```

<!-- split -->

Each namespace is an independent SSE stream. Subscribe to one, subscribe to both. The workflow doesn't care. It just writes to the namespace it was given.

No event tagging. No client-side filtering. No shared bus.

<!-- split -->

Draft events go to the editor. Telemetry events go to the dashboard. Clean separation, zero coordination.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Pub/sub without the pub/sub"

Traditional multi-consumer workflows need a message broker, topic routing, and subscriber management. That's three systems before you write business logic.

WDK namespaced streams replace all of it with one function call:

```ts
import { getWritable } from "workflow";

export async function generatePost(topic: string) {
  "use workflow";

  const draft = getWritable({ namespace: "draft" }).getWriter();
  const telemetry = getWritable({ namespace: "telemetry" }).getWriter();

  await telemetry.write({ type: "start", name: "generatePost" });

  const outline = await buildOutline(topic);
  await draft.write({ type: "chunk", text: outline });
  await telemetry.write({ type: "tokens", input: 45, output: 120 });

  const sections = await writeSections(topic, outline);
  for (const section of sections) {
    await draft.write({ type: "chunk", text: section });
  }

  await telemetry.write({ type: "done", totalTokens: 945 });
}
```

<!-- split -->

`getWritable({ namespace: "draft" })`: a scoped, typed stream. Your workflow writes to as many namespaces as it needs. Each consumer connects to the namespace it wants.

The routing is the namespace string. That's it.

<!-- split -->

Emit drafts and telemetry from the same workflow run. Two independent streams. Two independent consumers. One file.

No message broker. No topic configuration. No correlation IDs.

Explore the interactive demo on v0: {v0_link}
