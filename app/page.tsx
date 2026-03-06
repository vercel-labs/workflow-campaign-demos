import { ContentEnricherDemo } from "./components/demo";
import { highlightCodeToHtmlLines } from "@/components/code-highlight-server";

const directiveUseWorkflow = `"use ${"workflow"}"`;
const directiveUseStep = `"use ${"step"}"`;

const workflowCode = `import { sleep } from "workflow";

export async function enrichLeadProfile(email: string) {
  ${directiveUseWorkflow};

  const baseLead = await lookupBaseContact(email);

  const [crm, social, clearbit, github] = await Promise.allSettled([
    fetchCrmEnrichment(baseLead),
    fetchSocialEnrichment(baseLead),
    fetchClearbitEnrichment(baseLead),
    fetchGitHubEnrichment(baseLead),
  ]);

  return await mergeEnrichmentProfile(baseLead, {
    crm: crm.status === "fulfilled" ? crm.value : null,
    social: social.status === "fulfilled" ? social.value : null,
    clearbit: clearbit.status === "fulfilled" ? clearbit.value : null,
    github: github.status === "fulfilled" ? github.value : null,
  });
}`;

const stepCode = `async function lookupBaseContact(email: string) {
  ${directiveUseStep};
  await sleep("500ms");
  return { email, name: "Alex Rivera", domain: "acme.io" };
}

async function fetchCrmEnrichment(baseLead: { email: string }) {
  ${directiveUseStep};
  await sleep("700ms");
  return { company: "Acme", title: "Head of Product", segment: "mid-market" as const };
}

async function fetchSocialEnrichment(baseLead: { email: string }) {
  ${directiveUseStep};
  await sleep("640ms");
  return { followers: 1830, location: "San Francisco, CA", profileUrl: "https://linkedin.com/in/alex-rivera" };
}

async function fetchClearbitEnrichment(baseLead: { email: string }) {
  ${directiveUseStep};
  await sleep("810ms");
  return { company: "Acme", employees: 240, score: 78 };
}

async function fetchGitHubEnrichment(baseLead: { email: string }) {
  ${directiveUseStep};
  await sleep("760ms");
  return { username: "alexrivera", publicRepos: 23, stars: 412 };
}

async function mergeEnrichmentProfile(
  baseLead: { email: string; name: string; domain: string },
  sources: {
    crm: { company: string; title: string; segment: string } | null;
    social: { followers: number; location: string } | null;
    clearbit: { score: number } | null;
    github: { username: string; stars: number } | null;
  }
) {
  ${directiveUseStep};

  return {
    email: baseLead.email,
    name: baseLead.name,
    domain: baseLead.domain,
    company: sources.crm?.company ?? null,
    title: sources.crm?.title ?? null,
    followers: sources.social?.followers ?? null,
    location: sources.social?.location ?? null,
    githubUsername: sources.github?.username ?? null,
    githubStars: sources.github?.stars ?? null,
    clearbitScore: sources.clearbit?.score ?? null,
    segment: sources.crm?.segment ?? null,
  };
}`;

type WorkflowLineMap = {
  baseLookup: number[];
  fanOut: number[];
  merge: number[];
};

type StepLineMap = {
  fetchSteps: {
    crm: number[];
    social: number[];
    clearbit: number[];
    github: number[];
  };
  merge: number[];
};

function findLines(code: string, pattern: string): number[] {
  return code
    .split("\n")
    .map((line, index) => (line.includes(pattern) ? index + 1 : null))
    .filter((value): value is number => value !== null);
}

function buildWorkflowLineMap(code: string): WorkflowLineMap {
  return {
    baseLookup: findLines(code, "await lookupBaseContact("),
    fanOut: [
      ...findLines(code, "fetchCrmEnrichment("),
      ...findLines(code, "fetchSocialEnrichment("),
      ...findLines(code, "fetchClearbitEnrichment("),
      ...findLines(code, "fetchGitHubEnrichment("),
    ],
    merge: findLines(code, "await mergeEnrichmentProfile("),
  };
}

function buildStepLineMap(code: string): StepLineMap {
  return {
    fetchSteps: {
      crm: findLines(code, "async function fetchCrmEnrichment"),
      social: findLines(code, "async function fetchSocialEnrichment"),
      clearbit: findLines(code, "async function fetchClearbitEnrichment"),
      github: findLines(code, "async function fetchGitHubEnrichment"),
    },
    merge: findLines(code, "async function mergeEnrichmentProfile"),
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
        <header className="mb-8">
          <div className="mb-4 inline-flex items-center rounded-full border border-green-700/40 bg-green-700/20 px-3 py-1 text-sm font-medium text-green-700">
            Workflow DevKit Example
          </div>
          <h1 className="mb-4 text-4xl font-semibold tracking-tight text-gray-1000">Content Enricher</h1>
          <p className="max-w-3xl text-lg text-gray-900">
            Enrich a lead by fanning out four external lookups in parallel with{" "}
            <code className="rounded border border-gray-400 bg-background-200 px-1.5 py-0.5 font-mono text-sm text-gray-1000">
              Promise.allSettled()
            </code>
            . Each API can fail independently, and the merge step degrades gracefully by filling missing fields with{" "}
            <code className="rounded border border-gray-400 bg-background-200 px-1.5 py-0.5 font-mono text-sm text-gray-1000">
              null
            </code>
            .
          </p>
        </header>

        <section aria-labelledby="try-it-heading" className="mb-8">
          <h2 id="try-it-heading" className="mb-4 text-2xl font-semibold tracking-tight text-gray-1000">
            Try It
          </h2>
          <div className="rounded-lg border border-gray-400 bg-background-200 p-4">
            <ContentEnricherDemo
              workflowCode={workflowCode}
              workflowHtmlLines={workflowHtmlLines}
              workflowLineMap={workflowLineMap}
              stepCode={stepCode}
              stepHtmlLines={stepHtmlLines}
              stepLineMap={stepLineMap}
            />
          </div>
        </section>

        <footer className="border-t border-gray-400 py-6 text-sm text-gray-900">
          <a
            href="https://useworkflow.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-colors hover:text-gray-1000"
          >
            Workflow DevKit Docs
          </a>
        </footer>
      </main>
    </div>
  );
}
