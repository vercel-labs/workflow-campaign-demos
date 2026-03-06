import { highlightCodeToHtmlLines } from "@/components/code-highlight-server";
import { SchedulerAgentSupervisorDemo } from "./components/demo";

const directiveUseWorkflow = `"use ${"workflow"}"`;
const directiveUseStep = `"use ${"step"}"`;

const workflowCode = `import { sleep } from "workflow";

export async function schedulerAgentSupervisor(topic: string) {
  ${directiveUseWorkflow};

  const agents = ["fast-model", "thorough-model", "premium-model"] as const;

  for (const agentId of agents) {
    const draft = await dispatchToAgent(agentId, topic);
    const quality = await checkQuality(draft, 80);

    if (quality.passed) {
      return await publishContent(draft, quality.score);
    }

    await sleep("2s");
  }

  return { status: "failed" as const, reason: "all_agents_failed_quality" };
}`;

const stepCode = `async function dispatchToAgent(agentId: string, topic: string) {
  ${directiveUseStep};
  return {
    agentId,
    draft: \`Draft about \${topic} from \${agentId}\`,
  };
}

async function checkQuality(
  draft: { draft: string; agentId: string },
  requiredScore: number
) {
  ${directiveUseStep};
  const score = scoreDraft(draft.draft, draft.agentId);

  if (score >= requiredScore) {
    return { score, passed: true as const };
  }

  return { score, passed: false as const };
}

async function publishContent(
  draft: { draft: string; agentId: string },
  qualityScore: number
) {
  ${directiveUseStep};
  return {
    status: "published" as const,
    qualityScore,
    content: draft.draft,
  };
}`;

function findLines(code: string, includes: string): number[] {
  return code
    .split("\n")
    .map((line, idx) => (line.includes(includes) ? idx + 1 : null))
    .filter((line): line is number => line !== null);
}

const workflowLineMap = {
  dispatch: findLines(workflowCode, "await dispatchToAgent("),
  qualityCheck: findLines(workflowCode, "await checkQuality("),
  cooldown: findLines(workflowCode, "await sleep(\"2s\")"),
  publish: findLines(workflowCode, "await publishContent("),
  failed: findLines(workflowCode, 'status: "failed"'),
};

const stepLineMap = {
  dispatch: findLines(stepCode, "async function dispatchToAgent("),
  qualityCheck: findLines(stepCode, "async function checkQuality("),
  qualityPass: findLines(stepCode, "return { score, passed: true as const }"),
  qualityFail: findLines(stepCode, "return { score, passed: false as const }"),
  publish: findLines(stepCode, "async function publishContent("),
};

const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
const stepHtmlLines = highlightCodeToHtmlLines(stepCode);

export default function Home() {
  return (
    <div className="min-h-screen bg-background-100 p-8 text-gray-1000">
      <main id="main-content" className="mx-auto max-w-5xl" role="main">
        <header className="mb-10">
          <div className="mb-4 inline-flex items-center rounded-full border border-blue-700/40 bg-blue-700/20 px-3 py-1 text-sm font-medium text-blue-700">
            Workflow DevKit Example
          </div>
          <h1 className="mb-4 text-4xl font-semibold tracking-tight text-gray-1000">
            Scheduler-Agent-Supervisor
          </h1>
          <p className="max-w-3xl text-lg text-gray-900">
            Intelligent task rerouting with a quality gate. A supervisor assigns
            generation work to Fast, Thorough, and Premium agents in sequence,
            checks output quality after each attempt, then cools down and reroutes
            when quality fails.
          </p>
        </header>

        <section aria-labelledby="try-it-heading" className="mb-12">
          <h2 id="try-it-heading" className="mb-4 text-2xl font-semibold tracking-tight text-gray-1000">
            Try It
          </h2>
          <div className="rounded-lg border border-gray-400 bg-background-200 p-6">
            <SchedulerAgentSupervisorDemo
              workflowCode={workflowCode}
              workflowHtmlLines={workflowHtmlLines}
              workflowLineMap={workflowLineMap}
              stepCode={stepCode}
              stepHtmlLines={stepHtmlLines}
              stepLineMap={stepLineMap}
            />
          </div>
        </section>

        <footer className="border-t border-gray-400 py-6 text-center text-sm text-gray-900" role="contentinfo">
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
