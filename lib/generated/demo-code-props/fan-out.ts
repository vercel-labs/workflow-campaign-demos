// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  collectFunctionBlock,
  collectUntil,
  extractFunctionBlock,
  highlightCodeToHtmlLines,
} from "@/lib/code-workbench.server";

type ChannelId = "slack" | "email" | "sms" | "pagerduty";

type WorkflowLineMap = {
  allSettled: number[];
  deliveries: number[];
  summary: number[];
  returnResult: number[];
};

type StepLineMap = Record<ChannelId, number[]>;
type StepErrorLineMap = Record<ChannelId, number[]>;
type StepRetryLineMap = Record<ChannelId, number[]>;
type StepSuccessLineMap = Record<ChannelId, number[]>;

export type FanOutCodeProps = {
  workflowCode: string;
  workflowLinesHtml: string[];
  stepCode: string;
  stepLinesHtml: string[];
  workflowLineMap: WorkflowLineMap;
  stepLineMap: StepLineMap;
  stepErrorLineMap: StepErrorLineMap;
  stepRetryLineMap: StepRetryLineMap;
  stepSuccessLineMap: StepSuccessLineMap;
};

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
  const errorLine = findErrorLine(lines, "throw new FatalError(");
  return {
    slack: errorLine,
    email: errorLine,
    sms: errorLine,
    pagerduty: errorLine,
  };
}

function buildStepRetryLineMap(code: string): StepRetryLineMap {
  const lines = code.split("\n");
  const retryLine = findErrorLine(
    lines,
    "throw new Error(CHANNEL_ERROR_MESSAGES[channel])"
  );
  return {
    slack: retryLine,
    email: retryLine,
    sms: retryLine,
    pagerduty: retryLine,
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
  const successLine = findReturnLineInBlock(
    lines,
    "async function sendChannelAlert("
  );
  return {
    slack: successLine,
    email: successLine,
    sms: successLine,
    pagerduty: successLine,
  };
}

export function getFanOutCodeProps(): FanOutCodeProps {
  const workflowSource = readFileSync(
    join(process.cwd(), "fan-out/workflows/incident-fanout.ts"),
    "utf-8",
  );

  const workflowCode = extractFunctionBlock(
    workflowSource,
    "export async function incidentFanOut(",
  );

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

  return {
    workflowCode,
    workflowLinesHtml: highlightCodeToHtmlLines(workflowCode),
    stepCode,
    stepLinesHtml: highlightCodeToHtmlLines(stepCode),
    workflowLineMap: buildWorkflowLineMap(workflowCode),
    stepLineMap: buildStepLineMap(stepCode),
    stepErrorLineMap: buildStepErrorLineMap(stepCode),
    stepRetryLineMap: buildStepRetryLineMap(stepCode),
    stepSuccessLineMap: buildStepSuccessLineMap(stepCode),
  };
}
