---
slug: namespaced-streams
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-namespaced-streams
primitive: getWritable({ namespace: "..." })
pick: null
---

# Namespaced Streams — Multi-Channel Event Routing

Emit workflow events to multiple independent streams (draft and telemetry) simultaneously, each with its own subscriber.

## Variant A — "Two audiences, one workflow"

Your workflow generates draft content and telemetry data. The UI needs the drafts. The ops dashboard needs the metrics. Both consumers need events at the same time, but they should never see each other's traffic.

`getWritable({ namespace: "draft" })` and `getWritable({ namespace: "telemetry" })` give you two dedicated channels from the same workflow run.

<!-- split -->

Each namespace is an independent SSE stream. The workflow writes to whichever namespaces it needs, and each consumer subscribes only to the one it cares about.

No event tagging. No client-side filtering. The routing is the namespace string itself.

<!-- split -->

One workflow, multiple audiences, clean separation. No message broker, no pub/sub topics, no correlation IDs.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Server-side event routing without a broker"

Normally, routing events to different consumers means a message broker with topics, subscriptions, and filtering rules. That is a lot of infrastructure for "send drafts here and metrics there."

`getWritable({ namespace })` turns a string into a dedicated SSE channel. The consumer subscribes to the namespace it wants. The workflow writes to the namespace it means.

<!-- split -->

The workflow calls `getWritable({ namespace: "draft" })` when emitting content and `getWritable({ namespace: "telemetry" })` when emitting metrics. Each call returns an independent writable stream bound to that namespace.

On the client side, each subscriber connects to the SSE endpoint with the namespace it cares about. Events are separated at the source, not filtered at the destination.

<!-- split -->

No topic configuration. No subscription management. No fan-out service. The namespace string is the entire routing layer.

Explore the interactive demo on v0: {v0_link}

## Variant C — "No client-side filtering"

The typical pattern: one event stream, many event types, and every client filters for the subset it needs. That means every client receives every event and discards most of them.

Namespaced streams flip this around. The workflow writes to separate channels, and each client subscribes to exactly the events it needs — nothing more.

<!-- split -->

`getWritable({ namespace: "draft" })` emits only to the draft stream. `getWritable({ namespace: "telemetry" })` emits only to the telemetry stream. The UI subscribes to drafts. The ops dashboard subscribes to telemetry. Neither sees the other's events.

No type field to switch on. No filter predicate to maintain. No wasted bandwidth from events that get thrown away.

<!-- split -->

No message broker. No pub/sub topics. No event bus. Clean separation at the source, with each consumer receiving only what it asked for.

Explore the interactive demo on v0: {v0_link}
