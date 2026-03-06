import { getWritable } from "workflow";

export type PipelineEvent =
  | { type: "step_start"; step: string; index: number; total: number }
  | { type: "step_progress"; step: string; percent: number; message: string }
  | {
      type: "step_done";
      step: string;
      index: number;
      total: number;
      durationMs: number;
    }
  | { type: "pipeline_done"; totalMs: number };

export async function pipeline(
  documentId: string
): Promise<{ status: "completed"; steps: number }> {
  "use workflow";

  void documentId;
  const steps = ["Extract", "Transform", "Validate", "Load"];
  const startMs = Date.now();

  for (let i = 0; i < steps.length; i++) {
    await runPipelineStep(steps[i], i, steps.length);
  }

  await emitPipelineDone(startMs);

  return { status: "completed", steps: steps.length };
}

async function emitPipelineDone(startMs: number): Promise<void> {
  "use step";

  const writer = getWritable<PipelineEvent>().getWriter();
  try {
    await writer.write({ type: "pipeline_done", totalMs: Date.now() - startMs });
  } finally {
    writer.releaseLock();
  }
}

async function runPipelineStep(
  name: string,
  index: number,
  total: number
): Promise<void> {
  "use step";

  const writer = getWritable<PipelineEvent>().getWriter();
  const startMs = Date.now();

  try {
    await writer.write({ type: "step_start", step: name, index, total });

    // Simulate work with progress updates
    for (let pct = 0; pct <= 100; pct += 20) {
      await new Promise((r) => setTimeout(r, 150));
      await writer.write({
        type: "step_progress",
        step: name,
        percent: pct,
        message: getProgressMessage(name, pct),
      });
    }

    await writer.write({
      type: "step_done",
      step: name,
      index,
      total,
      durationMs: Date.now() - startMs,
    });
  } finally {
    writer.releaseLock();
  }
}

function getProgressMessage(step: string, pct: number): string {
  const messages: Record<string, string[]> = {
    Extract: [
      "Connecting to source...",
      "Reading metadata...",
      "Parsing fields...",
      "Extracting content...",
      "Buffering records...",
      "Extract complete",
    ],
    Transform: [
      "Initializing rules...",
      "Mapping schemas...",
      "Converting types...",
      "Normalizing values...",
      "Applying transforms...",
      "Transform complete",
    ],
    Validate: [
      "Loading constraints...",
      "Checking required fields...",
      "Validating types...",
      "Running business rules...",
      "Final validation...",
      "Validation complete",
    ],
    Load: [
      "Connecting to target...",
      "Preparing batch...",
      "Writing records...",
      "Updating indexes...",
      "Flushing buffers...",
      "Load complete",
    ],
  };
  return messages[step]?.[pct / 20] ?? "Processing...";
}
