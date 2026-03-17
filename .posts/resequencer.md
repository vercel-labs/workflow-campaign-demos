---
slug: resequencer
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-resequencer
primitive: Promise.race() + defineHook() + buffer management
pick: null
---

# Resequencer — Out-of-Order Message Reassembly

Buffer out-of-order message fragments arriving via webhook and release them in correct sequence as each piece lands.

## Variant A — "Fragments arrive out of order"

Fragment 3 arrives. Then fragment 1. Then fragment 4. Then fragment 2. You need to emit them 1-2-3-4.

`defineHook()` receives each fragment, and `Promise.race()` waits for the next arrival. The workflow holds a buffer in durable state and releases fragments in sequence order.

<!-- split -->

Each incoming fragment triggers its hook. The workflow checks: is this the next expected sequence number? If yes, release it and flush any buffered successors that now form a contiguous run. If not, buffer it and wait.

Crash mid-reassembly? The buffer survives. The sequence pointer survives. It picks up exactly where it left off.

<!-- split -->

No buffer database. No sequence validation service. No periodic drain job. One workflow that holds fragments until they're ready, then emits them in order.

Explore the interactive demo on v0: {v0_link}

## Variant B — "The buffer that survives crashes"

You have buffered fragments 3, 4, and 5, waiting for fragment 2 to arrive so you can flush the run. The process crashes. When it restarts, is the buffer gone?

Durable workflow state means the buffer, the sequence pointer, and every buffered fragment survive the crash. The workflow resumes waiting for fragment 2 exactly where it left off.

<!-- split -->

`defineHook()` receives each fragment into durable state. The buffer is just workflow state — an array of fragments indexed by sequence number. The sequence pointer tracks the next expected number.

When the workflow resumes after a crash, it has the same buffer, the same pointer, and the same hook endpoints. Fragment 2 arrives, and the workflow flushes 2-3-4-5 in one contiguous run.

<!-- split -->

No external buffer database. No checkpoint table. No recovery procedure. The workflow state is the buffer, and durability is built in.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Contiguous run flushing"

Fragment 1 arrives and is emitted immediately. Fragment 3 arrives and is buffered. Fragment 4 arrives and is buffered. Fragment 2 arrives — now 2, 3, and 4 form a contiguous run and flush together.

The resequencer does not just reorder. It detects contiguous runs and releases them as a batch the moment the gap is filled.

<!-- split -->

`defineHook()` receives each fragment. The workflow maintains a sequence pointer and a buffer in durable state. Each arrival triggers a check: does this fragment fill the gap? If yes, release it and scan forward through the buffer, flushing every consecutive fragment until the next gap.

`Promise.race()` between the hook and a timeout ensures the workflow does not wait forever for a missing fragment.

<!-- split -->

No sorting step. No periodic drain. No batch timer. Fragments release the instant they can, in the correct order, with gaps handled naturally by the buffer.

Explore the interactive demo on v0: {v0_link}
