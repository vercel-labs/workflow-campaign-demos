// getWritable is used here to stream demo UI events.
// A production workflow wouldn't need this unless it has its own streaming UI.
import { getWritable, sleep } from "workflow";

export type BulkheadEvent =
  | { type: "compartment_start"; compartment: number; items: string[] }
  | { type: "item_processing"; compartment: number; item: string }
  | { type: "item_success"; compartment: number; item: string; durationMs: number }
  | { type: "item_failure"; compartment: number; item: string; error: string }
  | { type: "pacing"; compartment: number }
  | { type: "summarizing" }
  | {
      type: "done";
      summary: {
        total: number;
        succeeded: number;
        failed: number;
        compartments: number;
      };
    };

type ItemResult = {
  item: string;
  compartment: number;
  ok: boolean;
  durationMs?: number;
  error?: string;
};

type BulkheadResult = {
  status: "done";
  total: number;
  succeeded: number;
  failed: number;
  compartments: number;
  results: ItemResult[];
};

// Demo: staggered delays per item position for visual progression
const ITEM_DELAY_MS = [600, 750, 900];

// Demo: compartment 2, item index 1 fails to show isolation
const FAIL_COMPARTMENT = 2;
const FAIL_INDEX = 1;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function bulkhead(
  jobId: string,
  items: string[],
  maxConcurrency: number
): Promise<BulkheadResult> {
  "use workflow";

  const results: ItemResult[] = [];
  let compartmentIndex = 0;

  for (let i = 0; i < items.length; i += maxConcurrency) {
    compartmentIndex++;
    const batch = items.slice(i, i + maxConcurrency);

    // Run compartment in parallel — failures are isolated
    const outcomes = await Promise.allSettled(
      batch.map((item, idx) =>
        processItem(jobId, item, compartmentIndex, idx)
      )
    );

    for (let j = 0; j < outcomes.length; j++) {
      const outcome = outcomes[j];
      if (outcome.status === "fulfilled") {
        results.push(outcome.value);
      } else {
        results.push({
          item: batch[j],
          compartment: compartmentIndex,
          ok: false,
          error: String(outcome.reason),
        });
      }
    }

    // Pacing delay between compartments
    if (i + maxConcurrency < items.length) {
      const writer = getWritable<BulkheadEvent>().getWriter();
      try {
        await writer.write({ type: "pacing", compartment: compartmentIndex });
      } finally {
        writer.releaseLock();
      }
      await sleep("1s");
    }
  }

  return summarizeResults(results, compartmentIndex);
}

async function processItem(
  jobId: string,
  item: string,
  compartment: number,
  indexInBatch: number
): Promise<ItemResult> {
  "use step";

  const writer = getWritable<BulkheadEvent>().getWriter();

  try {
    await writer.write({ type: "item_processing", compartment, item });

    const delayMs = ITEM_DELAY_MS[indexInBatch % ITEM_DELAY_MS.length];
    await delay(delayMs);

    // Demo: deterministic failure in compartment 2, index 1
    if (compartment === FAIL_COMPARTMENT && indexInBatch === FAIL_INDEX) {
      const error = `Service unavailable for ${item}`;
      await writer.write({ type: "item_failure", compartment, item, error });
      throw new Error(error);
    }

    await writer.write({
      type: "item_success",
      compartment,
      item,
      durationMs: delayMs,
    });

    return { item, compartment, ok: true, durationMs: delayMs };
  } finally {
    writer.releaseLock();
  }
}

async function summarizeResults(
  results: ItemResult[],
  compartments: number
): Promise<BulkheadResult> {
  "use step";

  const writer = getWritable<BulkheadEvent>().getWriter();

  try {
    await writer.write({ type: "summarizing" });
    await delay(500);

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.length - succeeded;
    const summary = { total: results.length, succeeded, failed, compartments };

    await writer.write({ type: "done", summary });

    return { status: "done", ...summary, results };
  } finally {
    writer.releaseLock();
  }
}
