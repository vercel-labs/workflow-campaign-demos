// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  extractExportedWorkflowBlock,
  extractSecondaryFunctionBlocks,
  highlightCodeToHtmlLines,
} from "@/lib/code-workbench.server";

export function getMessageFilterCodeProps(): Record<string, unknown> {
  const source = readFileSync(join(process.cwd(), "message-filter/workflows/order-filter.ts"), "utf-8");
  const workflowCode = extractExportedWorkflowBlock(source);
  const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
  const workflowAllLines = workflowCode.split("\n").map((_: string, i: number) => i + 1);
  const extractedSecondary = extractSecondaryFunctionBlocks(source);
  const secondaryCode = extractedSecondary.length > 0 ? extractedSecondary : source;
  const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
  const secondaryAllLines = secondaryCode.split("\n").map((_: string, i: number) => i + 1);
  return {
    workflowCode: workflowCode,
    workflowLinesHtml: workflowHtmlLines,
    stepCode: secondaryCode,
    stepLinesHtml: secondaryHtmlLines,
    workflowLineMap: {
      "amountCall": workflowAllLines,
      "emitCall": workflowAllLines,
      "fraudCall": workflowAllLines,
      "regionCall": workflowAllLines,
    },
    stepLineMap: {
      "amount": secondaryAllLines,
      "fraud": secondaryAllLines,
      "region": secondaryAllLines,
    },
  };
}
