---
slug: claim-check
day: null
status: draft
v0_url: https://v0.app/chat/api/open?url=https://github.com/vercel-labs/workflow-claim-check
primitive: defineHook() for token-based claim
pick: null
---

# Claim Check — Large Payload by Reference

Accept a lightweight token instead of passing a large payload through every step. Retrieve the full payload only when a step actually needs it.

## Variant A — "Stop passing blobs around"


Your workflow processes a 50 MB upload. Every step serializes it, deserializes it, passes it to the next step. Memory spikes. Timeouts spike. Your bill spikes.

Traditional: upload to blob storage, pass a reference URL, remember to clean up temp objects, coordinate across services.

Or you pass a token and fetch on demand:

```ts
import { defineHook } from "workflow";

export const blobReady = defineHook<{ blobToken: string }>();

export async function claimCheckImport(importId: string) {
  "use workflow";

  const hookToken = `upload:${importId}`;

  // Claim-check: only a token enters the workflow (not a 50MB payload)
  const { blobToken } = await blobReady.create({ token: hookToken });

  // Retrieve and process the blob only when needed
  await processBlob(blobToken);

  return { importId, blobToken, status: "indexed" as const };
}

async function processBlob(blobToken: string) {
  "use step";
  // Fetch + index the large blob by its token
  await fetchAndIndex(blobToken);
}
```

<!-- split -->

`defineHook()` creates a claim token. The workflow stores a lightweight reference. When a step needs the payload, it redeems the token. One fetch, scoped to that step.

No blob URLs threaded through every function signature. No cleanup cron.

<!-- split -->

Upload lands. Token issued. Steps 1 through 4 pass a string, not a buffer. Step 3 redeems the token because it actually needs the bytes.

All durable. All lazy.

Explore the interactive demo on v0: {v0_link}

## Variant B — "Your payload is not your message"

Passing a 10 MB JSON blob through every workflow step is like mailing a filing cabinet instead of a claim ticket.

The claim check pattern fixes this: store the payload once, pass a token. Traditional approach? Blob storage, presigned URLs, TTL cleanup workers.

With WDK, `defineHook()` gives you token-based claims natively:

```ts
import { defineHook } from "workflow";

export const blobReady = defineHook<{ blobToken: string }>();

export async function claimCheckImport(importId: string) {
  "use workflow";

  const hookToken = `upload:${importId}`;

  // Claim-check: only a token enters the workflow (not a 50MB payload)
  const { blobToken } = await blobReady.create({ token: hookToken });

  // Retrieve and process the blob only when needed
  await processBlob(blobToken);

  return { importId, blobToken, status: "indexed" as const };
}

async function processBlob(blobToken: string) {
  "use step";
  // Fetch + index the large blob by its token
  await fetchAndIndex(blobToken);
}
```

<!-- split -->

The workflow holds a reference. Each step decides whether to redeem it. No deserialization tax on steps that don't care about the payload.

Durable steps mean the token survives restarts. Redeem it once or ten times, same result.

<!-- split -->

No temp bucket policies. No orphaned objects. No multi-service coordination for cleanup.

Explore the interactive demo on v0: {v0_link}

## Variant C — "Decouple size from flow"

Large payloads break workflow ergonomics. Serialization overhead, memory pressure, timeout risk, all because you're dragging bytes through steps that don't need them.

Claim check: store once, reference everywhere:

```ts
import { defineHook } from "workflow";

export const blobReady = defineHook<{ blobToken: string }>();

export async function claimCheckImport(importId: string) {
  "use workflow";

  const hookToken = `upload:${importId}`;

  // Claim-check: only a token enters the workflow (not a 50MB payload)
  const { blobToken } = await blobReady.create({ token: hookToken });

  // Retrieve and process the blob only when needed
  await processBlob(blobToken);

  return { importId, blobToken, status: "indexed" as const };
}

async function processBlob(blobToken: string) {
  "use step";
  // Fetch + index the large blob by its token
  await fetchAndIndex(blobToken);
}
```

<!-- split -->

`defineHook()` mints a durable token. The payload lives outside the workflow. Steps that need it call the hook. Steps that don't just pass the token along at zero cost.

Crash between steps? The token is still valid. The payload is still there.

<!-- split -->

Accept upload. Mint token. Five steps run. One redeems. The rest never touch the bytes.

Explore the interactive demo on v0: {v0_link}
