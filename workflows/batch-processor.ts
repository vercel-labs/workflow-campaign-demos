// getWritable is used here to stream demo UI events.
// A production workflow wouldn't need it unless it has its own streaming UI.
import { getWritable } from "workflow";

export type BatchEvent =
  | { type: "batch_start"; batch: number; start: number; end: number; label: string }
  | { type: "batch_done"; batch: number; start: number; end: number; label: string }
  | { type: "crash"; afterBatch: number; message: string }
  | { type: "resume"; fromBatch: number }
  | { type: "complete"; totalBatches: number; processedRecords: number }
  | { type: "done"; status: "done"; totalBatches: number; processedRecords: number };

// Demo: >= 500ms per step (timing rules)
const BATCH_STEP_MS = 650;

const numberFmt = new Intl.NumberFormat("en-US");

function formatNumber(n: number): string {
  return numberFmt.format(n);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function batchProcessor(
  total: number = 10_000,
  batchSize: number = 1_000,
  crashAfterBatches: number | null = null
) {
  "use workflow";

  const totalBatches = Math.ceil(total / batchSize);

  for (let batch = 1; batch <= totalBatches; batch++) {
    const start = (batch - 1) * batchSize + 1;
    const end = Math.min(total, batch * batchSize);

    // Crash simulation: after the specified batch, emit crash + pause + resume
    if (crashAfterBatches !== null && batch === crashAfterBatches + 1) {
      await emitCrashAndResume(crashAfterBatches, batch, batchSize);
    }

    await processBatch(batch, start, end);
  }

  await emitComplete(totalBatches, total);
  await emitDone(totalBatches, total);

  return { total, batchSize, status: "done" as const };
}

async function processBatch(
  batch: number,
  start: number,
  end: number
) {
  "use step";

  const writer = getWritable<BatchEvent>().getWriter();
  const label = `${formatNumber(start)}\u2013${formatNumber(end)}`;

  try {
    await writer.write({ type: "batch_start", batch, start, end, label });

    // Demo: simulate processing time for visualization
    await delay(BATCH_STEP_MS);

    await writer.write({ type: "batch_done", batch, start, end, label });
  } finally {
    writer.releaseLock();
  }
}

async function emitCrashAndResume(
  crashAfterBatch: number,
  resumeFromBatch: number,
  batchSize: number
) {
  "use step";

  const writer = getWritable<BatchEvent>().getWriter();

  try {
    const nextRecord = crashAfterBatch * batchSize + 1;
    await writer.write({
      type: "crash",
      afterBatch: crashAfterBatch,
      message: `Simulated crash after batch ${crashAfterBatch}. Resume continues at record ${formatNumber(nextRecord)}.`,
    });

    // Demo: brief pause to simulate downtime
    await delay(800);

    await writer.write({
      type: "resume",
      fromBatch: resumeFromBatch,
    });
  } finally {
    writer.releaseLock();
  }
}

async function emitDone(totalBatches: number, processedRecords: number) {
  "use step";

  const writer = getWritable<BatchEvent>().getWriter();
  try {
    await writer.write({ type: "done", status: "done", totalBatches, processedRecords });
  } finally {
    writer.releaseLock();
  }
}

async function emitComplete(totalBatches: number, processedRecords: number) {
  "use step";

  const writer = getWritable<BatchEvent>().getWriter();

  try {
    await writer.write({ type: "complete", totalBatches, processedRecords });
  } finally {
    writer.releaseLock();
  }
}
