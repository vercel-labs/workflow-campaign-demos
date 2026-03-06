import { highlightCodeToHtmlLines } from "./components/code-highlight-server";
import { BatchProcessorDemo } from "./components/demo";

const directiveUseWorkflow = `"use ${"workflow"}"`;
const directiveUseStep = `"use ${"step"}"`;

type BatchWorkflowLineMap = {
  checkpoint: number[];
  checkpointComment: number[];
  returnDone: number[];
};

type BatchStepLineMap = {
  promiseAll: number[];
  processItem: number[];
};

// Pattern 1 — Sequential batches (left pane)
// Each `await` is a durable checkpoint. Crash after batch 5 → resume at 5,001.
const workflowCode = `// Pattern 1 — Sequential batches with durable checkpoints
export async function backfillSearchIndex(totalRecords = 10_000) {
  ${directiveUseWorkflow};

  const batchSize = 1_000;

  for (let start = 1; start <= totalRecords; start += batchSize) {
    const end = Math.min(totalRecords, start + batchSize - 1);

    // Each await is a checkpoint — crash after batch 5,
    // the workflow resumes at record 5,001.
    await processBatch(start, end);
  }

  return { status: "done", processed: totalRecords };
}

async function processBatch(start: number, end: number) {
  ${directiveUseStep};

  await fetch("https://index.example.com/reindex", {
    method: "POST",
    body: JSON.stringify({ start, end }),
  });
}`;

// Pattern 2 — Concurrent items within a step (right pane)
// Promise.all() inside a step processes items in parallel.
// The entire chunk succeeds or fails as one atomic unit.
const stepCode = `// Pattern 2 — Concurrent items within a single step
export async function enrichUserProfiles(users: string[]) {
  ${directiveUseWorkflow};

  const batchSize = 50;

  for (let i = 0; i < users.length; i += batchSize) {
    const chunk = users.slice(i, i + batchSize);

    // Each chunk is one durable step
    await processChunkConcurrently(chunk);
  }

  return { status: "done", processed: users.length };
}

async function processChunkConcurrently(chunk: string[]) {
  ${directiveUseStep};

  // All items in the chunk process in parallel
  await Promise.all(
    chunk.map(async (userId) => {
      await fetch(\`https://api.example.com/enrich/\${userId}\`);
    })
  );
}`;

function findLines(code: string, includes: string): number[] {
  return code
    .split("\n")
    .map((line, idx) => (line.includes(includes) ? idx + 1 : null))
    .filter((v): v is number => v !== null);
}

function buildWorkflowLineMap(code: string): BatchWorkflowLineMap {
  return {
    checkpoint: findLines(code, "await processBatch("),
    checkpointComment: findLines(code, "Each await is a checkpoint"),
    returnDone: findLines(code, 'return { status: "done"'),
  };
}

function buildStepLineMap(code: string): BatchStepLineMap {
  return {
    promiseAll: findLines(code, "await Promise.all("),
    processItem: findLines(code, "await fetch("),
  };
}

const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
const stepHtmlLines = highlightCodeToHtmlLines(stepCode);
const workflowLineMap = buildWorkflowLineMap(workflowCode);
const stepLineMap = buildStepLineMap(stepCode);

export default function Home() {
  return (
    <div className="min-h-screen bg-background-100 p-8 text-gray-1000">
      <main id="main-content" className="mx-auto max-w-5xl" role="main">
        <header className="mb-12">
          <div className="mb-4 inline-flex items-center rounded-full border border-amber-700/40 bg-amber-700/20 px-3 py-1 text-sm font-medium text-amber-700">
            Workflow DevKit Example
          </div>
          <h1 className="mb-4 text-4xl font-semibold tracking-tight text-gray-1000">
            Batch Processor
          </h1>
          <p className="max-w-3xl text-lg text-gray-900">
            Two patterns for durable batch processing. <strong className="text-gray-1000">Sequential batches</strong> use
            a plain{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">for</code>{" "}
            loop where each{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">await</code>{" "}
            is a durable checkpoint. <strong className="text-gray-1000">Concurrent batches</strong> use{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">Promise.all()</code>{" "}
            inside a step to process items in parallel within each chunk.
          </p>
        </header>

        <section aria-labelledby="try-it-heading" className="mb-12">
          <h2 id="try-it-heading" className="mb-4 text-2xl font-semibold tracking-tight">
            Try It
          </h2>
          <div className="rounded-lg border border-gray-400 bg-background-200 p-6">
            <BatchProcessorDemo
              workflowCode={workflowCode}
              workflowHtmlLines={workflowHtmlLines}
              workflowLineMap={workflowLineMap}
              stepCode={stepCode}
              stepHtmlLines={stepHtmlLines}
              stepLineMap={stepLineMap}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
