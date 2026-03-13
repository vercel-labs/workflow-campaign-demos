import { readFileSync } from "node:fs";
import { join } from "node:path";
import { highlightCodeToHtmlLines } from "./components/code-highlight-server";
import { ResequencerDemo } from "./components/demo";

type ResequencerWorkflowLineMap = {
  createHooks: number[];
  waitLoop: number[];
  bufferLine: number[];
  releaseLine: number[];
  returnLine: number[];
};

type ResequencerStepLineMap = {
  emitStep: number[];
};

// Read the actual workflow source file — displayed in the code workbench
const workflowSource = readFileSync(
  join(process.cwd(), "workflows/resequencer.ts"),
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
  "export async function resequencer("
);

const stepCode = extractFunctionBlock(
  workflowSource,
  "async function emit<T>("
);

function collectFunctionBlock(lines: string[], marker: string): number[] {
  const start = lines.findIndex((line) => line.includes(marker));
  if (start === -1) return [];
  const output: number[] = [];
  let depth = 0;
  let sawBrace = false;
  for (let i = start; i < lines.length; i++) {
    output.push(i + 1);
    const opens = (lines[i].match(/{/g) ?? []).length;
    const closes = (lines[i].match(/}/g) ?? []).length;
    depth += opens - closes;
    if (opens > 0) sawBrace = true;
    if (sawBrace && depth === 0) break;
  }
  return output;
}

function collectUntil(
  lines: string[],
  startIncludes: string,
  endIncludes: string
): number[] {
  const start = lines.findIndex((l) => l.includes(startIncludes));
  if (start === -1) return [];
  const end = lines.findIndex((l, i) => i >= start && l.includes(endIncludes));
  if (end === -1) return [];
  return Array.from({ length: end - start + 1 }, (_, i) => start + i + 1);
}

function buildWorkflowLineMap(code: string): ResequencerWorkflowLineMap {
  const lines = code.split("\n");
  return {
    createHooks: collectUntil(lines, "const hooks = []", "hooks.push({"),
    waitLoop: collectUntil(lines, "while (ordered.length", "buffer.set(result.seq"),
    bufferLine: collectFunctionBlock(lines, "buffer.set(result.seq"),
    releaseLine: collectFunctionBlock(lines, "ordered.push(result.payload)"),
    returnLine: lines
      .map((l, i) => (l.includes("return { batchId, ordered") ? i + 1 : null))
      .filter((v): v is number => v !== null),
  };
}

function buildStepLineMap(code: string): ResequencerStepLineMap {
  const lines = code.split("\n");
  return {
    emitStep: lines
      .map((l, i) => (l.includes("await writer.write(event)") ? i + 1 : null))
      .filter((v): v is number => v !== null),
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
            Resequencer
          </h1>
          <p className="max-w-3xl text-lg text-gray-900">
            Fragments arrive out of order. The workflow buffers early arrivals and
            releases them only when contiguous sequence numbers are available, recovering
            correct order durably without external queues. Each fragment resumes a{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">
              defineHook
            </code>{" "}
            token via <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">
              resumeHook
            </code>.
          </p>
        </header>

        <section aria-labelledby="try-it-heading" className="mb-12">
          <h2 id="try-it-heading" className="mb-4 text-2xl font-semibold tracking-tight">
            Try It
          </h2>
          <div className="rounded-lg border border-gray-400 bg-background-200 p-6">
            <ResequencerDemo
              workflowCode={workflowCode}
              workflowHtmlLines={workflowHtmlLines}
              workflowLineMap={workflowLineMap}
              stepCode={stepCode}
              stepHtmlLines={stepHtmlLines}
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
