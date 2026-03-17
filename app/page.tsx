import { readFileSync } from "node:fs";
import { join } from "node:path";
import { highlightCodeToHtmlLines } from "./components/code-highlight-server";
import { SplitterDemo } from "./components/demo";

type WorkflowLineMap = {
  splitting: number[];
  forLoop: number[];
  aggregating: number[];
  done: number[];
};

type StepLineMap = {
  processing: number[];
  validated: number[];
  failed: number[];
  reserved: number[];
  fulfilled: number[];
};

// Read the actual workflow source file — displayed in the code workbench
const workflowSource = readFileSync(
  join(process.cwd(), "workflows/order-splitter.ts"),
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

const workflowCode = extractFunctionBlock(workflowSource, "export async function orderSplitter(");
const stepCode = extractFunctionBlock(workflowSource, "async function processLineItem(");

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

function collectFunctionBlock(lines: string[], marker: string): number[] {
  const start = lines.findIndex((line) => line.includes(marker));
  if (start === -1) return [];

  const output: number[] = [];
  let depth = 0;
  let sawOpeningBrace = false;

  for (let index = start; index < lines.length; index += 1) {
    output.push(index + 1);
    const opens = (lines[index].match(/{/g) ?? []).length;
    const closes = (lines[index].match(/}/g) ?? []).length;
    depth += opens - closes;
    if (opens > 0) sawOpeningBrace = true;
    if (sawOpeningBrace && depth === 0) break;
  }
  return output;
}

function buildWorkflowLineMap(code: string): WorkflowLineMap {
  const lines = code.split("\n");

  return {
    splitting: collectUntil(
      lines,
      'type: "splitting"',
      (line) => line.includes("});")
    ),
    forLoop: collectUntil(
      lines,
      "for (let i = 0;",
      (line) => line.trim() === "}"
    ),
    aggregating: collectUntil(
      lines,
      'type: "aggregating"',
      (line) => line.includes("AGGREGATE_DELAY_MS")
    ),
    done: collectUntil(
      lines,
      'type: "done"',
      (line) => line.includes("summary")
    ),
  };
}

function buildStepLineMap(code: string): StepLineMap {
  const lines = code.split("\n");

  return {
    processing: collectUntil(
      lines,
      'type: "item_processing"',
      (line) => line.includes("ITEM_DELAY_MS")
    ),
    validated: collectUntil(
      lines,
      'type: "item_validated"',
      (line) => line.includes("ITEM_DELAY_MS")
    ),
    failed: collectUntil(
      lines,
      "if (shouldFail)",
      (line) => line.includes("throw new FatalError")
    ),
    reserved: collectUntil(
      lines,
      'type: "item_reserved"',
      (line) => line.includes("ITEM_DELAY_MS")
    ),
    fulfilled: collectUntil(
      lines,
      'type: "item_fulfilled"',
      (line) => line.includes("hookToken")
    ),
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
            Splitter
          </h1>
          <p className="max-w-2xl text-lg text-gray-900">
            Decompose a composite order into individual line items and process
            each one through{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">
              validate → reserve → fulfill
            </code>{" "}
            steps. Failed items are tracked individually without blocking the
            rest of the order.
          </p>
        </header>

        <section aria-labelledby="try-it-heading" className="mb-12">
          <h2 id="try-it-heading" className="mb-4 text-2xl font-semibold tracking-tight">
            Try It
          </h2>

          <div className="rounded-lg border border-gray-400 bg-background-200 p-6">
            <SplitterDemo
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
