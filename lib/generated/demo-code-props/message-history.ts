// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  collectFunctionBlock,
  extractFunctionBlock,
  findLineNumbers,
  highlightCodeToHtmlLines,
} from "@/lib/code-workbench.server";

type OrchestratorLineMap = {
  createEnvelope: number[];
  normalizeTicket: number[];
  classifySeverity: number[];
  chooseRoute: number[];
  dispatchTicket: number[];
  finalizeSuccess: number[];
  finalizeFailure: number[];
  tryCatch: number[];
};

type StepLineMap = {
  createEnvelope: number[];
  normalizeTicket: number[];
  classifySeverity: number[];
  chooseRoute: number[];
  dispatchTicket: number[];
  finalizeSuccess: number[];
  finalizeFailure: number[];
};

export type MessageHistoryCodeProps = {
  orchestratorCode: string;
  orchestratorHtmlLines: string[];
  orchestratorLineMap: OrchestratorLineMap;
  stepCode: string;
  stepHtmlLines: string[];
  stepLineMap: StepLineMap;
};

function readSource(relPath: string): string {
  return readFileSync(join(process.cwd(), relPath), "utf-8");
}

function buildOrchestratorLineMap(code: string): OrchestratorLineMap {
  return {
    createEnvelope: findLineNumbers(code, "await createEnvelope("),
    normalizeTicket: findLineNumbers(code, "await normalizeTicket("),
    classifySeverity: findLineNumbers(code, "await classifySeverity("),
    chooseRoute: findLineNumbers(code, "await chooseRoute("),
    dispatchTicket: findLineNumbers(code, "await dispatchTicket("),
    finalizeSuccess: findLineNumbers(code, "await finalizeSuccess("),
    finalizeFailure: findLineNumbers(code, "await finalizeFailure("),
    tryCatch: findLineNumbers(code, "} catch (err)"),
  };
}

function buildStepLineMap(code: string): StepLineMap {
  const lines = code.split("\n");
  return {
    createEnvelope: collectFunctionBlock(lines, "async function createEnvelope("),
    normalizeTicket: collectFunctionBlock(lines, "async function normalizeTicket("),
    classifySeverity: collectFunctionBlock(lines, "async function classifySeverity("),
    chooseRoute: collectFunctionBlock(lines, "async function chooseRoute("),
    dispatchTicket: collectFunctionBlock(lines, "async function dispatchTicket("),
    finalizeSuccess: collectFunctionBlock(lines, "async function finalizeSuccess("),
    finalizeFailure: collectFunctionBlock(lines, "async function finalizeFailure("),
  };
}

export function getMessageHistoryCodeProps(): MessageHistoryCodeProps {
  const workflowSource = readSource(
    "message-history/workflows/message-history.ts",
  );

  const orchestratorCode = extractFunctionBlock(
    workflowSource,
    "export async function messageHistory(",
  );

  const stepCode = [
    extractFunctionBlock(workflowSource, "async function createEnvelope("),
    "",
    extractFunctionBlock(workflowSource, "async function normalizeTicket("),
    "",
    extractFunctionBlock(workflowSource, "async function classifySeverity("),
    "",
    extractFunctionBlock(workflowSource, "async function chooseRoute("),
    "",
    extractFunctionBlock(workflowSource, "async function dispatchTicket("),
    "",
    extractFunctionBlock(workflowSource, "async function finalizeSuccess("),
    "",
    extractFunctionBlock(workflowSource, "async function finalizeFailure("),
  ].join("\n");

  return {
    orchestratorCode,
    orchestratorHtmlLines: highlightCodeToHtmlLines(orchestratorCode),
    orchestratorLineMap: buildOrchestratorLineMap(orchestratorCode),
    stepCode,
    stepHtmlLines: highlightCodeToHtmlLines(stepCode),
    stepLineMap: buildStepLineMap(stepCode),
  };
}
