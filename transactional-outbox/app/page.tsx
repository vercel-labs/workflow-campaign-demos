import { readFileSync } from "node:fs";
import { join } from "node:path";
import { highlightCodeToHtmlLines } from "./components/code-highlight-server";
import { OutboxDemo } from "./components/demo";

type OutboxStepId = "persist" | "relay" | "publish" | "mark_sent";

const workflowSource = readFileSync(
  join(process.cwd(), "workflows/transactional-outbox.ts"),
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
  "export async function transactionalOutbox("
);

const stepCode = [
  extractFunctionBlock(workflowSource, "async function persistOrder("),
  "",
  extractFunctionBlock(workflowSource, "async function pollRelay("),
  "",
  extractFunctionBlock(workflowSource, "async function publishEvent("),
  "",
  extractFunctionBlock(workflowSource, "async function markSent("),
].join("\n");

function collectFunctionBlock(lines: string[], marker: string): number[] {
  const start = lines.findIndex((line) => line.includes(marker));
  if (start === -1) return [];

  const output: number[] = [];
  let depth = 0;
  let sawBrace = false;

  for (let index = start; index < lines.length; index += 1) {
    output.push(index + 1);
    const opens = (lines[index].match(/{/g) ?? []).length;
    const closes = (lines[index].match(/}/g) ?? []).length;
    depth += opens - closes;
    if (opens > 0) sawBrace = true;
    if (sawBrace && depth === 0) break;
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

type WorkflowLineMap = {
  persistCall: number[];
  relayCall: number[];
  publishCall: number[];
  markSentCall: number[];
};

type StepLineMap = Record<OutboxStepId, number[]>;

function buildWorkflowLineMap(code: string): WorkflowLineMap {
  const lines = code.split("\n");

  return {
    persistCall: collectUntil(
      lines,
      "await persistOrder(",
      (line) => line.includes("await persistOrder(")
    ),
    relayCall: collectUntil(
      lines,
      "await pollRelay(",
      (line) => line.includes("await pollRelay(")
    ),
    publishCall: collectUntil(
      lines,
      "await publishEvent(",
      (line) => line.includes("await publishEvent(")
    ),
    markSentCall: collectUntil(
      lines,
      "return markSent(",
      (line) => line.includes("return markSent(")
    ),
  };
}

function buildStepLineMap(code: string): StepLineMap {
  const lines = code.split("\n");

  return {
    persist: collectFunctionBlock(lines, "async function persistOrder("),
    relay: collectFunctionBlock(lines, "async function pollRelay("),
    publish: collectFunctionBlock(lines, "async function publishEvent("),
    mark_sent: collectFunctionBlock(lines, "async function markSent("),
  };
}

const workflowLinesHtml = highlightCodeToHtmlLines(workflowCode);
const stepLinesHtml = highlightCodeToHtmlLines(stepCode);
const workflowLineMap = buildWorkflowLineMap(workflowCode);
const stepLineMap = buildStepLineMap(stepCode);

export default function Home() {
  return (
    <div className="min-h-screen bg-background-100 p-8 text-gray-1000">
      <main id="main-content" className="mx-auto max-w-5xl" role="main">
        <header className="mb-10">
          <div className="mb-4 inline-flex items-center rounded-full border border-blue-700/40 bg-blue-700/20 px-3 py-1 text-sm font-medium text-blue-700">
            Workflow DevKit Example
          </div>
          <h1 className="mb-4 text-5xl font-semibold tracking-tight text-gray-1000">
            Transactional Outbox
          </h1>
          <p className="max-w-3xl text-lg text-gray-900">
            Guarantee exactly-once delivery by writing events to an outbox table
            alongside business data, then relaying them to a message broker in a
            separate step. The workflow persists the order, polls the outbox,
            publishes to the broker, and marks the entry as sent — each step
            streams progress via{" "}
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
            Start a transactional outbox run and watch the order move through
            persist → relay → publish → confirm while the code pane highlights
            the executing step.
          </p>

          <OutboxDemo
            workflowCode={workflowCode}
            workflowLinesHtml={workflowLinesHtml}
            stepCode={stepCode}
            stepLinesHtml={stepLinesHtml}
            workflowLineMap={workflowLineMap}
            stepLineMap={stepLineMap}
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
