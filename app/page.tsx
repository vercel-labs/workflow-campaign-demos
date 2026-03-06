import { readFileSync } from "fs";
import { join } from "path";
import { highlightCodeToHtmlLines } from "@/components/code-highlight-server";
import { BulkheadDemo } from "./components/demo";

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

function collectLines(lines: string[], startMatch: string, endMatch: (line: string) => boolean): number[] {
  const result: number[] = [];
  let inside = false;
  for (let i = 0; i < lines.length; i++) {
    if (!inside && lines[i].includes(startMatch)) {
      inside = true;
    }
    if (inside) {
      result.push(i + 1);
      if (endMatch(lines[i]) && result.length > 1) break;
    }
  }
  return result;
}

function collectSingleLine(lines: string[], match: string): number[] {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(match)) return [i + 1];
  }
  return [];
}

const workflowSource = readFileSync(
  join(process.cwd(), "workflows/bulkhead.ts"),
  "utf-8"
);

const workflowCode = extractFunctionBlock(workflowSource, "export async function bulkhead(");
const stepCode = extractFunctionBlock(workflowSource, "async function processItem(");

const workflowLines = workflowCode.split("\n");
const stepLines = stepCode.split("\n");

const workflowLineMap = {
  allSettled: collectLines(workflowLines, "Promise.allSettled(", (l) => l.trim().startsWith(");")),
  pacing: collectLines(workflowLines, "await sleep(", (l) => l.includes("sleep(")),
  summarize: collectLines(workflowLines, "return summarizeResults(", (l) => l.includes("summarizeResults(")),
};

const stepLineMap = {
  processing: collectSingleLine(stepLines, "item_processing"),
  success: collectSingleLine(stepLines, "item_success"),
  failure: collectSingleLine(stepLines, "item_failure"),
};

const workflowLinesHtml = highlightCodeToHtmlLines(workflowCode);
const stepLinesHtml = highlightCodeToHtmlLines(stepCode);

export default function Home() {
  return (
    <div className="min-h-screen bg-background-100 text-gray-1000 p-8">
      <main id="main-content" className="max-w-5xl mx-auto" role="main">
        <header className="mb-12">
          <div className="mb-4 inline-flex items-center rounded-full border border-indigo-700/40 bg-indigo-700/20 px-3 py-1 text-sm font-medium text-indigo-700">
            Workflow DevKit Example
          </div>

          <h1 className="text-4xl font-semibold mb-4 tracking-tight text-gray-1000">
            Bulkhead
          </h1>

          <p className="text-gray-900 text-lg max-w-2xl">
            Partition work into isolated compartments with bounded concurrency.
            Failures in one compartment never cascade to others.{" "}
            <code className="bg-background-200 border border-gray-300 px-2 py-0.5 rounded text-sm font-mono">
              Promise.allSettled()
            </code>{" "}
            ensures every compartment completes independently.
          </p>
        </header>

        <section aria-labelledby="try-it-heading" className="mb-12">
          <h2 id="try-it-heading" className="text-2xl font-semibold mb-4 tracking-tight">
            Try It
          </h2>

          <div className="bg-background-200 border border-gray-400 rounded-lg p-6">
            <BulkheadDemo
              workflowCode={workflowCode}
              workflowLinesHtml={workflowLinesHtml}
              stepCode={stepCode}
              stepLinesHtml={stepLinesHtml}
              workflowLineMap={workflowLineMap}
              stepLineMap={stepLineMap}
            />
          </div>
        </section>

        <footer className="border-t border-gray-400 py-6 text-center text-sm text-gray-400" role="contentinfo">
          <a
            href="https://useworkflow.dev/"
            className="underline underline-offset-2 hover:text-gray-1000 transition-colors"
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
