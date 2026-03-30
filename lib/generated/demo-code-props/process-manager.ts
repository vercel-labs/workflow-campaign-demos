// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  extractExportedWorkflowBlock,
  extractSecondaryFunctionBlocks,
  highlightCodeToHtmlLines,
  findBlockLineNumbers,
  findLineNumbers,
} from "@/lib/code-workbench.server";

function findBestGeneratedRange(code: string, key: string, fallback: number[]): number[] {
  const blockMarkers = [
    `async function ${key}(`,
    `function ${key}(`,
    `const ${key} = async (`,
    `const ${key} = (`,
  ];
  for (const marker of blockMarkers) {
    const lines = findBlockLineNumbers(code, marker);
    if (lines.length > 0) return lines;
  }
  const callLines = findLineNumbers(code, `${key}(`);
  if (callLines.length > 0) return callLines;
  const identifierLines = findLineNumbers(code, key);
  if (identifierLines.length > 0) return identifierLines;
  return fallback;
}

export function getProcessManagerCodeProps(): Record<string, unknown> {
  const source = readFileSync(join(process.cwd(), "process-manager/workflows/process-manager.ts"), "utf-8");
  const workflowCode = extractExportedWorkflowBlock(source);
  const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
  const workflowFallbackLines = workflowCode.split("\n").map((_: string, i: number) => i + 1);
  const extractedSecondary = extractSecondaryFunctionBlocks(source);
  const secondaryCode = extractedSecondary.length > 0 ? extractedSecondary : source;
  const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
  const secondaryFallbackLines = secondaryCode.split("\n").map((_: string, i: number) => i + 1);
  return {
    orchestratorCode: workflowCode,
    orchestratorHtmlLines: workflowHtmlLines,
    orchestratorLineMap: {
      "backorderBranch": findBestGeneratedRange(workflowCode, "backorderBranch", workflowFallbackLines),
      "cancelOrder": findBestGeneratedRange(workflowCode, "cancelOrder", workflowFallbackLines),
      "completeOrder": findBestGeneratedRange(workflowCode, "completeOrder", workflowFallbackLines),
      "paymentFailedBranch": findBestGeneratedRange(workflowCode, "paymentFailedBranch", workflowFallbackLines),
      "sleepBackorder": findBestGeneratedRange(workflowCode, "sleepBackorder", workflowFallbackLines),
    },
    stepCode: secondaryCode,
    stepHtmlLines: secondaryHtmlLines,
    stepLineMap: {
      "cancelOrder": findBestGeneratedRange(secondaryCode, "cancelOrder", secondaryFallbackLines),
      "checkInventory": findBestGeneratedRange(secondaryCode, "checkInventory", secondaryFallbackLines),
      "completeOrder": findBestGeneratedRange(secondaryCode, "completeOrder", secondaryFallbackLines),
      "confirmDelivery": findBestGeneratedRange(secondaryCode, "confirmDelivery", secondaryFallbackLines),
      "initializeOrder": findBestGeneratedRange(secondaryCode, "initializeOrder", secondaryFallbackLines),
      "recheckInventory": findBestGeneratedRange(secondaryCode, "recheckInventory", secondaryFallbackLines),
      "reserveInventory": findBestGeneratedRange(secondaryCode, "reserveInventory", secondaryFallbackLines),
      "shipOrder": findBestGeneratedRange(secondaryCode, "shipOrder", secondaryFallbackLines),
      "validatePayment": findBestGeneratedRange(secondaryCode, "validatePayment", secondaryFallbackLines),
    },
  };
}
