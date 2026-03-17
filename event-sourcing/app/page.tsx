import { readFileSync } from "node:fs";
import { join } from "node:path";
import { highlightCodeToHtmlLines } from "./components/code-highlight-server";
import { EventSourcingDemo } from "./components/demo";

type WorkflowLineMap = {
  commandLoop: number[];
  replayCall: number[];
  finalizeCall: number[];
};

type StepLineMap = {
  processCommands: number[];
  replayEventLog: number[];
  finalizeAggregate: number[];
};

const workflowSource = readFileSync(
  join(process.cwd(), "workflows/event-sourcing.ts"),
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
  "export async function eventSourcing("
);

const stepCode = [
  extractFunctionBlock(workflowSource, "async function processCommands("),
  "",
  extractFunctionBlock(workflowSource, "async function replayEventLog("),
  "",
  extractFunctionBlock(workflowSource, "async function finalizeAggregate("),
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
    commandLoop: collectUntil(
      lines,
      "const processResult = await processCommands(",
      (line) => line.includes(")")
    ),
    replayCall: collectUntil(
      lines,
      "const replayResult = await replayEventLog(",
      (line) => line.includes(")")
    ),
    finalizeCall: collectUntil(
      lines,
      "return finalizeAggregate(",
      (line) => line.includes(")")
    ),
  };
}

function buildStepLineMap(code: string): StepLineMap {
  const lines = code.split("\n");
  return {
    processCommands: collectFunctionBlock(lines, "async function processCommands("),
    replayEventLog: collectFunctionBlock(lines, "async function replayEventLog("),
    finalizeAggregate: collectFunctionBlock(lines, "async function finalizeAggregate("),
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
            Event Sourcing
          </h1>
          <p className="max-w-3xl text-lg text-gray-900">
            Append domain events to an immutable log, then rebuild state by
            replaying them. Uses{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">
              getWritable()
            </code>{" "}
            to stream each command validation, event append, and projection
            update to the client in real time. Replay verifies the projection
            is consistent with the event log.
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
            <EventSourcingDemo
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
            Why Not Just Update State Directly?
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-400 bg-background-200 p-6">
              <div className="text-sm font-semibold text-red-700 uppercase tracking-widest mb-3">
                Traditional
              </div>
              <p className="text-base text-gray-900 leading-relaxed">
                You overwrite the current state on every mutation. If something
                goes wrong, you lose the audit trail. Replaying history requires
                a separate event store, change-data-capture, or database triggers.
              </p>
            </div>
            <div className="rounded-lg border border-green-700/40 bg-green-700/5 p-6">
              <div className="text-sm font-semibold text-green-700 uppercase tracking-widest mb-3">
                Workflow Event Sourcing
              </div>
              <p className="text-base text-gray-900 leading-relaxed">
                Every command is validated against the current projection. Valid
                commands append exactly one domain event. The projection is rebuilt
                by replaying the log &mdash; no separate event store needed.
              </p>
              <p className="text-sm text-gray-900 mt-3 leading-relaxed">
                No database triggers. No CDC pipeline. No external event store.
                The workflow <em>is</em> the event log.
              </p>
            </div>
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
