// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  collectFunctionBlock,
  collectUntil,
  extractFunctionBlock,
  highlightCodeToHtmlLines,
} from "@/lib/code-workbench.server";

type WorkflowLineMap = {
  forLoop: number[];
  returnResults: number[];
};

type StepLineMap = {
  processMessage: number[];
  recordResults: number[];
};

export type DeadLetterQueueCodeProps = {
  workflowCode: string;
  workflowLinesHtml: string[];
  stepCode: string;
  stepLinesHtml: string[];
  workflowLineMap: WorkflowLineMap;
  stepLineMap: StepLineMap;
};

function buildWorkflowLineMap(code: string): WorkflowLineMap {
  const lines = code.split("\n");
  return {
    forLoop: collectUntil(
      lines,
      "for (const messageId of messages)",
      (line) => line.trim() === "}",
    ),
    returnResults: collectUntil(
      lines,
      "return recordResults(",
      (line) => line.includes("return recordResults("),
    ),
  };
}

function buildStepLineMap(code: string): StepLineMap {
  const lines = code.split("\n");
  return {
    processMessage: collectFunctionBlock(lines, "async function processMessage("),
    recordResults: collectFunctionBlock(lines, "async function recordResults("),
  };
}

export function getDeadLetterQueueCodeProps(): DeadLetterQueueCodeProps {
  const workflowSource = readFileSync(
    join(process.cwd(), "dead-letter-queue/workflows/dead-letter-queue.ts"),
    "utf-8",
  );

  const workflowCode = extractFunctionBlock(
    workflowSource,
    "export async function deadLetterQueue(",
  );

  const stepCode = [
    extractFunctionBlock(workflowSource, "async function processMessage("),
    "",
    extractFunctionBlock(workflowSource, "async function recordResults("),
  ].join("\n");

  return {
    workflowCode,
    workflowLinesHtml: highlightCodeToHtmlLines(workflowCode),
    stepCode,
    stepLinesHtml: highlightCodeToHtmlLines(stepCode),
    workflowLineMap: buildWorkflowLineMap(workflowCode),
    stepLineMap: buildStepLineMap(stepCode),
  };
}
