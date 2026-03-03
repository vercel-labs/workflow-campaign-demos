import { readFileSync } from "node:fs";
import { join } from "node:path";
import { highlightCodeToHtmlLines } from "./components/code-highlight-server";
import { FanOutDemo } from "./components/demo";

type ChannelId = "slack" | "email" | "sms" | "pagerduty";

type WorkflowLineMap = {
  allSettled: number[];
  deliveries: number[];
  summary: number[];
  returnResult: number[];
};

type StepLineMap = Record<ChannelId, number[]>;
type StepErrorLineMap = Record<ChannelId, number[]>;
type StepSuccessLineMap = Record<ChannelId, number[]>;

// Read the actual workflow source file — displayed in the code workbench
const workflowSource = readFileSync(
  join(process.cwd(), "workflows/incident-fanout.ts"),
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

const workflowCode = extractFunctionBlock(workflowSource, "export async function incidentFanOut(");

const stepCode = [
  extractFunctionBlock(workflowSource, "async function sendChannelAlert("),
  "",
  extractFunctionBlock(workflowSource, "async function sendSlackAlert("),
  "",
  extractFunctionBlock(workflowSource, "async function sendEmailAlert("),
  "",
  extractFunctionBlock(workflowSource, "async function sendSmsAlert("),
  "",
  extractFunctionBlock(workflowSource, "async function sendPagerDutyAlert("),
  "",
  extractFunctionBlock(workflowSource, "async function aggregateResults("),
].join("\n");

function collectFunctionBlock(lines: string[], marker: string): number[] {
  const start = lines.findIndex((line) => line.includes(marker));
  if (start === -1) {
    return [];
  }

  const output: number[] = [];
  let depth = 0;
  let sawOpeningBrace = false;

  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];
    output.push(index + 1);

    const opens = (line.match(/{/g) ?? []).length;
    const closes = (line.match(/}/g) ?? []).length;

    depth += opens - closes;
    if (opens > 0) {
      sawOpeningBrace = true;
    }

    if (sawOpeningBrace && depth === 0) {
      break;
    }
  }

  return output;
}

function collectUntil(
  lines: string[],
  marker: string,
  isTerminalLine: (line: string) => boolean
): number[] {
  const start = lines.findIndex((line) => line.includes(marker));
  if (start === -1) {
    return [];
  }

  const output: number[] = [];
  for (let index = start; index < lines.length; index += 1) {
    output.push(index + 1);
    if (isTerminalLine(lines[index])) {
      break;
    }
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
    deliveries: collectUntil(
      lines,
      "const deliveries: ChannelResult[]",
      (line) => line.trim() === "});"
    ),
    summary: collectUntil(
      lines,
      "return aggregateResults(",
      (line) => line.includes("return aggregateResults(")
    ),
    returnResult: collectUntil(
      lines,
      "return aggregateResults(",
      (line) => line.includes("return aggregateResults(")
    ),
  };
}

function buildStepLineMap(code: string): StepLineMap {
  const lines = code.split("\n");

  return {
    slack: collectFunctionBlock(lines, "async function sendSlackAlert("),
    email: collectFunctionBlock(lines, "async function sendEmailAlert("),
    sms: collectFunctionBlock(lines, "async function sendSmsAlert("),
    pagerduty: collectFunctionBlock(lines, "async function sendPagerDutyAlert("),
  };
}

function findErrorLine(lines: string[], marker: string): number[] {
  const index = lines.findIndex((line) => line.includes(marker));
  return index === -1 ? [] : [index + 1];
}

function buildStepErrorLineMap(code: string): StepErrorLineMap {
  const lines = code.split("\n");
  // All channels share sendChannelAlert — the throw line is the same for all
  const errorLine = findErrorLine(lines, "throw new Error(CHANNEL_ERROR_MESSAGES[channel])");

  return {
    slack: errorLine,
    email: errorLine,
    sms: errorLine,
    pagerduty: errorLine,
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
  // All channels share sendChannelAlert — the success return is the same for all
  const successLine = findReturnLineInBlock(lines, "async function sendChannelAlert(");

  return {
    slack: successLine,
    email: successLine,
    sms: successLine,
    pagerduty: successLine,
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
            Fan-Out Notifications
          </h1>
          <p className="max-w-2xl text-lg text-gray-900">
            Broadcast an incident alert to Slack, Email, SMS, and PagerDuty in
            parallel. <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">Promise.allSettled()</code>{" "}
            ensures every channel completes and returns a full delivery report,
            even when one branch fails.
          </p>
        </header>

        <section aria-labelledby="try-it-heading" className="mb-12">
          <h2 id="try-it-heading" className="mb-4 text-2xl font-semibold tracking-tight">
            Try It
          </h2>

          <div className="rounded-lg border border-gray-400 bg-background-200 p-6">
            <FanOutDemo
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
