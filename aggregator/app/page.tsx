import { readFileSync } from "node:fs";
import { join } from "node:path";
import { highlightCodeToHtmlLines } from "./components/code-highlight-server";
import { AggregatorDemo } from "./components/demo";

const workflowSource = readFileSync(
  join(process.cwd(), "workflows/aggregator.ts"),
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

const workflowCode = extractFunctionBlock(
  workflowSource,
  "export async function aggregator("
);

const stepCode = [
  extractFunctionBlock(workflowSource, "async function emit<T>("),
  "",
  extractFunctionBlock(workflowSource, "async function processBatch("),
].join("\n");

function collectUntil(
  lines: string[],
  marker: string,
  isTerminalLine: (line: string) => boolean
): number[] {
  const start = lines.findIndex((line) => line.includes(marker));
  if (start === -1) return [];
  const output: number[] = [];
  for (let index = start; index < lines.length; index++) {
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
  let sawBrace = false;
  for (let index = start; index < lines.length; index++) {
    output.push(index + 1);
    const opens = (lines[index].match(/{/g) ?? []).length;
    const closes = (lines[index].match(/}/g) ?? []).length;
    depth += opens - closes;
    if (opens > 0) sawBrace = true;
    if (sawBrace && depth === 0) break;
  }
  return output;
}

function findLines(lines: string[], marker: string): number[] {
  return lines
    .map((line, index) => (line.includes(marker) ? index + 1 : null))
    .filter((line): line is number => line !== null);
}

function buildWorkflowLineMap(code: string) {
  const lines = code.split("\n");

  return {
    hookCreate: collectUntil(
      lines,
      "const hooks = SOURCES.map(",
      (line) => line.trim() === "});"
    ),
    promiseRace: collectUntil(
      lines,
      "const outcome = await Promise.race(",
      (line) => line.trim() === "]);"
    ),
    signalReceived: findLines(lines, "signal_received"),
    allCollected: findLines(lines, "all_collected"),
    timeout: findLines(lines, '"timeout"'),
    processBatch: findLines(lines, "await processBatch("),
    returnResult: collectUntil(
      lines,
      "return { batchId",
      (line) => line.includes("return { batchId")
    ),
  };
}

function buildStepLineMap(code: string) {
  const lines = code.split("\n");

  return {
    emit: collectFunctionBlock(lines, "async function emit<T>("),
    processBatch: collectFunctionBlock(lines, "async function processBatch("),
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
          <div className="mb-4 inline-flex items-center rounded-full border border-cyan-700/40 bg-cyan-700/20 px-3 py-1 text-sm font-medium text-cyan-700">
            Workflow DevKit Example
          </div>
          <h1 className="mb-4 text-4xl font-semibold tracking-tight text-gray-1000">
            Aggregator
          </h1>
          <p className="max-w-3xl text-lg text-gray-900">
            Collect signals from multiple sources with a deadline, then aggregate
            the results into a single batch. Uses{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">
              defineHook()
            </code>{" "}
            for durable signal collection and{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">
              Promise.race()
            </code>{" "}
            against{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">
              sleep()
            </code>{" "}
            for the timeout — partial results are still processed.
          </p>
        </header>

        <section aria-labelledby="try-it-heading" className="mb-12">
          <h2
            id="try-it-heading"
            className="mb-4 text-2xl font-semibold tracking-tight"
          >
            Try It
          </h2>
          <div className="rounded-lg border border-gray-400 bg-background-200 p-6">
            <AggregatorDemo
              workflowCode={workflowCode}
              workflowHtmlLines={workflowHtmlLines}
              stepCode={stepCode}
              stepHtmlLines={stepHtmlLines}
              workflowLineMap={workflowLineMap}
              stepLineMap={stepLineMap}
            />
          </div>
        </section>

        <section aria-labelledby="contrast-heading" className="mb-16">
          <h2
            id="contrast-heading"
            className="text-2xl font-semibold mb-4 tracking-tight"
          >
            Why Not Just Poll?
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-400 bg-background-200 p-6">
              <div className="text-sm font-semibold text-red-700 uppercase tracking-widest mb-3">
                Traditional
              </div>
              <p className="text-base text-gray-900 leading-relaxed">
                You need a <strong className="text-gray-1000">message queue</strong>,
                a database table tracking which signals arrived, a polling loop or
                webhook receiver, and a separate timeout scheduler. The aggregation
                logic spans multiple services and infrastructure components.
              </p>
            </div>
            <div className="rounded-lg border border-green-700/40 bg-green-700/5 p-6">
              <div className="text-sm font-semibold text-green-700 uppercase tracking-widest mb-3">
                Workflow Aggregator
              </div>
              <p className="text-base text-gray-900 leading-relaxed">
                Each source gets a{" "}
                <code className="text-green-700 font-mono text-sm">defineHook()</code>{" "}
                token.{" "}
                <code className="text-green-700 font-mono text-sm">Promise.race()</code>{" "}
                collects all signals or times out via{" "}
                <code className="text-green-700 font-mono text-sm">sleep()</code> — a
                durable timer at zero compute. Partial results are still aggregated.
              </p>
              <p className="text-sm text-gray-900 mt-3 leading-relaxed">
                No message queue. No polling. No external scheduler. The workflow{" "}
                <em>is</em> the aggregator.
              </p>
            </div>
          </div>
        </section>

        <footer
          className="border-t border-gray-400 py-6 text-center text-sm text-gray-400"
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
