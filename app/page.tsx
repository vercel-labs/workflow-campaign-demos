import { readFileSync } from "node:fs";
import { join } from "node:path";
import { highlightCodeToHtmlLines } from "./components/code-highlight-server";
import { MessageHistoryDemo } from "./components/demo";

// Read the actual workflow source file — displayed in the code workbench
const workflowSource = readFileSync(
  join(process.cwd(), "workflows/message-history.ts"),
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

const orchestratorCode = extractFunctionBlock(
  workflowSource,
  "export async function messageHistory("
);

const stepCode = [
  extractFunctionBlock(workflowSource, "async function createEnvelope("),
  "",
  extractFunctionBlock(workflowSource, "async function normalizeTicket("),
  "",
  extractFunctionBlock(workflowSource, "async function classifySeverity("),
  "",
  extractFunctionBlock(workflowSource, "async function chooseRoute("),
  "",
  extractFunctionBlock(workflowSource, "async function dispatchTicket("),
  "",
  extractFunctionBlock(workflowSource, "async function finalizeSuccess("),
  "",
  extractFunctionBlock(workflowSource, "async function finalizeFailure("),
].join("\n");

// ── Line maps ────────────────────────────────────────────────────────────

function findLineNumbers(code: string, marker: string): number[] {
  const idx = code.split("\n").findIndex((line) => line.includes(marker));
  return idx === -1 ? [] : [idx + 1];
}

function collectFunctionBlock(code: string, marker: string): number[] {
  const lines = code.split("\n");
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

function buildOrchestratorLineMap(code: string) {
  return {
    createEnvelope: findLineNumbers(code, "await createEnvelope("),
    normalizeTicket: findLineNumbers(code, "await normalizeTicket("),
    classifySeverity: findLineNumbers(code, "await classifySeverity("),
    chooseRoute: findLineNumbers(code, "await chooseRoute("),
    dispatchTicket: findLineNumbers(code, "await dispatchTicket("),
    finalizeSuccess: findLineNumbers(code, "await finalizeSuccess("),
    finalizeFailure: findLineNumbers(code, "await finalizeFailure("),
    tryCatch: findLineNumbers(code, "} catch (err)"),
  };
}

function buildStepLineMap(code: string) {
  return {
    createEnvelope: collectFunctionBlock(code, "async function createEnvelope("),
    normalizeTicket: collectFunctionBlock(code, "async function normalizeTicket("),
    classifySeverity: collectFunctionBlock(code, "async function classifySeverity("),
    chooseRoute: collectFunctionBlock(code, "async function chooseRoute("),
    dispatchTicket: collectFunctionBlock(code, "async function dispatchTicket("),
    finalizeSuccess: collectFunctionBlock(code, "async function finalizeSuccess("),
    finalizeFailure: collectFunctionBlock(code, "async function finalizeFailure("),
  };
}

const orchestratorHtmlLines = highlightCodeToHtmlLines(orchestratorCode);
const stepHtmlLines = highlightCodeToHtmlLines(stepCode);
const orchestratorLineMap = buildOrchestratorLineMap(orchestratorCode);
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
            Message History
          </h1>
          <p className="max-w-2xl text-lg text-gray-900">
            A structured <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">history[]</code>{" "}
            array travels through every workflow step. Each step appends
            machine-readable entries for start, decision, success, and failure
            — giving you full observability of the ticket routing pipeline.
          </p>
        </header>

        <section aria-labelledby="try-it-heading" className="mb-12">
          <h2 id="try-it-heading" className="mb-4 text-2xl font-semibold tracking-tight">
            Try It
          </h2>

          <div className="rounded-lg border border-gray-400 bg-background-200 p-6">
            <MessageHistoryDemo
              orchestratorCode={orchestratorCode}
              orchestratorHtmlLines={orchestratorHtmlLines}
              orchestratorLineMap={orchestratorLineMap}
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
