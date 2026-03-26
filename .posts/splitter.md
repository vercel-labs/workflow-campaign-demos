---
slug: splitter
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-splitter
primitive: for loop + "use step" + getWritable()
pick: null
---

# Splitter — Decompose a Composite Order into Line Items

Receive a multi-item order, split it into individual line items, and process each one through validation, reservation, and fulfillment steps.

## Variant A — "One order, many items"

A customer places an order with five items from three different warehouses. Processing the order as a single unit means one failure rejects everything.

Splitting the order into individual line items lets each item succeed or fail independently. A `for` loop over the items with `"use step"` on each item's handler makes every item its own durable checkpoint.

<!-- split -->

No `defineHook()` needed here — this is pure compute. The workflow receives the full order, iterates over `order.items`, and calls a step function for each line item. Each step validates, reserves inventory, and fulfills independently.

`getWritable()` streams progress events for every item as they complete: processing, validated, reserved, fulfilled, or failed.

<!-- split -->

No message broker to split the payload. No coordination service to track sub-tasks. No fan-out queue per warehouse. A `for` loop, durable steps, and a writable stream — each item owns its own fate.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Partial fulfillment without partial failure"

Three of five items ship fine. One is out of stock. One has an invalid SKU. You need the three that work to ship immediately, not wait for the two that can't.

A `for` loop with `"use step"` processes each item as its own durable unit. `FatalError` stops retries on permanently failed items while the rest continue through the loop.

<!-- split -->

Each iteration calls a step function that validates, reserves, and fulfills a single line item. If stock is unavailable, throw `FatalError` — retries stop for that item only. The loop continues to the next item without interruption.

After all items are processed, the workflow aggregates results: which items fulfilled, which failed, and why. `getWritable()` streams each item's status in real time so the UI updates as items complete.

<!-- split -->

No dead letter queue for failed items. No separate retry policy per SKU. No compensating transaction for partial orders. The loop handles each item, `FatalError` handles permanent failures, and aggregation happens at the end.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Stream every item's progress as it happens"

Processing five items sequentially is fine for correctness. But showing the user a spinner for 30 seconds while five items process behind the scenes is not fine for UX.

`getWritable()` inside each step streams granular events — processing, validated, reserved, fulfilled — for every single line item as it happens.

<!-- split -->

The workflow opens a `WritableStream` and passes a writer into each step. As each line item moves through validation, reservation, and fulfillment, the step writes typed events to the stream. The client receives these events over SSE and updates the UI per item.

No polling. No periodic refresh. No "check back in 30 seconds." Each item's progress appears the moment the step writes it.

<!-- split -->

No WebSocket server. No pub/sub channel per order. No status endpoint to poll. `getWritable()` turns durable workflow steps into a real-time event stream that the client consumes directly over SSE.

Explore the interactive demo on v0: {v0_link}
