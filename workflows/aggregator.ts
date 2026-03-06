import { defineHook, getWritable, sleep } from "workflow";

// ---------------------------------------------------------------------------
// Typed events streamed to the UI via getWritable()
// ---------------------------------------------------------------------------
export type AggregatorEvent =
  | { type: "collecting"; batchId: string; tokens: Record<string, string>; expectedCount: number; timeoutMs: number }
  | { type: "signal_received"; batchId: string; source: string; value: number; receivedCount: number; expectedCount: number }
  | { type: "all_collected"; batchId: string }
  | { type: "timeout"; batchId: string; missing: string[]; received: string[] }
  | { type: "processing"; batchId: string }
  | { type: "done"; batchId: string; status: "aggregated" | "partial"; summary: AggregatorSummary };

export type AggregatorSummary = {
  totalSignals: number;
  receivedSignals: number;
  totalValue: number;
  sources: string[];
};

// ---------------------------------------------------------------------------
// Hook definition — each source sends { source, value }
// ---------------------------------------------------------------------------
export type SignalPayload = { source: string; value: number };

export const aggregatorSignal = defineHook<SignalPayload>();

const SOURCES = ["warehouse-a", "warehouse-b", "warehouse-c"] as const;
export type SourceId = (typeof SOURCES)[number];

// ---------------------------------------------------------------------------
// Workflow: collect N signals with a timeout, then aggregate
// ---------------------------------------------------------------------------
export async function aggregator(
  batchId: string,
  timeoutMs: number = 8000
): Promise<{ batchId: string; status: "aggregated" | "partial"; summary: AggregatorSummary }> {
  "use workflow";

  // Create one hook per source with deterministic tokens
  const tokens: Record<string, string> = {};
  const hooks = SOURCES.map((source) => {
    const token = `${source}:${batchId}`;
    tokens[source] = token;
    return { source, hook: aggregatorSignal.create({ token }), token };
  });

  await emit<AggregatorEvent>({
    type: "collecting",
    batchId,
    tokens,
    expectedCount: SOURCES.length,
    timeoutMs,
  });

  // Track received signals
  const received = new Map<string, SignalPayload>();

  const signalPromises = hooks.map(({ source, hook }) =>
    hook.then((payload) => {
      received.set(source, payload);
      return { source, payload };
    })
  );

  // Race: collect all signals OR timeout
  const outcome = await Promise.race([
    Promise.all(signalPromises).then((results) => ({
      type: "ready" as const,
      results,
    })),
    sleep(`${timeoutMs}ms`).then(() => ({
      type: "timeout" as const,
      results: [] as { source: string; payload: SignalPayload }[],
    })),
  ]);

  // Emit signal_received events for signals that arrived
  for (const { source, payload } of outcome.results) {
    await emit<AggregatorEvent>({
      type: "signal_received",
      batchId,
      source,
      value: payload.value,
      receivedCount: received.size,
      expectedCount: SOURCES.length,
    });
  }

  if (outcome.type === "timeout") {
    const receivedSources = [...received.keys()];
    const missing = SOURCES.filter((s) => !received.has(s));

    // Also emit any signals that arrived before timeout (via received map)
    for (const [source, payload] of received) {
      if (!outcome.results.some((r) => r.source === source)) {
        await emit<AggregatorEvent>({
          type: "signal_received",
          batchId,
          source,
          value: payload.value,
          receivedCount: received.size,
          expectedCount: SOURCES.length,
        });
      }
    }

    await emit<AggregatorEvent>({ type: "timeout", batchId, missing, received: receivedSources });
    const summary = await processBatch(batchId, received);
    await emit<AggregatorEvent>({ type: "done", batchId, status: "partial", summary });
    return { batchId, status: "partial" as const, summary };
  }

  await emit<AggregatorEvent>({ type: "all_collected", batchId });
  const summary = await processBatch(batchId, received);
  await emit<AggregatorEvent>({ type: "done", batchId, status: "aggregated", summary });
  return { batchId, status: "aggregated" as const, summary };
}

// ---------------------------------------------------------------------------
// Step: emit a single event to the UI stream
// ---------------------------------------------------------------------------
async function emit<T>(event: T): Promise<void> {
  "use step";
  const writer = getWritable<T>().getWriter();
  try {
    await writer.write(event);
  } finally {
    writer.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Step: process collected signals into an aggregated result
// ---------------------------------------------------------------------------
async function processBatch(
  batchId: string,
  received: Map<string, SignalPayload>
): Promise<AggregatorSummary> {
  "use step";

  const writer = getWritable<AggregatorEvent>().getWriter();
  try {
    await writer.write({ type: "processing", batchId });
  } finally {
    writer.releaseLock();
  }

  // Simulate processing delay
  await new Promise((resolve) => setTimeout(resolve, 600));

  const sources = [...received.keys()];
  const totalValue = [...received.values()].reduce((sum, p) => sum + p.value, 0);

  return {
    totalSignals: 3,
    receivedSignals: received.size,
    totalValue,
    sources,
  };
}
