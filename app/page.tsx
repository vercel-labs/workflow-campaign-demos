import { readFileSync } from "node:fs";
import { join } from "node:path";
import { highlightCodeToHtmlLines } from "./components/code-highlight-server";
import { RetryBackoffDemo } from "./components/demo";

type RetryWorkflowLineMap = {
  attempt: number[];
  sleep: number[];
  successReturn: number[];
  failureReturn: number[];
};

type RetryStepLineMap = {
  attempt: number[];
  successReturn: number[];
};

// Read the actual workflow source file — displayed in the code workbench
const workflowSource = readFileSync(
  join(process.cwd(), "workflows/retry-backoff.ts"),
  "utf-8"
);

function extractFunctionBlock(source: string, marker: string): string {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line.includes(marker));
  if (start === -1) return "";
  const output: string[] = [];
  let depth = 0;
  let sawBrace = false;
  for (let i = start; i < lines.length; i++) {
    output.push(lines[i]);
    const opens = (lines[i].match(/{/g) ?? []).length;
    const closes = (lines[i].match(/}/g) ?? []).length;
    depth += opens - closes;
    if (opens > 0) sawBrace = true;
    if (sawBrace && depth === 0) break;
  }
  return output.join("\n");
}

const workflowCode = extractFunctionBlock(
  workflowSource,
  "export async function retryBackoffContactSync("
);

const stepCode = extractFunctionBlock(
  workflowSource,
  "async function syncContactToCrm("
);

function buildWorkflowLineMap(code: string): RetryWorkflowLineMap {
  const lines = code.split("\n");

  const attempt = lines
    .map((line, index) =>
      line.includes("await syncContactToCrm(") ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  const sleep = lines
    .map((line, index) => (line.includes("await sleep(") ? index + 1 : null))
    .filter((line): line is number => line !== null);

  const successReturn = lines
    .map((line, index) =>
      line.includes('status: "completed"') ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  const failureReturn = lines
    .map((line, index) =>
      line.includes('status: "failed"') && line.includes("attempts: attempt")
        ? index + 1
        : null
    )
    .filter((line): line is number => line !== null);

  return { attempt, sleep, successReturn, failureReturn };
}

function buildStepLineMap(code: string): RetryStepLineMap {
  const lines = code.split("\n");

  const attempt = lines
    .map((line, index) =>
      line.includes("await delay(") ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  const successReturn = lines
    .map((line, index) =>
      line.includes('"attempt_success"') ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  return { attempt, successReturn };
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
          <div className="mb-4 inline-flex items-center rounded-full border border-cyan-700/40 bg-cyan-700/20 px-3 py-1 text-sm font-medium text-cyan-700">
            Workflow DevKit Example
          </div>
          <h1 className="mb-4 text-4xl font-semibold tracking-tight text-gray-1000">
            Retry with Backoff
          </h1>
          <p className="max-w-3xl text-lg text-gray-900">
            Syncing a CRM contact against a flaky API should not require cron jobs
            or background workers. This workflow retries with exponential backoff
            and durable{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">
              sleep()
            </code>{" "}
            between attempts, which means zero compute while waiting.
          </p>
        </header>

        <section aria-labelledby="try-it-heading" className="mb-12">
          <h2
            id="try-it-heading"
            className="mb-4 text-2xl font-semibold tracking-tight"
          >
            Try It
          </h2>
          <div className="rounded-lg border border-gray-400 bg-background-200 p-6">
            <RetryBackoffDemo
              workflowCode={workflowCode}
              workflowHtmlLines={workflowHtmlLines}
              workflowLineMap={workflowLineMap}
              stepCode={stepCode}
              stepHtmlLines={stepHtmlLines}
              stepLineMap={stepLineMap}
            />
          </div>
        </section>

        {/* ── Why this matters ────────────────────────────────────── */}
        <section aria-labelledby="contrast-heading" className="mb-16">
          <h2
            id="contrast-heading"
            className="text-2xl font-semibold mb-4 tracking-tight"
          >
            Why Not Just Use a Cron Job?
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-400 bg-background-200 p-6">
              <div className="text-sm font-semibold text-red-700 uppercase tracking-widest mb-3">
                Traditional
              </div>
              <p className="text-base text-gray-900 leading-relaxed">
                You build a retry queue with a <strong className="text-gray-1000">database table</strong>,
                a cron job or background worker, and manual bookkeeping for attempt
                counts, backoff timers, and max-retry thresholds. Failed jobs sit in
                a table until the next sweep. The {"\u201C"}retry logic{"\u201D"} is
                scattered across the scheduler, the handler, and the DB schema.
              </p>
            </div>
            <div className="rounded-lg border border-green-700/40 bg-green-700/5 p-6">
              <div className="text-sm font-semibold text-green-700 uppercase tracking-widest mb-3">
                Workflow Retry
              </div>
              <p className="text-base text-gray-900 leading-relaxed">
                A <code className="text-green-700 font-mono text-sm">for</code> loop
                with <code className="text-green-700 font-mono text-sm">try/catch</code>{" "}
                <strong className="text-gray-1000">is</strong> the retry logic. Each{" "}
                <code className="text-green-700 font-mono text-sm">sleep()</code> is a
                durable pause at zero compute{"\u2014"}no polling, no timers, no database
                rows. The attempt counter and backoff math are plain local variables
                that survive across restarts.
              </p>
              <p className="text-sm text-gray-900 mt-3 leading-relaxed">
                In production, add circuit-breaker logic or alert on max-retries
                exhausted to avoid silent failures.
              </p>
            </div>
          </div>
        </section>

        <footer
          className="border-t border-gray-400 py-6 text-center text-sm text-gray-900"
          role="contentinfo"
        >
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
