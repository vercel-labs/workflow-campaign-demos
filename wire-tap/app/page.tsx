import { readFileSync } from "node:fs";
import { join } from "node:path";
import { highlightCodeToHtmlLines } from "./components/code-highlight-server";
import { WireTapDemo } from "./components/demo";

// Read the actual workflow source file — displayed in the code workbench
const workflowSource = readFileSync(
  join(process.cwd(), "workflows/wire-tap.ts"),
  "utf-8"
);

function extractFunctionBlock(source: string, marker: string): string {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line.includes(marker));
  if (start === -1) return "";
  const output: string[] = [];
  let depth = 0;
  let sawBrace = false;
  for (let i = start; i < lines.length; i++) {
    output.push(lines[i]);
    const opens = (lines[i].match(/{/g) ?? []).length;
    const closes = (lines[i].match(/}/g) ?? []).length;
    depth += opens - closes;
    if (opens > 0) sawBrace = true;
    if (sawBrace && depth === 0) break;
  }
  return output.join("\n");
}

const workflowCode = extractFunctionBlock(workflowSource, "export async function wireTap(");

const stepCode = [
  extractFunctionBlock(workflowSource, "async function validateOrder("),
  "",
  extractFunctionBlock(workflowSource, "async function enrichOrder("),
  "",
  extractFunctionBlock(workflowSource, "async function transformOrder("),
  "",
  extractFunctionBlock(workflowSource, "async function deliverOrder("),
  "",
  extractFunctionBlock(workflowSource, "async function emitDone("),
].join("\n");

function findLine(code: string, match: string): number {
  const lines = code.split("\n");
  const index = lines.findIndex((line) => line.includes(match));
  return index === -1 ? -1 : index + 1;
}

const lineMap = {
  workflowPipelineLine: findLine(workflowCode, "message = await"),
  workflowDoneLine: findLine(workflowCode, "await emitDone("),
  stepStageStartLine: findLine(stepCode, 'type: "stage_start"'),
  stepTapLine: findLine(stepCode, 'type: "tap_captured"'),
  stepStageDoneLine: findLine(stepCode, 'type: "stage_done"'),
};

const workflowLinesHtml = highlightCodeToHtmlLines(workflowCode);
const stepLinesHtml = highlightCodeToHtmlLines(stepCode);

export default function Home() {
  return (
    <div className="min-h-screen bg-background-100 p-8 text-gray-1000">
      <main id="main-content" className="mx-auto max-w-5xl" role="main">
        <header className="mb-10">
          <div className="mb-4 inline-flex items-center rounded-full border border-blue-700/40 bg-blue-700/20 px-3 py-1 text-sm font-medium text-blue-700">
            Workflow DevKit Example
          </div>
          <h1 className="mb-4 text-5xl font-semibold tracking-tight text-gray-1000">
            Wire Tap
          </h1>
          <p className="max-w-3xl text-lg text-gray-900">
            Intercept messages at each stage of a processing pipeline, copying them
            to a separate audit channel without disrupting the main flow. Each{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 text-sm font-mono">
              &quot;use step&quot;
            </code>{" "}
            function processes the message and taps a snapshot to the audit trail via{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 text-sm font-mono">
              getWritable()
            </code>
            .
          </p>
        </header>

        <section aria-labelledby="try-it-heading" className="mb-12">
          <h2
            id="try-it-heading"
            className="mb-3 text-2xl font-semibold tracking-tight text-gray-1000"
          >
            Try It
          </h2>
          <p className="mb-4 text-sm text-gray-900">
            Start a mock order through the processing pipeline. Watch each stage
            process the message while the wire tap captures a snapshot to the
            audit channel — the main flow is never altered.
          </p>

          <WireTapDemo
            workflowCode={workflowCode}
            workflowLinesHtml={workflowLinesHtml}
            stepCode={stepCode}
            stepLinesHtml={stepLinesHtml}
            lineMap={lineMap}
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
