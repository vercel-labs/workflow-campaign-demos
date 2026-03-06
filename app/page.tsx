import {
  findBlockLineNumbers,
  findLineNumbers,
  highlightCodeToHtmlLines,
} from "./components/code-highlight-server";
import {
  SagaDemo,
  type SagaOrchestratorLineMap,
  type SagaStepLineMap,
} from "./components/demo";

const wf = `"use ${"workflow"}"`;
const st = `"use ${"step"}"`;

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

const orchestratorLineMap: SagaOrchestratorLineMap = {
  reserveSeatsAwait: findLineNumbers(orchestratorCode, "await reserveSeats("),
  reserveSeatsPush: findLineNumbers(
    orchestratorCode,
    'compensations.push("releaseSeats")'
  ),
  captureInvoiceAwait: findLineNumbers(
    orchestratorCode,
    "await captureInvoice("
  ),
  captureInvoicePush: findLineNumbers(
    orchestratorCode,
    'compensations.push("refundInvoice")'
  ),
  provisionSeatsAwait: findLineNumbers(
    orchestratorCode,
    "await provisionSeats("
  ),
  sendConfirmationAwait: findLineNumbers(
    orchestratorCode,
    "await sendConfirmation("
  ),
  fatalErrorGuard: findLineNumbers(
    orchestratorCode,
    "if (!(error instanceof FatalError))"
  ),
  rollbackLoop: findBlockLineNumbers(
    orchestratorCode,
    "while (compensations.length > 0)"
  ),
  rollbackPop: findLineNumbers(orchestratorCode, "const action = compensations.pop()!"),
  rollbackRun: findLineNumbers(
    orchestratorCode,
    "await runCompensation(action, accountId)"
  ),
  returnCompleted: findLineNumbers(
    orchestratorCode,
    'return { status: "completed" as const };'
  ),
  returnRolledBack: findLineNumbers(
    orchestratorCode,
    'return { status: "rolled_back" as const };'
  ),
};

const stepLineMap: SagaStepLineMap = {
  shouldFailCheck: findLineNumbers(stepCode, "if (shouldFail)"),
  throwFatal: findLineNumbers(stepCode, "throw new FatalError("),
  returnProvisioned: findLineNumbers(
    stepCode,
    'return { accountId, seats, status: "provisioned" as const };'
  ),
};

export default function Home() {
  return (
    <div className="min-h-screen bg-background-100 p-8 text-gray-1000">
      <main id="main-content" className="mx-auto max-w-5xl" role="main">
        <header className="mb-16">
          <div className="mb-4 inline-flex items-center rounded-full border border-violet-700/40 bg-violet-700/20 px-3 py-1 text-sm font-medium text-violet-700">
            Workflow DevKit Example
          </div>
          <h1 className="mb-4 text-5xl font-semibold tracking-tight text-gray-1000">
            Saga Rollback
          </h1>
          <p className="max-w-3xl text-lg text-gray-900">
            Upgrade flow for SaaS seats: reserve capacity, capture invoice, then
            provision workspace. If provisioning throws a fatal error, the saga
            unwinds compensations in strict LIFO order: refund invoice, then
            release seats.
          </p>
        </header>

        <section aria-labelledby="try-it-heading" className="mb-16">
          <h2 id="try-it-heading" className="mb-4 text-2xl font-semibold tracking-tight">
            Try It
          </h2>
          <div className="rounded-lg border border-gray-400 bg-background-200 p-6">
            <SagaDemo
              orchestratorCode={orchestratorCode}
              orchestratorHtmlLines={orchestratorHtmlLines}
              orchestratorLineMap={orchestratorLineMap}
              stepCode={stepCode}
              stepHtmlLines={stepHtmlLines}
              stepLineMap={stepLineMap}
            />
          </div>
        </section>

        <footer
          className="border-t border-gray-400 py-6 text-center text-sm text-gray-900"
          role="contentinfo"
        >
          <a
            href="https://useworkflow.dev/"
            className="underline underline-offset-2 transition-colors hover:text-gray-1000 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-700/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background-100"
            target="_blank"
            rel="noopener noreferrer"
          >
            Workflow DevKit Docs
          </a>
        </footer>
      </main>
    </div>
  );
}
