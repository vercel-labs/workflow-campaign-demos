import { beforeEach, describe, expect, mock, test } from "bun:test";

// ---------------------------------------------------------------------------
// Mock infrastructure — matches fan-out / message-filter pattern
// ---------------------------------------------------------------------------
const writtenEvents: Array<Record<string, unknown>> = [];
const releaseLockMock = mock(() => {});
const writeMock = mock(async (event: unknown) => {
  writtenEvents.push(event as Record<string, unknown>);
});
const getWriterMock = mock(() => ({
  write: writeMock,
  releaseLock: releaseLockMock,
}));
const getWritableMock = mock(() => ({
  getWriter: getWriterMock,
}));

// ---------------------------------------------------------------------------
// Hook mock — each .create() returns a promise resolvable via resume(token, payload)
// ---------------------------------------------------------------------------
type HookResolver = { token: string; resolve: (payload: { source: string; value: number }) => void };
const hookResolvers: HookResolver[] = [];

const defineHookMock = mock(() => ({
  create: mock(({ token }: { token: string }) => {
    let resolve!: (payload: { source: string; value: number }) => void;
    const promise = new Promise<{ source: string; value: number }>((r) => {
      resolve = r;
    });
    // .then() must return a thenable that also exposes .then for Promise.all/race
    hookResolvers.push({ token, resolve });
    return { then: promise.then.bind(promise) };
  }),
}));

function resumeHook(token: string, payload: { source: string; value: number }) {
  const entry = hookResolvers.find((h) => h.token === token);
  if (!entry) throw new Error(`No hook registered for token "${token}"`);
  entry.resolve(payload);
}

// ---------------------------------------------------------------------------
// Sleep mock — returns a controllable promise
// ---------------------------------------------------------------------------
type SleepResolver = { resolve: () => void };
let sleepResolvers: SleepResolver[] = [];

const sleepMock = mock((_duration: string) => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  sleepResolvers.push({ resolve });
  return promise;
});

mock.module("workflow", () => ({
  getWritable: getWritableMock,
  defineHook: defineHookMock,
  sleep: sleepMock,
}));

