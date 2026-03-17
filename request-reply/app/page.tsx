import { readFileSync } from "node:fs";
import { join } from "node:path";
import { highlightCodeToHtmlLines } from "./components/code-highlight-server";
import {
  RequestReplyDemo,
  type WorkflowLineMap,
  type StepLineMap,
} from "./components/demo";

// Read the actual workflow source file — displayed in the code workbench
const workflowSource = readFileSync(
  join(process.cwd(), "workflows/request-reply.ts"),
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

const workflowCode = extractFunctionBlock(workflowSource, "export async function requestReplyFlow(");

const stepCode = [
  extractFunctionBlock(workflowSource, "async function sendRequest("),
  "",
  extractFunctionBlock(workflowSource, "async function emitEvent("),
].join("\n");

function collectFunctionBlock(lines: string[], marker: string): number[] {
  const start = lines.findIndex((line) => line.includes(marker));
  if (start === -1) return [];

  const output: number[] = [];
  let depth = 0;
  let sawOpeningBrace = false;

  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];
    output.push(index + 1);

    const opens = (line.match(/{/g) ?? []).length;
    const closes = (line.match(/}/g) ?? []).length;

    depth += opens - closes;
    if (opens > 0) sawOpeningBrace = true;
    if (sawOpeningBrace && depth === 0) break;
  }

  return output;
}

function collectUntil(
  lines: string[],
  marker: string,
  isTerminalLine: (line: string) => boolean
): number[] {
  const start = lines.findIndex((line) => line.includes(marker));
  if (start === -1) return [];

  const output: number[] = [];
  for (let index = start; index < lines.length; index += 1) {
    output.push(index + 1);
    if (isTerminalLine(lines[index])) break;
  }

  return output;
}

function buildWorkflowLineMap(code: string): WorkflowLineMap {
  const lines = code.split("\n");

  return {
    sendLoop: collectUntil(
      lines,
      "const result = await sendRequest(",
      (line) => line.includes("results.push(result)")
    ),
    emitCollected: collectUntil(
      lines,
      'type: "all_replies_collected"',
      (line) => line.includes("all_replies_collected")
    ),
    emitDone: collectUntil(
      lines,
      'type: "done"',
      (line) => line.includes('type: "done"')
    ),
  };
}

function buildStepLineMap(code: string): StepLineMap {
  const lines = code.split("\n");

  return {
    sendRequest: collectFunctionBlock(lines, "async function sendRequest("),
  };
}

const workflowLinesHtml = highlightCodeToHtmlLines(workflowCode);
const stepLinesHtml = highlightCodeToHtmlLines(stepCode);
const workflowLineMap = buildWorkflowLineMap(workflowCode);
const stepLineMap = buildStepLineMap(stepCode);

export default function Home() {
  return (
    <div className="min-h-screen bg-background-100 p-8 text-gray-1000">
      <main id="main-content" className="mx-auto max-w-4xl" role="main">
        <header className="mb-12">
          <div className="mb-4 inline-flex items-center rounded-full border border-blue-700/40 bg-blue-700/20 px-3 py-1 text-sm font-medium text-blue-700">
            Workflow DevKit Example
          </div>
          <h1 className="mb-4 text-4xl font-semibold tracking-tight text-gray-1000">
            Request-Reply
          </h1>
          <p className="max-w-2xl text-lg text-gray-900">
            Send a request to each service, wait for a correlated reply within
            a deadline, and retry on timeout. Each request-reply pair is a
            durable step — crashes mid-request resume exactly where they left
            off.
          </p>
        </header>

        <section aria-labelledby="try-it-heading" className="mb-12">
          <h2 id="try-it-heading" className="mb-4 text-2xl font-semibold tracking-tight">
            Try It
          </h2>

          <div className="rounded-lg border border-gray-400 bg-background-200 p-6">
            <RequestReplyDemo
              workflowCode={workflowCode}
              workflowLinesHtml={workflowLinesHtml}
              stepCode={stepCode}
              stepLinesHtml={stepLinesHtml}
              workflowLineMap={workflowLineMap}
              stepLineMap={stepLineMap}
            />
          </div>
        </section>

        <footer
          className="border-t border-gray-400 py-6 text-center text-sm text-gray-900"
          role="contentinfo"
        >
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
