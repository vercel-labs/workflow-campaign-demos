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

export function getApprovalChainCodeProps(): Record<string, unknown> {
  const source = readFileSync(join(process.cwd(), "approval-chain/workflows/approval-chain.ts"), "utf-8");
  const workflowCode = extractExportedWorkflowBlock(source);
  const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
  const workflowFallbackLines = workflowCode.split("\n").map((_: string, i: number) => i + 1);
  const extractedSecondary = extractSecondaryFunctionBlocks(source);
  const secondaryCode = extractedSecondary.length > 0 ? extractedSecondary : source;
  const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);
  const secondaryFallbackLines = secondaryCode.split("\n").map((_: string, i: number) => i + 1);
  return {
    workflowCode: workflowCode,
    workflowHtmlLines: workflowHtmlLines,
    workflowLineMap: {
      "approve": findBestGeneratedRange(workflowCode, "approve", workflowFallbackLines),
      "expire": findBestGeneratedRange(workflowCode, "expire", workflowFallbackLines),
      "loop": findBestGeneratedRange(workflowCode, "loop", workflowFallbackLines),
      "notify": findBestGeneratedRange(workflowCode, "notify", workflowFallbackLines),
      "race": findBestGeneratedRange(workflowCode, "race", workflowFallbackLines),
      "reject": findBestGeneratedRange(workflowCode, "reject", workflowFallbackLines),
      "timeout": findBestGeneratedRange(workflowCode, "timeout", workflowFallbackLines),
    },
    stepCode: secondaryCode,
    stepHtmlLines: secondaryHtmlLines,
    stepLineMap: {
      "approve": findBestGeneratedRange(secondaryCode, "approve", secondaryFallbackLines),
      "notify": findBestGeneratedRange(secondaryCode, "notify", secondaryFallbackLines),
      "reject": findBestGeneratedRange(secondaryCode, "reject", secondaryFallbackLines),
      "timeout": findBestGeneratedRange(secondaryCode, "timeout", secondaryFallbackLines),
    },
  };
}