async function loadWorkflow() {
  return import("./aggregator");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("aggregator workflow", () => {
  beforeEach(() => {
    writtenEvents.length = 0;
    hookResolvers.length = 0;
    sleepResolvers = [];
    releaseLockMock.mockClear();
    writeMock.mockClear();
    getWriterMock.mockClear();
    getWritableMock.mockClear();
  });

  test("test_aggregator_full_success_all_3_signals_received_before_timeout", async () => {
    const { aggregator } = await loadWorkflow();
    const resultPromise = aggregator("batch-001", 300);

    // Allow microtasks so hooks and sleep are registered
    await new Promise((r) => setTimeout(r, 0));

    // Resume all 3 hooks before the timeout fires
    resumeHook("warehouse-a:batch-001", { source: "warehouse-a", value: 100 });
    resumeHook("warehouse-b:batch-001", { source: "warehouse-b", value: 200 });
    resumeHook("warehouse-c:batch-001", { source: "warehouse-c", value: 300 });

    const result = await resultPromise;

    expect(result.status).toBe("aggregated");
    expect(result.summary.receivedSignals).toBe(3);
    expect(result.summary.totalSignals).toBe(3);
    expect(result.summary.totalValue).toBe(600);
    expect(result.summary.sources).toEqual(["warehouse-a", "warehouse-b", "warehouse-c"]);

    // Event sequence: collecting → 3x signal_received → all_collected → processing → done
    const types = writtenEvents.map((e) => e.type);
    expect(types[0]).toBe("collecting");
    expect(types.filter((t) => t === "signal_received")).toHaveLength(3);
    expect(types).toContain("all_collected");
    expect(types).toContain("processing");
    expect(types[types.length - 1]).toBe("done");

    // No timeout event emitted
    expect(types).not.toContain("timeout");
  });

  test("test_aggregator_partial_success_2_of_3_signals_timeout_fires", async () => {
    const { aggregator } = await loadWorkflow();
    const resultPromise = aggregator("batch-002", 200);

    await new Promise((r) => setTimeout(r, 0));

    // Only resume 2 of 3 hooks
    resumeHook("warehouse-a:batch-002", { source: "warehouse-a", value: 50 });
    resumeHook("warehouse-b:batch-002", { source: "warehouse-b", value: 75 });

    // Let the 2 hook promises settle
    await new Promise((r) => setTimeout(r, 0));

    // Fire the timeout
    expect(sleepResolvers).toHaveLength(1);
    sleepResolvers[0].resolve();

    const result = await resultPromise;

    expect(result.status).toBe("partial");
    expect(result.summary.receivedSignals).toBe(2);
    expect(result.summary.totalValue).toBe(125);
    expect(result.summary.sources).toEqual(["warehouse-a", "warehouse-b"]);

    const types = writtenEvents.map((e) => e.type);
    expect(types).toContain("timeout");
    expect(types).toContain("processing");
    expect(types[types.length - 1]).toBe("done");

    // Timeout event lists missing source
    const timeoutEvent = writtenEvents.find((e) => e.type === "timeout");
    expect(timeoutEvent!.missing).toEqual(["warehouse-c"]);
    expect(timeoutEvent!.received).toEqual(["warehouse-a", "warehouse-b"]);
  });

  test("test_aggregator_late_signal_after_timeout_does_not_mutate_summary", async () => {
    const { aggregator } = await loadWorkflow();
    const resultPromise = aggregator("batch-003", 100);

    await new Promise((r) => setTimeout(r, 0));

    // Resume 1 of 3 before timeout
    resumeHook("warehouse-a:batch-003", { source: "warehouse-a", value: 42 });
    await new Promise((r) => setTimeout(r, 0));

    // Fire timeout
    sleepResolvers[0].resolve();

    const result = await resultPromise;

    // Snapshot the summary before late signal
    const summarySnapshot = { ...result.summary };
    expect(summarySnapshot.receivedSignals).toBe(1);
    expect(summarySnapshot.totalValue).toBe(42);

    // Now resume the "late" hooks — they should not change the returned result
    resumeHook("warehouse-b:batch-003", { source: "warehouse-b", value: 999 });
    resumeHook("warehouse-c:batch-003", { source: "warehouse-c", value: 888 });
    await new Promise((r) => setTimeout(r, 0));

    // The result object is already frozen — verify it hasn't changed
    expect(result.summary.receivedSignals).toBe(summarySnapshot.receivedSignals);
    expect(result.summary.totalValue).toBe(summarySnapshot.totalValue);
    expect(result.summary.sources).toEqual(["warehouse-a"]);

    // No additional events emitted after "done"
    const doneIndex = writtenEvents.findIndex((e) => e.type === "done");
    expect(doneIndex).toBe(writtenEvents.length - 1);
  });

  test("test_aggregator_signal_received_count_increments_monotonically", async () => {
    const { aggregator } = await loadWorkflow();
    const resultPromise = aggregator("batch-004", 400);

    await new Promise((r) => setTimeout(r, 0));

    // Resume all 3 in sequence
    resumeHook("warehouse-a:batch-004", { source: "warehouse-a", value: 10 });
    resumeHook("warehouse-b:batch-004", { source: "warehouse-b", value: 20 });
    resumeHook("warehouse-c:batch-004", { source: "warehouse-c", value: 30 });

    await resultPromise;

    const signalEvents = writtenEvents.filter((e) => e.type === "signal_received");
    expect(signalEvents).toHaveLength(3);

    // receivedCount must be monotonically increasing
    const counts = signalEvents.map((e) => e.receivedCount as number);
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
    }

    // Each count must reflect actual received signals (not repeating final count)
    expect(counts[counts.length - 1]).toBe(3);
    // First signal should show at least 1
    expect(counts[0]).toBeGreaterThanOrEqual(1);
  });

  test("test_aggregator_zero_signals_before_timeout_produces_empty_summary", async () => {
    const { aggregator } = await loadWorkflow();
    const resultPromise = aggregator("batch-005", 100);

    await new Promise((r) => setTimeout(r, 0));

    // Fire timeout immediately with no signals
    sleepResolvers[0].resolve();

    const result = await resultPromise;

    expect(result.status).toBe("partial");
    expect(result.summary.receivedSignals).toBe(0);
    expect(result.summary.totalValue).toBe(0);
    expect(result.summary.sources).toEqual([]);

    const timeoutEvent = writtenEvents.find((e) => e.type === "timeout");
    expect(timeoutEvent!.missing).toEqual(["warehouse-a", "warehouse-b", "warehouse-c"]);
    expect(timeoutEvent!.received).toEqual([]);
  });
});
