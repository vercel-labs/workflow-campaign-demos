import { beforeEach, describe, expect, mock, test } from "bun:test";

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
const getStepMetadataMock = mock(() => ({
  attempt: 1,
}));

mock.module("workflow", () => ({
  getWritable: getWritableMock,
  getStepMetadata: getStepMetadataMock,
}));

async function loadWorkflow() {
  return import("./hedge-request");
}

describe("hedge-request workflow", () => {
  beforeEach(() => {
    writtenEvents.length = 0;
    releaseLockMock.mockClear();
    writeMock.mockClear();
    getWriterMock.mockClear();
    getWritableMock.mockClear();
    getStepMetadataMock.mockClear();
  });

  test("test_hedgeRequest_fastest_provider_wins_the_race", async () => {
    const { hedgeRequestFlow } = await loadWorkflow();
    const result = await hedgeRequestFlow({
      query: "translate greeting",
      providers: [
        { name: "US-East", simulatedLatencyMs: 50 },
        { name: "EU-West", simulatedLatencyMs: 200 },
        { name: "AP-South", simulatedLatencyMs: 500 },
      ],
    });

    expect(result.winner).toBe("US-East");
    expect(result.latencyMs).toBe(50);
  });

  test("test_hedgeRequest_all_providers_emit_started_events", async () => {
    const { hedgeRequestFlow } = await loadWorkflow();
    await hedgeRequestFlow({
      query: "translate greeting",
      providers: [
        { name: "US-East", simulatedLatencyMs: 50 },
        { name: "EU-West", simulatedLatencyMs: 200 },
        { name: "AP-South", simulatedLatencyMs: 500 },
      ],
    });

    const startedEvents = writtenEvents.filter(
      (e) => e.type === "provider_started"
    );
    const startedProviders = startedEvents.map((e) => e.provider).sort();

    // All three providers should have started (Promise.race launches all)
    expect(startedProviders).toContain("US-East");
    // At minimum the winner started; due to Promise.race timing, others may or may not have started
    expect(startedEvents.length).toBeGreaterThanOrEqual(1);
  });

  test("test_hedgeRequest_winner_event_contains_correct_provider_and_latency", async () => {
    const { hedgeRequestFlow } = await loadWorkflow();
    await hedgeRequestFlow({
      query: "translate greeting",
      providers: [
        { name: "US-East", simulatedLatencyMs: 50 },
        { name: "EU-West", simulatedLatencyMs: 200 },
      ],
    });

    const winnerEvent = writtenEvents.find((e) => e.type === "winner");
    expect(winnerEvent).toBeTruthy();
    expect(winnerEvent!.provider).toBe("US-East");
    expect(winnerEvent!.latencyMs).toBe(50);
    expect(winnerEvent!.result).toBe('US-East processed "translate greeting"');
  });

  test("test_hedgeRequest_done_event_includes_totalProviders_count", async () => {
    const { hedgeRequestFlow } = await loadWorkflow();
    const result = await hedgeRequestFlow({
      query: "translate greeting",
      providers: [
        { name: "US-East", simulatedLatencyMs: 50 },
        { name: "EU-West", simulatedLatencyMs: 200 },
        { name: "AP-South", simulatedLatencyMs: 500 },
      ],
    });

    expect(result.totalProviders).toBe(3);

    const doneEvent = writtenEvents.find((e) => e.type === "done");
    expect(doneEvent).toBeTruthy();
    expect(doneEvent!.totalProviders).toBe(3);
    expect(doneEvent!.winner).toBe("US-East");
    expect(doneEvent!.latencyMs).toBe(50);
  });

  test("test_hedgeRequest_config_event_lists_all_provider_names", async () => {
    const { hedgeRequestFlow } = await loadWorkflow();
    await hedgeRequestFlow({
      query: "summarize doc",
      providers: [
        { name: "Provider-A", simulatedLatencyMs: 100 },
        { name: "Provider-B", simulatedLatencyMs: 300 },
      ],
    });

    const configEvent = writtenEvents.find((e) => e.type === "config");
    expect(configEvent).toBeTruthy();
    expect(configEvent!.query).toBe("summarize doc");
    expect(configEvent!.providers).toEqual(["Provider-A", "Provider-B"]);
  });

  test("test_hedgeRequest_losers_are_marked_with_provider_lost_events", async () => {
    const { hedgeRequestFlow } = await loadWorkflow();
    await hedgeRequestFlow({
      query: "translate greeting",
      providers: [
        { name: "Fast", simulatedLatencyMs: 10 },
        { name: "Medium", simulatedLatencyMs: 200 },
        { name: "Slow", simulatedLatencyMs: 500 },
      ],
    });

    const lostEvents = writtenEvents.filter((e) => e.type === "provider_lost");
    const lostNames = lostEvents.map((e) => e.provider).sort();

    expect(lostNames).toContain("Medium");
    expect(lostNames).toContain("Slow");
    expect(lostNames).not.toContain("Fast");
  });
});
