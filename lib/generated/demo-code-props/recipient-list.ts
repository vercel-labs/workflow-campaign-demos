// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  collectFunctionBlock,
  collectUntil,
  extractFunctionBlock,
  highlightCodeToHtmlLines,
} from "@/lib/code-workbench.server";

type ChannelId = "slack" | "email" | "pagerduty" | "webhook";

type WorkflowLineMap = {
  rulesEvaluated: number[];
  allSettled: number[];
  deliveries: number[];
  summary: number[];
};

type StepLineMap = Record<ChannelId, number[]>;
type StepErrorLineMap = Record<ChannelId, number[]>;
type StepRetryLineMap = Record<ChannelId, number[]>;
type StepSuccessLineMap = Record<ChannelId, number[]>;

export type RecipientListCodeProps = {
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
    rulesEvaluated: collectUntil(
      lines,
      "const matched = RULES.filter(",
      (line) => line.includes("rules_evaluated"),
    ),
    allSettled: collectUntil(
      lines,
      "const settled = await Promise.allSettled(",
      (line) => line.trim() === ");",
    ),
    deliveries: collectUntil(
      lines,
      "const deliveries: DeliveryResult[]",
      (line) => line.trim() === "});",
    ),
    summary: collectUntil(
      lines,
      "return aggregateResults(",
      (line) => line.includes("return aggregateResults("),
    ),
  };
}

function buildStepLineMap(code: string): StepLineMap {
  const lines = code.split("\n");
  const deliverBlock = collectFunctionBlock(lines, "async function deliverToRecipient(");
  return {
    slack: deliverBlock,
    email: deliverBlock,
    pagerduty: deliverBlock,
    webhook: deliverBlock,
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
    pagerduty: errorLine,
    webhook: errorLine,
  };
}

function buildStepRetryLineMap(code: string): StepRetryLineMap {
  const lines = code.split("\n");
  const retryLine = findErrorLine(lines, "throw new Error(CHANNEL_ERROR_MESSAGES[channel])");
  return {
    slack: retryLine,
    email: retryLine,
    pagerduty: retryLine,
    webhook: retryLine,
  };
}

function findReturnLineInBlock(lines: string[], fnMarker: string): number[] {
  const start = lines.findIndex((line) => line.includes(fnMarker));
  if (start === -1) return [];
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith("return {")) return [i + 1];
    if (lines[i].trimStart().startsWith("async function ") || lines[i].trim() === "}") {
      if (lines[i].trim() === "}") continue;
      break;
    }
  }
  return [];
}

function buildStepSuccessLineMap(code: string): StepSuccessLineMap {
  const lines = code.split("\n");
  const successLine = findReturnLineInBlock(lines, "async function deliverToRecipient(");
  return {
    slack: successLine,
    email: successLine,
    pagerduty: successLine,
    webhook: successLine,
  };
}

export function getRecipientListCodeProps(): RecipientListCodeProps {
  const workflowSource = readFileSync(
    join(process.cwd(), "recipient-list/workflows/recipient-list.ts"),
    "utf-8",
  );

  const workflowCode = extractFunctionBlock(
    workflowSource,
    "export async function recipientList(",
  );

  const stepCode = [
    extractFunctionBlock(workflowSource, "async function deliverToRecipient("),
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
