import { highlightCodeToHtmlLines } from "./components/code-highlight-server";
import { ClaimCheckDemo } from "./components/demo";

const directiveUseWorkflow = `"use ${"workflow"}"`;
const directiveUseStep = `"use ${"step"}"`;

type ClaimWorkflowLineMap = {
  awaitToken: number[];
  process: number[];
  returnDone: number[];
};

type ClaimStepLineMap = {
  fetchBlob: number[];
};

const workflowCode = `import { defineHook } from "workflow";

const blobReady = defineHook<{ blobToken: string }>();

export async function importCsv(importId: string) {
  ${directiveUseWorkflow};

  // Claim-check: only a token enters the workflow (not a 50MB payload).
  const { blobToken } = await blobReady.create({ token: \`upload:\${importId}\` });

  await processBlob(blobToken);

  return { importId, blobToken, status: "indexed" as const };
}`;

const stepCode = `async function processBlob(blobToken: string) {
  ${directiveUseStep};

  const blob = await fetch(\`https://storage.example.com/blobs/\${blobToken}\`);
  if (!blob.ok) throw new Error("Blob missing");

  // parse + index ...
}`;

function findLines(code: string, includes: string): number[] {
  return code
    .split("\n")
    .map((line, idx) => (line.includes(includes) ? idx + 1 : null))
    .filter((v): v is number => v !== null);
}

function buildWorkflowLineMap(code: string): ClaimWorkflowLineMap {
  return {
    awaitToken: findLines(code, "await blobReady.create"),
    process: findLines(code, "await processBlob("),
    returnDone: findLines(code, 'status: "indexed"'),
  };
}

function buildStepLineMap(code: string): ClaimStepLineMap {
  return { fetchBlob: findLines(code, "await fetch(") };
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
          <div className="mb-4 inline-flex items-center rounded-full border border-green-700/40 bg-green-700/20 px-3 py-1 text-sm font-medium text-green-700">
            Workflow DevKit Example
          </div>
          <h1 className="mb-4 text-4xl font-semibold tracking-tight text-gray-1000">
            Claim Check
          </h1>
          <p className="max-w-3xl text-lg text-gray-900">
            Keep workflows small. Store large payloads elsewhere and pass a lightweight token (claim-check)
            into the workflow. This demo simulates a 50MB upload and delivers only a token into the workflow.
          </p>
        </header>

        <section aria-labelledby="try-it-heading" className="mb-12">
          <h2 id="try-it-heading" className="mb-4 text-2xl font-semibold tracking-tight">
            Try It
          </h2>
          <div className="rounded-lg border border-gray-400 bg-background-200 p-6">
            <ClaimCheckDemo
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
