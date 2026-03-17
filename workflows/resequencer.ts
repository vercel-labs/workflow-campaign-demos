import { defineHook, getWritable, FatalError } from "workflow";

// Typed events streamed to the UI via getWritable()
export type ResequencerEvent =
  | { type: "waiting"; batchId: string; expectedCount: number; tokens: string[] }
  | { type: "fragment_received"; batchId: string; seq: number; payload: string }
  | { type: "fragment_buffered"; batchId: string; seq: number; bufferSize: number }
  | { type: "fragment_released"; batchId: string; seq: number; payload: string; nextExpected: number }
  | { type: "error"; batchId: string; message: string }
  | { type: "done"; batchId: string; ordered: string[] };

export type FragmentPayload = {
  seq: number;
  payload: string;
};

export const fragmentHook = defineHook<FragmentPayload>();

export async function resequencer(
  batchId: string,
  expectedCount: number
) {
  "use workflow";

  // Create one hook per expected fragment
  const tokens: string[] = [];
  const hooks = [];
  for (let i = 1; i <= expectedCount; i++) {
    const token = `resequencer:${batchId}:${i}`;
    tokens.push(token);
    hooks.push({ seq: i, hook: fragmentHook.create({ token }), token });
  }

  await emit<ResequencerEvent>({
    type: "waiting",
    batchId,
    expectedCount,
    tokens,
  });

  // Buffer for out-of-order fragments
  const buffer = new Map<number, string>();
  const ordered: string[] = [];
  let nextExpected = 1;

  // Wait for all fragments — they can arrive in any order
  const pending = new Map(
    hooks.map(({ seq, hook }) => [seq, hook.then((data) => ({ seq, payload: data.payload }))])
  );

  while (ordered.length < expectedCount) {
    // Race all still-pending hooks
    const result = await Promise.race([...pending.values()]);
    pending.delete(result.seq);

    await emit<ResequencerEvent>({
      type: "fragment_received",
      batchId,
      seq: result.seq,
      payload: result.payload,
    });

    // Guard: duplicate sequence (already released or buffered)
    if (ordered[result.seq - 1] !== undefined || buffer.has(result.seq)) {
      throw new FatalError(
        `Duplicate sequence ${result.seq} in batch ${batchId}`
      );
    }

    // Guard: sequence out of range
    if (result.seq < 1 || result.seq > expectedCount) {
      throw new FatalError(
        `Sequence ${result.seq} out of range [1, ${expectedCount}] in batch ${batchId}`
      );
    }

    if (result.seq === nextExpected) {
      // Fragment is the one we need — release immediately
      ordered.push(result.payload);
      nextExpected++;

      await emit<ResequencerEvent>({
        type: "fragment_released",
        batchId,
        seq: result.seq,
        payload: result.payload,
        nextExpected,
      });

      // Drain any contiguous buffered fragments
      while (buffer.has(nextExpected)) {
        const bufferedPayload = buffer.get(nextExpected)!;
        buffer.delete(nextExpected);
        ordered.push(bufferedPayload);

        await emit<ResequencerEvent>({
          type: "fragment_released",
          batchId,
          seq: nextExpected,
          payload: bufferedPayload,
          nextExpected: nextExpected + 1,
        });

        nextExpected++;
      }
    } else {
      // Out of order — buffer it
      buffer.set(result.seq, result.payload);

      await emit<ResequencerEvent>({
        type: "fragment_buffered",
        batchId,
        seq: result.seq,
        bufferSize: buffer.size,
      });
    }
  }

  await emit<ResequencerEvent>({ type: "done", batchId, ordered });

  return { batchId, ordered, status: "complete" as const };
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
