// getWritable + getStepMetadata are used here to stream demo UI events.
// A production workflow wouldn't need these unless it has its own streaming UI.
import { getStepMetadata, getWritable } from "workflow";

export type ItemId = string;
export type ConsumerId = string;

export type CCEvent =
  | { type: "claiming"; itemId: string; consumerId: string }
  | { type: "claimed"; itemId: string; consumerId: string }
  | { type: "duplicate"; itemId: string; consumerId: string; wonBy: string }
  | { type: "processing"; itemId: string; consumerId: string }
  | { type: "processed"; itemId: string; consumerId: string }
  | { type: "done"; summary: { processed: number; duplicatesBlocked: number } };

type ItemResult = {
  itemId: string;
  claimedBy: string;
  duplicateAttempts: number;
  status: "processed";
};

type QueueReport = {
  status: "done";
  results: ItemResult[];
  summary: {
    processed: number;
    duplicatesBlocked: number;
  };
};

// Demo: simulated processing latency so the UI can show progress
const CLAIM_DELAY_MS = 400;
const PROCESS_DELAY_MS = 800;
const SUMMARY_DELAY_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Each item is processed exactly once. Multiple consumers attempt to claim
// the same item, but deterministic workflow IDs mean duplicate starts are
// no-ops — the runtime deduplicates at the execution level.
export async function competingConsumers(
  items: string[],
  consumers: string[]
): Promise<QueueReport> {
  "use workflow";

  const results: ItemResult[] = [];

  // Simulate consumers racing to claim each item. In production,
  // start() with id: `process-item-${itemId}` deduplicates automatically.
  for (const itemId of items) {
    const result = await processItem(itemId, consumers);
    results.push(result);
  }

  return recordResults(results);
}

async function processItem(
  itemId: string,
  consumers: string[]
): Promise<ItemResult> {
  "use step";

  const writer = getWritable<CCEvent>().getWriter();
  const { attempt } = getStepMetadata();

  try {
    // Simulate multiple consumers trying to claim the same item.
    // The first consumer wins; the rest are blocked as duplicates.
    const winnerIndex = Math.abs(hashCode(itemId)) % consumers.length;
    const winner = consumers[winnerIndex];
    let duplicateAttempts = 0;

    for (let i = 0; i < consumers.length; i++) {
      const consumerId = consumers[i];
      await writer.write({ type: "claiming", itemId, consumerId });
      await delay(CLAIM_DELAY_MS);

      if (i === winnerIndex) {
        await writer.write({ type: "claimed", itemId, consumerId });
      } else {
        duplicateAttempts++;
        await writer.write({
          type: "duplicate",
          itemId,
          consumerId,
          wonBy: winner,
        });
      }
    }

    // The winning consumer processes the item
    await writer.write({ type: "processing", itemId, consumerId: winner });
    await delay(PROCESS_DELAY_MS);
    await writer.write({ type: "processed", itemId, consumerId: winner });

    return {
      itemId,
      claimedBy: winner,
      duplicateAttempts,
      status: "processed",
    };
  } finally {
    writer.releaseLock();
  }
}

async function recordResults(
  results: ItemResult[]
): Promise<QueueReport> {
  "use step";

  const writer = getWritable<CCEvent>().getWriter();

  try {
    await delay(SUMMARY_DELAY_MS);

    const processed = results.length;
    const duplicatesBlocked = results.reduce(
      (sum, r) => sum + r.duplicateAttempts,
      0
    );

    const report: QueueReport = {
      status: "done",
      results,
      summary: { processed, duplicatesBlocked },
    };

    await writer.write({ type: "done", summary: report.summary });
    return report;
  } finally {
    writer.releaseLock();
  }
}

// Simple deterministic hash for assigning items to consumers
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}
