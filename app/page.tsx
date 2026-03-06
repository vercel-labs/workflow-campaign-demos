import { highlightCodeToHtmlLines } from "./components/code-highlight-server";
import { StatusPollerDemo } from "./components/demo";

const directiveUseWorkflow = `"use ${"workflow"}"`;
const directiveUseStep = `"use ${"step"}"`;

const workflowCode = `import { sleep } from "workflow";

export async function pollTranscodeStatus(jobId: string) {
  ${directiveUseWorkflow};

  const maxPolls = 8;
  const intervalMs = 2000;

  for (let poll = 1; poll <= maxPolls; poll++) {
    const state = await checkTranscodeJob(jobId, poll);

    if (state === "ready") {
      return { jobId, status: "completed", pollCount: poll };
    }

    if (poll < maxPolls) {
      await sleep(\`${"${intervalMs}"}ms\`);
    }
  }

  return { jobId, status: "timeout", pollCount: maxPolls };
}`;

const stepCode = `async function checkTranscodeJob(jobId: string, poll: number) {
  ${directiveUseStep};

  const response = await fetch(\`https://transcode.example.com/jobs/\${jobId}\`, {
    method: "GET",
    headers: { "x-poll": String(poll) },
  });

  if (!response.ok) {
    throw new Error(\`Transcode API error on poll \${poll}\`);
  }

  const result = await response.json();
  return result.state;
}`;

function buildWorkflowLineMap(code: string) {
  const lines = code.split("\n");

  const poll = lines
    .map((line, index) =>
      line.includes("await checkTranscodeJob(") ? index + 1 : null
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

  const timeoutReturn = lines
    .map((line, index) =>
      line.includes('status: "timeout"') ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  return {
    poll,
    sleep,
    successReturn,
    timeoutReturn,
  };
}

function buildStepLineMap(code: string) {
  const lines = code.split("\n");

  const poll = lines
    .map((line, index) =>
      line.includes("const response = await fetch(") ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  const successReturn = lines
    .map((line, index) => (line.includes("return result.state;") ? index + 1 : null))
    .filter((line): line is number => line !== null);

  return { poll, successReturn };
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
            Status Poller
          </h1>
          <p className="max-w-3xl text-lg text-gray-900">
            Polling an external service until it is ready should not require cron
            jobs, database tables, or cleanup logic. This workflow polls a
            transcoding service with durable{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">
              sleep()
            </code>{" "}
            between checks, which means zero compute while waiting.
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
            <StatusPollerDemo
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
                You build a polling table with a <strong className="text-gray-1000">database</strong>,
                a cron job or background worker, and manual bookkeeping for poll
                counts, interval timers, and timeout thresholds. Stale polls sit in
                a table until the next sweep. The {"\u201C"}polling logic{"\u201D"} is
                scattered across the scheduler, the handler, and the DB schema.
              </p>
            </div>
            <div className="rounded-lg border border-green-700/40 bg-green-700/5 p-6">
              <div className="text-sm font-semibold text-green-700 uppercase tracking-widest mb-3">
                Workflow Poller
              </div>
              <p className="text-base text-gray-900 leading-relaxed">
                A <code className="text-green-700 font-mono text-sm">for</code> loop
                with{" "}
                <code className="text-green-700 font-mono text-sm">sleep()</code>{" "}
                <strong className="text-gray-1000">is</strong> the polling logic. Each{" "}
                <code className="text-green-700 font-mono text-sm">sleep()</code> is a
                durable pause at zero compute{"\u2014"}no cron, no timers, no database
                rows. The poll counter and interval are plain local variables
                that survive across restarts.
              </p>
              <p className="text-sm text-gray-900 mt-3 leading-relaxed">
                In production, add dead-letter handling or alert on max-polls
                exhausted to avoid silent timeouts.
              </p>
            </div>
          </div>
        </section>

        <footer
          className="border-t border-gray-400 py-6 text-center text-sm text-gray-400"
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
