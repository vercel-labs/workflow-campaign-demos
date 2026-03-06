import { sleep, getWritable } from "workflow";

export type JobState =
  | "queued"
  | "processing"
  | "encoding"
  | "finalizing"
  | "ready";

export type PollEvent =
  | { type: "poll_start"; poll: number; jobId: string }
  | {
      type: "poll_result";
      poll: number;
      jobState: JobState;
      outcome: "not_ready" | "ready";
    }
  | { type: "sleep_start"; poll: number; durationMs: number }
  | { type: "sleep_end"; poll: number }
  | { type: "completed"; poll: number; jobId: string }
  | { type: "timeout"; poll: number; jobId: string }
  | { type: "done"; jobId: string; status: "completed" | "timeout"; pollCount: number };

export interface PollResult {
  jobId: string;
  status: "completed" | "timeout";
  pollCount: number;
  finalState?: string;
}

const STEP_DELAY_MS = 500;
const JOB_STATE_SEQUENCE: JobState[] = [
  "queued",
  "processing",
  "encoding",
  "finalizing",
  "ready",
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeWrite(
  writer: WritableStreamDefaultWriter<PollEvent>,
  event: PollEvent
): Promise<void> {
  try {
    await writer.write(event);
  } catch {
    // Best-effort streaming
  }
}

export async function pollTranscodeStatus(
  jobId: string,
  maxPolls: number = 8,
  intervalMs: number = 1000,
  readyAtPoll: number = 4
): Promise<PollResult> {
  "use workflow";

  for (let poll = 1; poll <= maxPolls; poll++) {
    const state = await checkTranscodeJob(jobId, poll, readyAtPoll);

    if (state === "ready") {
      await emitDone(jobId, "completed", poll);
      return { jobId, status: "completed", pollCount: poll, finalState: state };
    }

    if (poll < maxPolls) {
      await emitSleepStart(poll, intervalMs);
      await sleep(`${intervalMs}ms`);
      await emitSleepEnd(poll);
    }
  }

  await emitTimeout(maxPolls, jobId);
  await emitDone(jobId, "timeout", maxPolls);

  return { jobId, status: "timeout", pollCount: maxPolls };
}

async function checkTranscodeJob(
  jobId: string,
  poll: number,
  readyAtPoll: number
): Promise<JobState> {
  "use step";

  const writer = getWritable<PollEvent>().getWriter();

  try {
    await safeWrite(writer, { type: "poll_start", poll, jobId });
    await delay(STEP_DELAY_MS);

    let jobState: JobState;
    if (poll >= readyAtPoll) {
      jobState = "ready";
    } else {
      const statesBeforeReady = JOB_STATE_SEQUENCE.slice(0, -1);
      const idx = Math.min(poll - 1, statesBeforeReady.length - 1);
      jobState = statesBeforeReady[idx];
    }

    const outcome = jobState === "ready" ? "ready" : "not_ready";
    await safeWrite(writer, { type: "poll_result", poll, jobState, outcome });

    if (outcome === "ready") {
      await safeWrite(writer, { type: "completed", poll, jobId });
    }

    return jobState;
  } finally {
    writer.releaseLock();
  }
}

checkTranscodeJob.maxRetries = 0;

async function emitSleepStart(poll: number, durationMs: number): Promise<void> {
  "use step";
  const writer = getWritable<PollEvent>().getWriter();
  try {
    await safeWrite(writer, { type: "sleep_start", poll, durationMs });
  } finally {
    writer.releaseLock();
  }
}

emitSleepStart.maxRetries = 0;

async function emitSleepEnd(poll: number): Promise<void> {
  "use step";
  const writer = getWritable<PollEvent>().getWriter();
  try {
    await safeWrite(writer, { type: "sleep_end", poll });
  } finally {
    writer.releaseLock();
  }
}

emitSleepEnd.maxRetries = 0;

async function emitTimeout(poll: number, jobId: string): Promise<void> {
  "use step";
  const writer = getWritable<PollEvent>().getWriter();
  try {
    await safeWrite(writer, { type: "timeout", poll, jobId });
  } finally {
    writer.releaseLock();
  }
}

emitTimeout.maxRetries = 0;

async function emitDone(jobId: string, status: "completed" | "timeout", pollCount: number): Promise<void> {
  "use step";
  const writer = getWritable<PollEvent>().getWriter();
  try {
    await safeWrite(writer, { type: "done", jobId, status, pollCount });
  } finally {
    writer.releaseLock();
  }
}

emitDone.maxRetries = 0;
