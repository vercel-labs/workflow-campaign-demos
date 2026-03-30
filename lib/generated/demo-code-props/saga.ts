// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import {
  findBlockLineNumbers,
  findLineNumbers,
  highlightCodeToHtmlLines,
} from "@/lib/code-workbench.server";

const wf = `"use ${"workflow"}"`;
const st = `"use ${"step"}"`;

type SagaOrchestratorLineMap = {
  reserveSeatsAwait: number[];
  reserveSeatsPush: number[];
  captureInvoiceAwait: number[];
  captureInvoicePush: number[];
  provisionSeatsAwait: number[];
  sendConfirmationAwait: number[];
  fatalErrorGuard: number[];
  rollbackLoop: number[];
  rollbackPop: number[];
  rollbackRun: number[];
  returnCompleted: number[];
  returnRolledBack: number[];
};

type SagaStepLineMap = {
  shouldFailCheck: number[];
  throwFatal: number[];
  returnProvisioned: number[];
};

export type SagaCodeProps = {
  orchestratorCode: string;
  orchestratorHtmlLines: string[];
  orchestratorLineMap: SagaOrchestratorLineMap;
  stepCode: string;
  stepHtmlLines: string[];
  stepLineMap: SagaStepLineMap;
};

function buildOrchestratorLineMap(code: string): SagaOrchestratorLineMap {
  return {
    reserveSeatsAwait: findLineNumbers(code, "await reserveSeats("),
    reserveSeatsPush: findLineNumbers(
      code,
      'compensations.push("releaseSeats")',
    ),
    captureInvoiceAwait: findLineNumbers(code, "await captureInvoice("),
    captureInvoicePush: findLineNumbers(
      code,
      'compensations.push("refundInvoice")',
    ),
    provisionSeatsAwait: findLineNumbers(code, "await provisionSeats("),
    sendConfirmationAwait: findLineNumbers(code, "await sendConfirmation("),
    fatalErrorGuard: findLineNumbers(
      code,
      "if (!(error instanceof FatalError))",
    ),
    rollbackLoop: findBlockLineNumbers(
      code,
      "while (compensations.length > 0)",
    ),
    rollbackPop: findLineNumbers(code, "const action = compensations.pop()!"),
    rollbackRun: findLineNumbers(
      code,
      "await runCompensation(action, accountId)",
    ),
    returnCompleted: findLineNumbers(
      code,
      'return { status: "completed" as const };',
    ),
    returnRolledBack: findLineNumbers(
      code,
      'return { status: "rolled_back" as const };',
    ),
  };
}

function buildStepLineMap(code: string): SagaStepLineMap {
  return {
    shouldFailCheck: findLineNumbers(code, "if (shouldFail)"),
    throwFatal: findLineNumbers(code, "throw new FatalError("),
    returnProvisioned: findLineNumbers(
      code,
      'return { accountId, seats, status: "provisioned" as const };',
    ),
  };
}

export function getSagaCodeProps(): SagaCodeProps {
  const orchestratorCode = `import { FatalError } from "workflow";

type CompensationAction = "releaseSeats" | "refundInvoice";

export async function upgradeSeatsSaga(
  accountId: string,
  seats: number,
  failAtStep: 1 | 2 | 3 | null
) {
  ${wf};

  const compensations: CompensationAction[] = [];

  try {
    await reserveSeats(accountId, seats, failAtStep === 1);
    compensations.push("releaseSeats");

    await captureInvoice(accountId, seats, failAtStep === 2);
    compensations.push("refundInvoice");

    await provisionSeats(accountId, seats, failAtStep === 3);

    await sendConfirmation(accountId, seats);
    return { status: "completed" as const };
  } catch (error) {
    if (!(error instanceof FatalError)) throw error;

    while (compensations.length > 0) {
      const action = compensations.pop()!;
      await runCompensation(action, accountId);
    }

    return { status: "rolled_back" as const };
  }
}`;

  const stepCode = `import { FatalError } from "workflow";

async function provisionSeats(
  accountId: string,
  seats: number,
  shouldFail: boolean
) {
  ${st};

  if (shouldFail) {
    throw new FatalError(
      \`provisionSeats failed for \${accountId} (\${seats} seats)\`
    );
  }

  return { accountId, seats, status: "provisioned" as const };
}`;

  const orchestratorHtmlLines = highlightCodeToHtmlLines(orchestratorCode);
  const stepHtmlLines = highlightCodeToHtmlLines(stepCode);

  return {
    orchestratorCode,
    orchestratorHtmlLines,
    orchestratorLineMap: buildOrchestratorLineMap(orchestratorCode),
    stepCode,
    stepHtmlLines,
    stepLineMap: buildStepLineMap(stepCode),
  };
}
