// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  extractExportedWorkflowBlock,
  extractSecondaryFunctionBlocks,
  highlightCodeToHtmlLines,
} from "@/lib/code-workbench.server";

export function getProcessManagerCodeProps(): Record<string, unknown> {
  const source = readFileSync(join(process.cwd(), "process-manager/workflows/process-manager.ts"), "utf-8");
  const workflowCode = extractExportedWorkflowBlock(source);
  const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
  const workflowAllLines = workflowCode.split("\n").map((_: string, i: number) => i + 1);
  const extractedSecondary = extractSecondaryFunctionBlocks(source);
  const secondaryCode = extractedSecondary.length > 0 ? extractedSecondary : source;
  const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
  const secondaryAllLines = secondaryCode.split("\n").map((_: string, i: number) => i + 1);
  return {
    orchestratorCode: workflowCode,
    orchestratorHtmlLines: workflowHtmlLines,
    orchestratorLineMap: {
      "backorderBranch": workflowAllLines,
      "cancelOrder": workflowAllLines,
      "completeOrder": workflowAllLines,
      "paymentFailedBranch": workflowAllLines,
      "sleepBackorder": workflowAllLines,
    },
    stepCode: secondaryCode,
    stepHtmlLines: secondaryHtmlLines,
    stepLineMap: {
      "cancelOrder": secondaryAllLines,
      "checkInventory": secondaryAllLines,
      "completeOrder": secondaryAllLines,
      "confirmDelivery": secondaryAllLines,
      "initializeOrder": secondaryAllLines,
      "recheckInventory": secondaryAllLines,
      "reserveInventory": secondaryAllLines,
      "shipOrder": secondaryAllLines,
      "validatePayment": secondaryAllLines,
    },
  };
}
