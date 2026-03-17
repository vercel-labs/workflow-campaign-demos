// getWritable + getStepMetadata are used here to stream demo UI events.
// A production workflow wouldn't need these unless it has its own streaming UI.
import { getWritable } from "workflow";

// Local FatalError — prevents the SDK's automatic retry for permanent failures.
// The workflow package does not export this class, so we define it here.
class FatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FatalError";
  }
}

export type LineItem = {
  sku: string;
  name: string;
  quantity: number;
  warehouse: string;
};

export type Order = {
  orderId: string;
  items: LineItem[];
};

export type SplitterEvent =
  | { type: "splitting"; orderId: string; itemCount: number }
  | { type: "item_processing"; index: number; sku: string; name: string }
  | { type: "item_validated"; index: number; sku: string }
  | { type: "item_reserved"; index: number; sku: string; warehouse: string }
  | { type: "item_fulfilled"; index: number; sku: string; hookToken: string }
  | { type: "item_failed"; index: number; sku: string; error: string }
  | { type: "aggregating" }
  | {
      type: "done";
      summary: { fulfilled: number; failed: number; total: number };
    };

type ItemResult = {
  index: number;
  sku: string;
  status: "fulfilled" | "failed";
  hookToken?: string;
  error?: string;
};

type SplitterReport = {
  orderId: string;
  status: "done";
  results: ItemResult[];
  summary: { fulfilled: number; failed: number; total: number };
};

// Demo: configures which item indices should fail for the interactive UI.
export type DemoFailures = {
  failIndices: number[];
};

const NO_FAILURES: DemoFailures = { failIndices: [] };

const ITEM_DELAY_MS = 600;
const AGGREGATE_DELAY_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emit(writer: WritableStreamDefaultWriter<SplitterEvent>) {
  return async (event: SplitterEvent) => {
    await writer.write(event);
  };
}

// The splitter pattern: receives a composite order, splits it into
// individual line items, and processes each one through validation,
// reservation, and fulfillment steps.
export async function orderSplitter(
  order: Order,
  failures: DemoFailures = NO_FAILURES
): Promise<SplitterReport> {
  "use workflow";

  const writer = getWritable<SplitterEvent>().getWriter();
  const send = emit(writer);

  try {
    await send({
      type: "splitting",
      orderId: order.orderId,
      itemCount: order.items.length,
    });

    // Split: process each line item as its own step sequence
    const results: ItemResult[] = [];
    for (let i = 0; i < order.items.length; i++) {
      const item = order.items[i];
      const shouldFail = failures.failIndices.includes(i);
      const result = await processLineItem(
        order.orderId,
        item,
        i,
        shouldFail
      );
      results.push(result);
    }

    // Aggregate results
    await send({ type: "aggregating" });
    await delay(AGGREGATE_DELAY_MS);

    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - fulfilled;
    const summary = { fulfilled, failed, total: results.length };

    await send({ type: "done", summary });

    return {
      orderId: order.orderId,
      status: "done",
      results,
      summary,
    };
  } finally {
    writer.releaseLock();
  }
}

async function processLineItem(
  orderId: string,
  item: LineItem,
  index: number,
  shouldFail: boolean
): Promise<ItemResult> {
  "use step";

  const writer = getWritable<SplitterEvent>().getWriter();
  const send = emit(writer);

  try {
    await send({
      type: "item_processing",
      index,
      sku: item.sku,
      name: item.name,
    });
    await delay(ITEM_DELAY_MS);

    // Validate
    await send({ type: "item_validated", index, sku: item.sku });
    await delay(ITEM_DELAY_MS / 2);

    // Simulate failure for demo
    if (shouldFail) {
      const error = `Insufficient stock for ${item.sku} at ${item.warehouse}`;
      await send({ type: "item_failed", index, sku: item.sku, error });
      throw new FatalError(error);
    }

    // Reserve inventory
    await send({
      type: "item_reserved",
      index,
      sku: item.sku,
      warehouse: item.warehouse,
    });
    await delay(ITEM_DELAY_MS / 2);

    // Fulfill — deterministic hook token based on orderId + itemIndex
    const hookToken = `${orderId}_item_${index}_${item.sku}`;
    await send({
      type: "item_fulfilled",
      index,
      sku: item.sku,
      hookToken,
    });

    return { index, sku: item.sku, status: "fulfilled", hookToken };
  } catch (err) {
    if (err instanceof FatalError) {
      return {
        index,
        sku: item.sku,
        status: "failed",
        error: err.message,
      };
    }
    throw err;
  } finally {
    writer.releaseLock();
  }
}
