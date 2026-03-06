import { highlightCodeToHtmlLines } from "@/components/code-highlight-server";
import { PipelineDemo } from "./components/demo";

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

const workflowLinesHtml = highlightCodeToHtmlLines(workflowCode);
const stepLinesHtml = highlightCodeToHtmlLines(stepCode);

function findLine(code: string, match: string): number {
  const lines = code.split("\n");
  const index = lines.findIndex((line) => line.includes(match));
  return index === -1 ? -1 : index + 1;
}

const lineMap = {
  workflowLoopLine: findLine(workflowCode, "await runPipelineStep("),
  workflowStepLines: stepNames.map((name) => findLine(workflowCode, `\"${name}\"`)),
  workflowDoneLine: findLine(workflowCode, "emitPipelineDone("),
  stepStartLine: findLine(stepCode, 'type: "step_start"'),
  stepProgressLine: findLine(stepCode, 'type: "step_progress"'),
  stepDoneLine: findLine(stepCode, 'type: "step_done"'),
  stepPipelineDoneLine: findLine(stepCode, 'type: "pipeline_done"'),
};

export default function Home() {
  return (
    <div className="min-h-screen bg-background-100 p-8 text-gray-1000">
      <main id="main-content" className="mx-auto max-w-5xl" role="main">
        <header className="mb-10">
          <div className="mb-4 inline-flex items-center rounded-full border border-blue-700/40 bg-blue-700/20 px-3 py-1 text-sm font-medium text-blue-700">
            Workflow DevKit Example
          </div>
          <h1 className="mb-4 text-5xl font-semibold tracking-tight text-gray-1000">
            Pipeline
          </h1>
          <p className="max-w-3xl text-lg text-gray-900">
            This ETL demo streams step-level progress from inside durable steps with{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 text-sm font-mono">
              getWritable()
            </code>{" "}
            and consumes it client-side through{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 text-sm font-mono">
              run.getReadable()
            </code>
            . Watch Extract → Transform → Validate → Load update in real time while the code pane highlights the executing lines.
          </p>
        </header>

        <section aria-labelledby="try-it-heading" className="mb-12">
          <h2
            id="try-it-heading"
            className="mb-3 text-2xl font-semibold tracking-tight text-gray-1000"
          >
            Try It
          </h2>
          <p className="mb-2 text-sm text-gray-900">
            Start a mock pipeline run, follow each step as it progresses, and inspect how stream events map directly to workflow + step code.
          </p>
          <p className="mb-4 text-xs text-gray-900">
            The interactive panel uses a timestamp-based in-memory mock store. The real API routes in this app use{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-xs">
              start(pipeline)
            </code>{" "}
            and{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-xs">
              getRun(runId).getReadable()
            </code>
            .
          </p>

          <PipelineDemo
            workflowCode={workflowCode}
            workflowLinesHtml={workflowLinesHtml}
            stepCode={stepCode}
            stepLinesHtml={stepLinesHtml}
            lineMap={lineMap}
            workflowDirective={workflowDirective}
            stepDirective={stepDirective}
          />
        </section>

        <footer className="border-t border-gray-400 py-6 text-center text-sm text-gray-900">
          <a
            href="https://useworkflow.dev/"
            className="underline underline-offset-2 transition-colors hover:text-gray-1000"
            target="_blank"
            rel="noopener noreferrer"
          >
            Workflow DevKit Docs
          </a>
        </footer>
      </main>
    </div>
  );
}
