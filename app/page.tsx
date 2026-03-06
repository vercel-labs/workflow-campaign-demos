import { highlightCodeToHtmlLines } from "@/components/code-highlight-server";
import { ApprovalChainDemo } from "./components/demo";

const directiveUseWorkflow = `"use ${"workflow"}"`;
const directiveUseStep = `"use ${"step"}"`;

type ApprovalWorkflowLineMap = {
  loop: number[];
  notify: number[];
  race: number[];
  timeout: number[];
  approve: number[];
  reject: number[];
  expire: number[];
};

type ApprovalStepLineMap = {
  notify: number[];
  timeout: number[];
  approve: number[];
  reject: number[];
};

const workflowCode = `import { defineHook, sleep } from "workflow";

export async function approvalChain(expenseId: string, amount: number) {
  ${directiveUseWorkflow};

  const levels = getApprovalLevelsForAmount(amount);

  for (const level of levels) {
    await notifyLevel(expenseId, level.role);

    const levelHook = defineHook<ApprovalSignal>();
    const hook = levelHook.create({
      token: \`approval:\${expenseId}:\${level.role}\`,
    });

    const result = await Promise.race([
      hook.then((payload) => ({ type: "decision" as const, payload })),
      sleep(level.timeout).then(() => ({ type: "timeout" as const })),
    ]);

    if (result.type === "timeout") {
      await recordTimeout(expenseId, level.role);
      continue;
    }

    if (!result.payload.approved) {
      await rejectExpense(expenseId, level.role);
      return { status: "rejected" as const };
    }

    await approveExpense(expenseId, level.role);
    return { status: "approved" as const };
  }

  await expireExpense(expenseId);
  return { status: "timed_out" as const };
}`;

const stepCode = `async function notifyLevel(expenseId: string, role: ApprovalRole) {
  ${directiveUseStep};

  console.info("[approval-chain] notify_level", {
    expenseId,
    role,
    token: \`approval:\${expenseId}:\${role}\`,
  });
}

async function recordTimeout(expenseId: string, role: ApprovalRole) {
  ${directiveUseStep};

  console.info("[approval-chain] level_timeout", {
    expenseId,
    role,
  });
}

async function approveExpense(expenseId: string, role: ApprovalRole) {
  ${directiveUseStep};

  console.info("[approval-chain] expense_approved", {
    expenseId,
    role,
  });
}

async function rejectExpense(expenseId: string, role: ApprovalRole) {
  ${directiveUseStep};

  console.info("[approval-chain] expense_rejected", {
    expenseId,
    role,
  });
}`;

function findLines(code: string, includes: string): number[] {
  return code
    .split("\n")
    .map((line, idx) => (line.includes(includes) ? idx + 1 : null))
    .filter((line): line is number => line !== null);
}

function buildWorkflowLineMap(code: string): ApprovalWorkflowLineMap {
  return {
    loop: findLines(code, "for (const level of levels)"),
    notify: findLines(code, "await notifyLevel("),
    race: findLines(code, "const result = await Promise.race"),
    timeout: findLines(code, 'if (result.type === "timeout")'),
    approve: findLines(code, "await approveExpense("),
    reject: findLines(code, "await rejectExpense("),
    expire: findLines(code, "await expireExpense("),
  };
}

function buildStepLineMap(code: string): ApprovalStepLineMap {
  return {
    notify: findLines(code, 'console.info("[approval-chain] notify_level"'),
    timeout: findLines(code, 'console.info("[approval-chain] level_timeout"'),
    approve: findLines(code, 'console.info("[approval-chain] expense_approved"'),
    reject: findLines(code, 'console.info("[approval-chain] expense_rejected"'),
  };
}

const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
const stepHtmlLines = highlightCodeToHtmlLines(stepCode);
const workflowLineMap = buildWorkflowLineMap(workflowCode);
const stepLineMap = buildStepLineMap(stepCode);

export default function Home() {
  return (
    <div className="min-h-screen bg-background-100 p-8 text-gray-1000">
      <main id="main-content" className="mx-auto max-w-5xl" role="main">
        <header className="mb-12">
          <div className="mb-4 inline-flex items-center rounded-full border border-blue-700/40 bg-blue-700/20 px-3 py-1 text-sm font-medium text-blue-700">
            Workflow DevKit Example
          </div>
          <h1 className="mb-4 text-4xl font-semibold tracking-tight text-gray-1000">
            Approval Chain
          </h1>
          <p className="max-w-3xl text-lg text-gray-900">
            Route high-value expenses through multi-level approvals with deterministic hook tokens. This
            workflow runs <code className="rounded border border-gray-300 bg-background-200 px-1.5 py-0.5 font-mono text-sm">defineHook()</code> inside a
            <code className="mx-1 rounded border border-gray-300 bg-background-200 px-1.5 py-0.5 font-mono text-sm">for</code>
            loop and races each level&apos;s decision against a per-level timeout using
            <code className="mx-1 rounded border border-gray-300 bg-background-200 px-1.5 py-0.5 font-mono text-sm">Promise.race()</code>.
          </p>
        </header>

        <section aria-labelledby="try-it-heading" className="mb-12">
          <h2 id="try-it-heading" className="mb-4 text-2xl font-semibold tracking-tight">
            Try It
          </h2>
          <div className="rounded-lg border border-gray-400 bg-background-200 p-6">
            <ApprovalChainDemo
              workflowCode={workflowCode}
              workflowHtmlLines={workflowHtmlLines}
              workflowLineMap={workflowLineMap}
              stepCode={stepCode}
              stepHtmlLines={stepHtmlLines}
              stepLineMap={stepLineMap}
            />
          </div>
        </section>

        <footer className="border-t border-gray-400 py-6 text-center text-sm text-gray-400" role="contentinfo">
          <a
            href="https://useworkflow.dev/"
            className="underline underline-offset-2 transition-colors hover:text-gray-1000"
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
