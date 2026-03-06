import { readFileSync } from "node:fs";
import { join } from "node:path";
import { highlightCodeToHtmlLines } from "./components/code-highlight-server";
import { ScatterGatherDemo } from "./components/demo";

type ProviderId = "fedex" | "ups" | "dhl" | "usps";

type WorkflowLineMap = {
  allSettled: number[];
  results: number[];
  returnGather: number[];
};

type StepLineMap = Record<ProviderId, number[]>;
type StepErrorLineMap = Record<ProviderId, number[]>;
type StepSuccessLineMap = Record<ProviderId, number[]>;

const workflowSource = readFileSync(
  join(process.cwd(), "workflows/scatter-gather.ts"),
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

const workflowCode = extractFunctionBlock(workflowSource, "export async function scatterGather(");

const stepCode = [
  extractFunctionBlock(workflowSource, "async function fetchProviderQuote("),
  "",
  extractFunctionBlock(workflowSource, "async function fetchFedExQuote("),
  "",
  extractFunctionBlock(workflowSource, "async function fetchUpsQuote("),
  "",
  extractFunctionBlock(workflowSource, "async function fetchDhlQuote("),
  "",
  extractFunctionBlock(workflowSource, "async function fetchUspsQuote("),
  "",
  extractFunctionBlock(workflowSource, "async function gatherBestQuote("),
].join("\n");

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
    allSettled: collectUntil(
      lines,
      "const settled = await Promise.allSettled(",
      (line) => line.trim() === ");"
    ),
    results: collectUntil(
      lines,
      "const results: ProviderResult[]",
      (line) => line.trim() === "});"
    ),
    returnGather: collectUntil(
      lines,
      "return gatherBestQuote(",
      (line) => line.includes("return gatherBestQuote(")
    ),
  };
}

function buildStepLineMap(code: string): StepLineMap {
  const lines = code.split("\n");

  return {
    fedex: collectFunctionBlock(lines, "async function fetchFedExQuote("),
    ups: collectFunctionBlock(lines, "async function fetchUpsQuote("),
    dhl: collectFunctionBlock(lines, "async function fetchDhlQuote("),
    usps: collectFunctionBlock(lines, "async function fetchUspsQuote("),
  };
}

function findErrorLine(lines: string[], marker: string): number[] {
  const index = lines.findIndex((line) => line.includes(marker));
  return index === -1 ? [] : [index + 1];
}

function buildStepErrorLineMap(code: string): StepErrorLineMap {
  const lines = code.split("\n");
  const errorLine = findErrorLine(lines, "throw new Error(error)");

  return {
    fedex: errorLine,
    ups: errorLine,
    dhl: errorLine,
    usps: errorLine,
  };
}

function findReturnLineInBlock(lines: string[], fnMarker: string): number[] {
  const start = lines.findIndex((line) => line.includes(fnMarker));
  if (start === -1) return [];
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith("return ")) return [i + 1];
    if (lines[i].trimStart().startsWith("async function ") || lines[i].trim() === "}") {
      if (lines[i].trim() === "}") continue;
      break;
    }
  }
  return [];
}

function buildStepSuccessLineMap(code: string): StepSuccessLineMap {
  const lines = code.split("\n");
  const successLine = findReturnLineInBlock(lines, "async function fetchProviderQuote(");

  return {
    fedex: successLine,
    ups: successLine,
    dhl: successLine,
    usps: successLine,
  };
}

const workflowLinesHtml = highlightCodeToHtmlLines(workflowCode);
const stepLinesHtml = highlightCodeToHtmlLines(stepCode);
const workflowLineMap = buildWorkflowLineMap(workflowCode);
const stepLineMap = buildStepLineMap(stepCode);
const stepErrorLineMap = buildStepErrorLineMap(stepCode);
const stepSuccessLineMap = buildStepSuccessLineMap(stepCode);

export default function Home() {
  return (
    <div className="min-h-screen bg-background-100 p-8 text-gray-1000">
      <main id="main-content" className="mx-auto max-w-4xl" role="main">
        <header className="mb-12">
          <div className="mb-4 inline-flex items-center rounded-full border border-blue-700/40 bg-blue-700/20 px-3 py-1 text-sm font-medium text-blue-700">
            Workflow DevKit Example
          </div>
          <h1 className="mb-4 text-4xl font-semibold tracking-tight text-gray-1000">
            Scatter-Gather Quotes
          </h1>
          <p className="max-w-2xl text-lg text-gray-900">
            Fan out shipping quote requests to FedEx, UPS, DHL, and USPS in
            parallel, then gather and pick the cheapest.{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">
              Promise.allSettled()
            </code>{" "}
            ensures every provider settles before the gather step selects the winner.
          </p>
        </header>

        <section aria-labelledby="try-it-heading" className="mb-12">
          <h2 id="try-it-heading" className="mb-4 text-2xl font-semibold tracking-tight">
            Try It
          </h2>

          <div className="rounded-lg border border-gray-400 bg-background-200 p-6">
            <ScatterGatherDemo
              workflowCode={workflowCode}
              workflowLinesHtml={workflowLinesHtml}
              stepCode={stepCode}
              stepLinesHtml={stepLinesHtml}
              workflowLineMap={workflowLineMap}
              stepLineMap={stepLineMap}
              stepErrorLineMap={stepErrorLineMap}
              stepSuccessLineMap={stepSuccessLineMap}
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
