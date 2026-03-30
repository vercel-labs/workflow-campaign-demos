// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { highlightCodeToHtmlLines } from "@/lib/code-workbench.server";

const stepNames = ["Extract", "Transform", "Validate", "Load"] as const;

const workflowDirective = `use ${"workflow"}`;
const stepDirective = `use ${"step"}`;

const workflowCode = `export async function pipeline(documentId: string) {
  "${workflowDirective}";

  const startMs = Date.now();
  const steps = [
    "Extract",
    "Transform",
    "Validate",
    "Load",
  ];

  for (let i = 0; i < steps.length; i += 1) {
    await runPipelineStep(steps[i], i, steps.length);
  }

  await emitPipelineDone(startMs);

  return { status: "completed", steps: steps.length };
}`;

const stepCode = `async function runPipelineStep(name: string, index: number, total: number) {
  "${stepDirective}";

  const writer = getWritable<PipelineEvent>().getWriter();
  const startMs = Date.now();

  try {
    await writer.write({ type: "step_start", step: name, index, total });

    for (let pct = 0; pct <= 100; pct += 20) {
      await new Promise((resolve) => setTimeout(resolve, 150));
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

async function emitPipelineDone(startMs: number) {
  "${stepDirective}";

  const writer = getWritable<PipelineEvent>().getWriter();
  try {
    await writer.write({ type: "pipeline_done", totalMs: Date.now() - startMs });
  } finally {
    writer.releaseLock();
  }
}`;

type PipelineLineMap = {
  workflowLoopLine: number;
  workflowStepLines: number[];
  workflowDoneLine: number;
  stepStartLine: number;
  stepProgressLine: number;
  stepDoneLine: number;
  stepPipelineDoneLine: number;
};

export type PipelineCodeProps = {
  workflowCode: string;
  workflowLinesHtml: string[];
  stepCode: string;
  stepLinesHtml: string[];
  lineMap: PipelineLineMap;
  workflowDirective: string;
  stepDirective: string;
};

function findLine(code: string, match: string): number {
  const lines = code.split("\n");
  const index = lines.findIndex((line) => line.includes(match));
  return index === -1 ? -1 : index + 1;
}

export function getPipelineCodeProps(): PipelineCodeProps {
  const lineMap: PipelineLineMap = {
    workflowLoopLine: findLine(workflowCode, "await runPipelineStep("),
    workflowStepLines: stepNames.map((name) => findLine(workflowCode, `"${name}"`)),
    workflowDoneLine: findLine(workflowCode, "emitPipelineDone("),
    stepStartLine: findLine(stepCode, 'type: "step_start"'),
    stepProgressLine: findLine(stepCode, 'type: "step_progress"'),
    stepDoneLine: findLine(stepCode, 'type: "step_done"'),
    stepPipelineDoneLine: findLine(stepCode, 'type: "pipeline_done"'),
  };

  return {
    workflowCode,
    workflowLinesHtml: highlightCodeToHtmlLines(workflowCode),
    stepCode,
    stepLinesHtml: highlightCodeToHtmlLines(stepCode),
    lineMap,
    workflowDirective,
    stepDirective,
  };
}
