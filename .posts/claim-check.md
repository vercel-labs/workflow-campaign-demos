---
slug: claim-check
day: null
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-claim-check
primitive: defineHook() for token-based claims
pick: null
---

# Claim Check — Large Payload by Reference

Accept a lightweight token instead of passing a large payload through every step. Retrieve the full payload only when a step actually needs it.

## Variant A — "50 MB through every step"

Your workflow processes a 50 MB upload. Every step serializes it, deserializes it, passes it to the next step. Memory spikes. Timeouts spike. Your bill spikes.

The traditional fix is uploading to blob storage, passing a reference URL, managing TTL cleanup workers, and coordinating across services for orphaned objects.

`defineHook()` gives you token-based claims natively. The workflow calls `blobReady.create()` with a hook token and receives a lightweight `blobToken` in return. Only a string enters the workflow, not a 50 MB payload.

<!-- split -->

Steps that need the payload redeem the token. Steps that don't just pass it along at zero cost. No deserialization tax on steps that never touch the bytes.

Durable steps mean the token survives restarts. Crash between steps? The token is still valid. The payload is still there. Redeem it once or ten times, same result.

<!-- split -->

No temp bucket policies. No orphaned objects. No presigned URL management. No multi-service cleanup coordination. Store once, reference everywhere, and let each step decide whether it needs the bytes.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Pass the ticket, not the suitcase"

A 50 MB payload flowing through ten steps means ten serialization cycles, ten memory allocations, and ten chances for a timeout. Most of those steps never even look at the bytes — they just pass them along.

`defineHook()` creates a claim token via `blobReady.create()`. The token is a string. It costs nothing to serialize, nothing to pass between steps, and nothing to checkpoint.

<!-- split -->

When a step actually needs the payload, it redeems the token. When it doesn't, the token passes through untouched. The workflow processes a string instead of a 50 MB blob for every step that doesn't need the data.

Durable checkpoints mean the token persists across restarts. The payload stays in storage. No re-upload. No broken references after a crash.

<!-- split -->

No serialization overhead on pass-through steps. No memory spikes from steps that never read the payload. No orphaned blob cleanup. A claim token replaces the payload in the workflow, and only the steps that need the bytes pay for them.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Tokens survive crashes"

You store a large payload in blob storage and pass a reference through your pipeline. The server crashes. When it restarts, is the reference still valid? Is the payload still there? Did the cleanup worker delete it during the restart window?

With `defineHook()`, the claim token is part of the durable workflow state. Crash between any two steps and the token is still valid on restart. The payload stays in storage until you explicitly remove it.

<!-- split -->

`blobReady.create()` returns a lightweight token that checkpoints with the workflow. No presigned URL expiration. No TTL race between the cleanup worker and the workflow restart. The token is valid as long as the workflow needs it.

Steps redeem the token on demand. Steps that don't need the payload never touch it, never deserialize it, never pay the memory cost.

<!-- split -->

No presigned URL expiration handling. No TTL coordination between cleanup workers and workflow restarts. No orphaned payload investigations. Durable tokens mean the claim check pattern works across crashes, restarts, and retries without any additional infrastructure.

Explore the interactive demo on v0: {v0_link}
