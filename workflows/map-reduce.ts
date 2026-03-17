// getWritable + getStepMetadata are used here to stream demo UI events.
// A production workflow wouldn't need these unless it has its own streaming UI.
import { getWritable } from "workflow";

export type MapReduceEvent =
  | { type: "partitioning"; totalItems: number; chunkCount: number }
  | { type: "partition_created"; partitionIndex: number; itemCount: number }
  | { type: "mapping"; partitionIndex: number }
  | { type: "mapped"; partitionIndex: number; partialSum: number; partialCount: number }
  | { type: "reducing" }
  | { type: "done"; summary: { totalSum: number; totalCount: number; average: number } };

type PartitionResult = {
  partitionIndex: number;
  sum: number;
  count: number;
};

type MapReduceReport = {
  jobId: string;
  status: "done";
  partitions: PartitionResult[];
  summary: {
    totalSum: number;
    totalCount: number;
    average: number;
  };
};

// Demo: simulate processing latency so the UI can show progress.
// In production, these delays would be replaced by actual computation.
const PARTITION_DELAY_MS = 400;
const MAP_DELAY_MS = 600;
const REDUCE_DELAY_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const DEFAULT_CHUNK_SIZE = 3;

export function partitionInput(items: number[], chunkSize: number = DEFAULT_CHUNK_SIZE): number[][] {
  const chunks: number[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

// Demo entry point. Partitions input, maps partitions in parallel with
// Promise.all(), and reduces into a single aggregate result.
export async function mapReduce(
  jobId: string,
  items: number[] = [10, 20, 30, 40, 50, 60, 70, 80, 90],
  chunkSize: number = DEFAULT_CHUNK_SIZE
): Promise<MapReduceReport> {
  "use workflow";

  const writer = getWritable<MapReduceEvent>().getWriter();

  try {
    const partitions = partitionInput(items, chunkSize);

    await writer.write({
      type: "partitioning",
      totalItems: items.length,
      chunkCount: partitions.length,
    });

    await delay(PARTITION_DELAY_MS);

    for (let i = 0; i < partitions.length; i++) {
      await writer.write({
        type: "partition_created",
        partitionIndex: i,
        itemCount: partitions[i].length,
      });
    }

    // Map: process all partitions in parallel with Promise.all()
    const partitionResults = await Promise.all(
      partitions.map((chunk, index) => mapPartition(index, chunk))
    );

    // Reduce: combine all partition results into a final aggregate
    return reduceResults(jobId, partitionResults);
  } finally {
    writer.releaseLock();
  }
}

async function mapPartition(
  partitionIndex: number,
  chunk: number[]
): Promise<PartitionResult> {
  "use step";

  const writer = getWritable<MapReduceEvent>().getWriter();

  try {
    await writer.write({ type: "mapping", partitionIndex });
    await delay(MAP_DELAY_MS);

    const sum = chunk.reduce((acc, val) => acc + val, 0);
    const count = chunk.length;

    await writer.write({
      type: "mapped",
      partitionIndex,
      partialSum: sum,
      partialCount: count,
    });

    return { partitionIndex, sum, count };
  } finally {
    writer.releaseLock();
  }
}

async function reduceResults(
  jobId: string,
  partitionResults: PartitionResult[]
): Promise<MapReduceReport> {
  "use step";

  const writer = getWritable<MapReduceEvent>().getWriter();

  try {
    await writer.write({ type: "reducing" });
    await delay(REDUCE_DELAY_MS);

    const totalSum = partitionResults.reduce((acc, r) => acc + r.sum, 0);
    const totalCount = partitionResults.reduce((acc, r) => acc + r.count, 0);
    const average = totalCount > 0 ? totalSum / totalCount : 0;

    const report: MapReduceReport = {
      jobId,
      status: "done",
      partitions: partitionResults,
      summary: { totalSum, totalCount, average },
    };

    await writer.write({ type: "done", summary: report.summary });

    return report;
  } finally {
    writer.releaseLock();
  }
}
