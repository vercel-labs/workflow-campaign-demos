// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  collectFunctionBlock,
  collectUntil,
  extractFunctionBlock,
  highlightCodeToHtmlLines,
} from "@/lib/code-workbench.server";

type ProviderId = "fedex" | "ups" | "dhl" | "usps";

type WorkflowLineMap = {
  allSettled: number[];
  results: number[];
  returnGather: number[];
};

type StepLineMap = Record<ProviderId, number[]>;
type StepErrorLineMap = Record<ProviderId, number[]>;
type StepSuccessLineMap = Record<ProviderId, number[]>;

export type ScatterGatherCodeProps = {
  workflowCode: string;
  workflowLinesHtml: string[];
  stepCode: string;
  stepLinesHtml: string[];
  workflowLineMap: WorkflowLineMap;
  stepLineMap: StepLineMap;
  stepErrorLineMap: StepErrorLineMap;
  stepSuccessLineMap: StepSuccessLineMap;
};

function buildWorkflowLineMap(code: string): WorkflowLineMap {
  const lines = code.split("\n");
  return {
    allSettled: collectUntil(
      lines,
      "const settled = await Promise.allSettled(",
      (line) => line.trim() === ");",
    ),
    results: collectUntil(
      lines,
      "const results: ProviderResult[]",
      (line) => line.trim() === "});",
    ),
    returnGather: collectUntil(
      lines,
      "return gatherBestQuote(",
      (line) => line.includes("return gatherBestQuote("),
    ),
  };
}

function buildStepLineMap(code: string): StepLineMap {
  const lines = code.split("\n");
  return {
    fedex: collectFunctionBlock(lines, "async function fetchFedExQuote("),
    ups: collectFunctionBlock(lines, "async function fetchUpsQuote("),
    dhl: collectFunctionBlock(lines, "async function fetchDhlQuote("),
    usps: collectFunctionBlock(lines, "async function fetchUspsQuote("),
  };
}

function findErrorLine(lines: string[], marker: string): number[] {
  const index = lines.findIndex((line) => line.includes(marker));
  return index === -1 ? [] : [index + 1];
}

function buildStepErrorLineMap(code: string): StepErrorLineMap {
  const lines = code.split("\n");
  const errorLine = findErrorLine(lines, "throw new Error(error)");
  return {
    fedex: errorLine,
    ups: errorLine,
    dhl: errorLine,
    usps: errorLine,
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
  const successLine = findReturnLineInBlock(lines, "async function fetchProviderQuote(");
  return {
    fedex: successLine,
    ups: successLine,
    dhl: successLine,
    usps: successLine,
  };
}

export function getScatterGatherCodeProps(): ScatterGatherCodeProps {
  const workflowSource = readFileSync(
    join(process.cwd(), "scatter-gather/workflows/scatter-gather.ts"),
    "utf-8",
  );

  const workflowCode = extractFunctionBlock(
    workflowSource,
    "export async function scatterGather(",
  );

  const stepCode = [
    extractFunctionBlock(workflowSource, "async function fetchProviderQuote("),
    "",
    extractFunctionBlock(workflowSource, "async function fetchFedExQuote("),
    "",
    extractFunctionBlock(workflowSource, "async function fetchUpsQuote("),
    "",
    extractFunctionBlock(workflowSource, "async function fetchDhlQuote("),
    "",
    extractFunctionBlock(workflowSource, "async function fetchUspsQuote("),
    "",
    extractFunctionBlock(workflowSource, "async function gatherBestQuote("),
  ].join("\n");

  return {
    workflowCode,
    workflowLinesHtml: highlightCodeToHtmlLines(workflowCode),
    stepCode,
    stepLinesHtml: highlightCodeToHtmlLines(stepCode),
    workflowLineMap: buildWorkflowLineMap(workflowCode),
    stepLineMap: buildStepLineMap(stepCode),
    stepErrorLineMap: buildStepErrorLineMap(stepCode),
    stepSuccessLineMap: buildStepSuccessLineMap(stepCode),
  };
}
