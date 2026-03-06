import { defineHook, getWritable } from "workflow";

// Typed events streamed to the UI via getWritable()
export type ClaimCheckEvent =
  | { type: "start"; importId: string; hookToken: string }
  | { type: "waiting"; importId: string; hookToken: string }
  | { type: "upload_received"; importId: string; blobToken: string }
  | { type: "processing"; importId: string; blobToken: string }
  | { type: "completed"; importId: string; blobToken: string }
  | { type: "done"; importId: string; status: "indexed" };

export const blobReady = defineHook<{ blobToken: string }>();

export async function claimCheckImport(importId: string) {
  "use workflow";

  const hookToken = `upload:${importId}`;

  await emit<ClaimCheckEvent>({ type: "start", importId, hookToken });
  await emit<ClaimCheckEvent>({ type: "waiting", importId, hookToken });

  // Claim-check: only a token enters the workflow (not a 50MB payload).
  const { blobToken } = await blobReady.create({ token: hookToken });

  await emit<ClaimCheckEvent>({ type: "upload_received", importId, blobToken });

  await emit<ClaimCheckEvent>({ type: "processing", importId, blobToken });
  await processBlob(blobToken);

  await emit<ClaimCheckEvent>({ type: "completed", importId, blobToken });
  await emit<ClaimCheckEvent>({ type: "done", importId, status: "indexed" });

  return { importId, blobToken, status: "indexed" as const };
}

/**
 * Step: Emit a single event to the UI stream.
 * Re-acquires the writer inside the step so it survives durable suspension.
 */
async function emit<T>(event: T): Promise<void> {
  "use step";
  const writer = getWritable<T>().getWriter();
  try {
    await writer.write(event);
  } finally {
    writer.releaseLock();
  }
}

async function processBlob(blobToken: string) {
  "use step";
  // Simulate fetching + indexing a large blob by its token
  await delay(700);
  console.info("[claim-check] process_blob", { blobToken });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
