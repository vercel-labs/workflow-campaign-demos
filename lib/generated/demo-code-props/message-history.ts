// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  extractExportedWorkflowBlock,
  extractSecondaryFunctionBlocks,
  highlightCodeToHtmlLines,
} from "@/lib/code-workbench.server";

export function getMessageHistoryCodeProps(): Record<string, unknown> {
  const source = readFileSync(join(process.cwd(), "message-history/workflows/message-history.ts"), "utf-8");
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
      "chooseRoute": workflowAllLines,
      "classifySeverity": workflowAllLines,
      "createEnvelope": workflowAllLines,
      "dispatchTicket": workflowAllLines,
      "finalizeFailure": workflowAllLines,
      "finalizeSuccess": workflowAllLines,
      "normalizeTicket": workflowAllLines,
    },
    stepCode: secondaryCode,
    stepHtmlLines: secondaryHtmlLines,
    stepLineMap: {
      "chooseRoute": secondaryAllLines,
      "classifySeverity": secondaryAllLines,
      "createEnvelope": secondaryAllLines,
      "dispatchTicket": secondaryAllLines,
      "finalizeFailure": secondaryAllLines,
      "finalizeSuccess": secondaryAllLines,
      "normalizeTicket": secondaryAllLines,
    },
  };
}
