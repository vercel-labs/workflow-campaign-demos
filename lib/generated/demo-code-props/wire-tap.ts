// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  extractFunctionBlock,
  highlightCodeToHtmlLines,
} from "@/lib/code-workbench.server";

type WireTapLineMap = {
  workflowPipelineLine: number;
  workflowDoneLine: number;
  stepStageStartLine: number;
  stepTapLine: number;
  stepStageDoneLine: number;
};

export type WireTapCodeProps = {
  workflowCode: string;
  workflowLinesHtml: string[];
  stepCode: string;
  stepLinesHtml: string[];
  lineMap: WireTapLineMap;
};

function findLine(code: string, match: string): number {
  const lines = code.split("\n");
  const index = lines.findIndex((line) => line.includes(match));
  return index === -1 ? -1 : index + 1;
}

export function getWireTapCodeProps(): WireTapCodeProps {
  const workflowSource = readFileSync(
    join(process.cwd(), "wire-tap/workflows/wire-tap.ts"),
    "utf-8",
  );

  const workflowCode = extractFunctionBlock(
    workflowSource,
    "export async function wireTap(",
  );

  const stepCode = [
    extractFunctionBlock(workflowSource, "async function validateOrder("),
    "",
    extractFunctionBlock(workflowSource, "async function enrichOrder("),
    "",
    extractFunctionBlock(workflowSource, "async function transformOrder("),
    "",
    extractFunctionBlock(workflowSource, "async function deliverOrder("),
    "",
    extractFunctionBlock(workflowSource, "async function emitDone("),
  ].join("\n");

  const lineMap: WireTapLineMap = {
    workflowPipelineLine: findLine(workflowCode, "message = await"),
    workflowDoneLine: findLine(workflowCode, "await emitDone("),
    stepStageStartLine: findLine(stepCode, 'type: "stage_start"'),
    stepTapLine: findLine(stepCode, 'type: "tap_captured"'),
    stepStageDoneLine: findLine(stepCode, 'type: "stage_done"'),
  };

  return {
    workflowCode,
    workflowLinesHtml: highlightCodeToHtmlLines(workflowCode),
    stepCode,
    stepLinesHtml: highlightCodeToHtmlLines(stepCode),
    lineMap,
  };
}
