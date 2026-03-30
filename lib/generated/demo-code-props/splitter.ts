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
  splitting: number[];
  forLoop: number[];
  aggregating: number[];
  done: number[];
};

type StepLineMap = {
  processing: number[];
  validated: number[];
  failed: number[];
  reserved: number[];
  fulfilled: number[];
};

export type SplitterCodeProps = {
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
    splitting: collectUntil(
      lines,
      'type: "splitting"',
      (line) => line.includes("});"),
    ),
    forLoop: collectUntil(
      lines,
      "for (let i = 0;",
      (line) => line.trim() === "}",
    ),
    aggregating: collectUntil(
      lines,
      'type: "aggregating"',
      (line) => line.includes("AGGREGATE_DELAY_MS"),
    ),
    done: collectUntil(
      lines,
      'type: "done"',
      (line) => line.includes("summary"),
    ),
  };
}

function buildStepLineMap(code: string): StepLineMap {
  const lines = code.split("\n");

  return {
    processing: collectUntil(
      lines,
      'type: "item_processing"',
      (line) => line.includes("ITEM_DELAY_MS"),
    ),
    validated: collectUntil(
      lines,
      'type: "item_validated"',
      (line) => line.includes("ITEM_DELAY_MS"),
    ),
    failed: collectUntil(
      lines,
      "if (shouldFail)",
      (line) => line.includes("throw new FatalError"),
    ),
    reserved: collectUntil(
      lines,
      'type: "item_reserved"',
      (line) => line.includes("ITEM_DELAY_MS"),
    ),
    fulfilled: collectUntil(
      lines,
      'type: "item_fulfilled"',
      (line) => line.includes("hookToken"),
    ),
  };
}

export function getSplitterCodeProps(): SplitterCodeProps {
  const workflowSource = readFileSync(
    join(process.cwd(), "splitter/workflows/order-splitter.ts"),
    "utf-8",
  );

  const workflowCode = extractFunctionBlock(
    workflowSource,
    "export async function orderSplitter(",
  );

  const stepCode = extractFunctionBlock(
    workflowSource,
    "async function processLineItem(",
  );

  return {
    workflowCode,
    workflowLinesHtml: highlightCodeToHtmlLines(workflowCode),
    stepCode,
    stepLinesHtml: highlightCodeToHtmlLines(stepCode),
    workflowLineMap: buildWorkflowLineMap(workflowCode),
    stepLineMap: buildStepLineMap(stepCode),
  };
}
