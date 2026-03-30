// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { highlightCodeToHtmlLines } from "@/lib/code-workbench.server";

const directiveUseWorkflow = `"use ${"workflow"}"`;
const directiveUseStep = `"use ${"step"}"`;

const workflowCode = `export async function routingSlip(orderId: string, slip: SlipStage[]) {
  ${directiveUseWorkflow};

  const results: StageResult[] = [];

  for (const stage of slip) {
    const result = await processStage(orderId, stage);
    results.push(result);
  }

  return {
    status: "completed",
    orderId,
    stages: results,
  };
}`;

const stepCode = `async function processStage(orderId: string, stage: SlipStage): Promise<StageResult> {
  ${directiveUseStep};

  const delay = 500 + Math.floor(Math.random() * 700);
  await new Promise((resolve) => setTimeout(resolve, delay));

  const messages: Record<SlipStage, string> = {
    inventory: \`Verified stock for order \${orderId}\`,
    payment: \`Payment processed for order \${orderId}\`,
    packaging: \`Package prepared for order \${orderId}\`,
    shipping: \`Shipment dispatched for order \${orderId}\`,
    notification: \`Customer notified for order \${orderId}\`,
  };

  return {
    stage,
    status: "completed",
    message: messages[stage],
    durationMs: delay,
  };
}`;

type SlipStage = "inventory" | "payment" | "packaging" | "shipping" | "notification";

type RoutingSlipLineMap = {
  workflowLoopLine: number;
  workflowProcessLine: number;
  workflowReturnLine: number;
  stepDelayLine: number;
  stepReturnLine: number;
  stepMessageLines: Record<SlipStage, number>;
};

export type RoutingSlipCodeProps = {
  workflowCode: string;
  workflowLinesHtml: string[];
  stepCode: string;
  stepLinesHtml: string[];
  lineMap: RoutingSlipLineMap;
};

function getLine(lines: string[], pattern: string): number {
  const index = lines.findIndex((line) => line.includes(pattern));
  return index >= 0 ? index + 1 : 1;
}

function buildLineMap(workflow: string, step: string): RoutingSlipLineMap {
  const workflowLines = workflow.split("\n");
  const stepLines = step.split("\n");

  return {
    workflowLoopLine: getLine(workflowLines, "for (const stage of slip)"),
    workflowProcessLine: getLine(workflowLines, "await processStage(orderId, stage)"),
    workflowReturnLine: getLine(workflowLines, "return {"),
    stepDelayLine: getLine(stepLines, "await new Promise((resolve) => setTimeout(resolve, delay))"),
    stepReturnLine: getLine(stepLines, "return {"),
    stepMessageLines: {
      inventory: getLine(stepLines, "inventory:"),
      payment: getLine(stepLines, "payment:"),
      packaging: getLine(stepLines, "packaging:"),
      shipping: getLine(stepLines, "shipping:"),
      notification: getLine(stepLines, "notification:"),
    },
  };
}

export function getRoutingSlipCodeProps(): RoutingSlipCodeProps {
  const lineMap = buildLineMap(workflowCode, stepCode);

  return {
    workflowCode,
    workflowLinesHtml: highlightCodeToHtmlLines(workflowCode),
    stepCode,
    stepLinesHtml: highlightCodeToHtmlLines(stepCode),
    lineMap,
  };
}
