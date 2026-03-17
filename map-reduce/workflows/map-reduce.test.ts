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

mock.module("workflow", () => ({
  getWritable: getWritableMock,
  getStepMetadata: mock(() => ({ attempt: 1 })),
}));

async function loadWorkflow() {
  return import("./map-reduce");
}

describe("map-reduce workflow", () => {
  beforeEach(() => {
    writtenEvents.length = 0;
    releaseLockMock.mockClear();
    writeMock.mockClear();
    getWriterMock.mockClear();
    getWritableMock.mockClear();
  });

  test("test_mapReduce_partitions_input_and_produces_correct_summary", async () => {
    const { mapReduce } = await loadWorkflow();
    const report = await mapReduce("job-1", [10, 20, 30, 40, 50, 60], 3);

    expect(report.status).toBe("done");
    expect(report.jobId).toBe("job-1");
    expect(report.partitions).toHaveLength(2);
    expect(report.summary).toEqual({
      totalSum: 210,
      totalCount: 6,
      average: 35,
    });
  });

  test("test_mapReduce_streams_partitioning_mapping_and_done_events", async () => {
    const { mapReduce } = await loadWorkflow();
    await mapReduce("job-2", [10, 20, 30, 40, 50, 60, 70, 80, 90], 3);

    expect(writtenEvents.some((e) => e.type === "partitioning")).toBe(true);
    expect(writtenEvents.some((e) => e.type === "partition_created")).toBe(true);
    expect(writtenEvents.some((e) => e.type === "mapping")).toBe(true);
    expect(writtenEvents.some((e) => e.type === "mapped")).toBe(true);
    expect(writtenEvents.some((e) => e.type === "reducing")).toBe(true);
    expect(writtenEvents.some((e) => e.type === "done")).toBe(true);

    const mappedEvents = writtenEvents.filter((e) => e.type === "mapped");
    expect(mappedEvents).toHaveLength(3);
  });

  test("test_mapReduce_handles_single_partition", async () => {
    const { mapReduce } = await loadWorkflow();
    const report = await mapReduce("job-3", [42], 10);

    expect(report.partitions).toHaveLength(1);
    expect(report.summary).toEqual({
      totalSum: 42,
      totalCount: 1,
      average: 42,
    });
  });

  test("test_partitionInput_splits_items_into_chunks", async () => {
    const { partitionInput } = await loadWorkflow();

    expect(partitionInput([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(partitionInput([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
    expect(partitionInput([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]]);
  });
});
