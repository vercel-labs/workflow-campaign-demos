// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { highlightCodeToHtmlLines } from "@/lib/code-workbench.server";

const directiveUseWorkflow = `"use ${"workflow"}"`;
const directiveUseStep = `"use ${"step"}"`;

type CircuitWorkflowLineMap = {
  callService: number[];
  sleep: number[];
  successReturn: number[];
  failureReturn: number[];
  circuitOpen: number[];
  circuitClosed: number[];
};

type CircuitStepLineMap = {
  callService: number[];
  successReturn: number[];
};

export type CircuitBreakerCodeProps = {
  workflowCode: string;
  workflowHtmlLines: string[];
  workflowLineMap: CircuitWorkflowLineMap;
  stepCode: string;
  stepHtmlLines: string[];
  stepLineMap: CircuitStepLineMap;
};

function buildWorkflowLineMap(code: string): CircuitWorkflowLineMap {
  const lines = code.split("\n");

  const findLines = (predicate: (line: string) => boolean): number[] =>
    lines
      .map((line, index) => (predicate(line) ? index + 1 : null))
      .filter((line): line is number => line !== null);

  return {
    callService: findLines((line) =>
      line.includes("await callPaymentService("),
    ),
    sleep: findLines((line) => line.includes("await sleep(")),
    successReturn: findLines((line) => line.includes('"recovered"')),
    failureReturn: findLines(
      (line) => line.includes('"failed"') && line.includes("status:"),
    ),
    circuitOpen: findLines(
      (line) => line.includes('"open"') && line.includes("state ="),
    ),
    circuitClosed: findLines(
      (line) => line.includes('"closed"') && line.includes("state ="),
    ),
  };
}

function buildStepLineMap(code: string): CircuitStepLineMap {
  const lines = code.split("\n");

  const findLines = (predicate: (line: string) => boolean): number[] =>
    lines
      .map((line, index) => (predicate(line) ? index + 1 : null))
      .filter((line): line is number => line !== null);

  return {
    callService: findLines((line) =>
      line.includes("const response = await fetch("),
    ),
    successReturn: findLines((line) => line.includes("return true;")),
  };
}

export function getCircuitBreakerCodeProps(): CircuitBreakerCodeProps {
  const workflowCode = `import { sleep } from "workflow";

export async function circuitBreakerFlow(serviceId: string) {
  ${directiveUseWorkflow};

  let state: CircuitState = "closed";
  let consecutiveFailures = 0;
  const failureThreshold = 3;

  for (let i = 1; i <= maxRequests; i++) {
    if (state === "open") {
      await sleep(\`\${"$\{cooldownMs}"}ms\`);
      state = "half-open";
    }

    const success = await callPaymentService(serviceId, i, state);

    if (success) {
      consecutiveFailures = 0;
      if (state === "half-open") {
        state = "closed";
      }
    } else {
      consecutiveFailures++;
      if (consecutiveFailures >= failureThreshold) {
        state = "open";
        consecutiveFailures = 0;
      }
    }
  }

  return { serviceId, status: state === "closed" ? "recovered" : "failed" };
}`;

  const stepCode = `async function callPaymentService(
  serviceId: string,
  requestNum: number,
  circuitState: CircuitState
): Promise<boolean> {
  ${directiveUseStep};

  const response = await fetch(\`https://payments.example.com/charge\`, {
    method: "POST",
    headers: { "x-circuit-state": circuitState },
    body: JSON.stringify({ serviceId, requestNum }),
  });

  if (!response.ok) {
    throw new Error(\`Payment service returned \${response.status}\`);
  }

  return true;
}`;

  const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
  const stepHtmlLines = highlightCodeToHtmlLines(stepCode);

  return {
    workflowCode,
    workflowHtmlLines,
    workflowLineMap: buildWorkflowLineMap(workflowCode),
    stepCode,
    stepHtmlLines,
    stepLineMap: buildStepLineMap(stepCode),
  };
}
