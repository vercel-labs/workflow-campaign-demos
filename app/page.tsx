import { highlightCodeToHtmlLines } from "./components/code-highlight-server";
import { ScheduledDigestDemo } from "./components/demo";

const directiveUseWorkflow = `"use ${"workflow"}"`;
const directiveUseStep = `"use ${"step"}"`;

const workflowCode = `import { defineHook, sleep } from "workflow";

export const digestInbox = defineHook<{ type: string; message: string }>();

export async function collectAndSendDigest(runId: string, userId: string, windowMs: number) {
  ${directiveUseWorkflow};

  const token = \`digest:\${runId}\`;
  const hook = digestInbox.create({ token });
  const windowClosed = sleep(\`\${windowMs}ms\`).then(() => ({ kind: "window_closed" as const }));
  const events: Array<{ type: string; message: string }> = [];

  while (true) {
    const outcome = await Promise.race([
      hook.then((payload) => ({ kind: "event" as const, payload })),
      windowClosed,
    ]);

    if (outcome.kind === "window_closed") break;
    events.push(outcome.payload);
  }

  if (events.length === 0) {
    return { runId, token, status: "empty", eventCount: 0 };
  }

  await sendDigestEmail(userId, events);

  return { runId, token, status: "sent", eventCount: events.length };
}`;

const stepCode = `async function sendDigestEmail(userId: string, events: DigestEvent[]) {
  ${directiveUseStep};

  const digest = events.map(e => \`[\${e.type}] \${e.message}\`).join("\\n");

  await fetch("https://email.example.com/send", {
    method: "POST",
    body: JSON.stringify({ to: userId, subject: "Your Digest", body: digest }),
  });
}`;

function buildWorkflowLineMap(code: string) {
  const lines = code.split("\n");

  const createToken = lines
    .map((line, index) =>
      line.includes("const token =") || line.includes("digestInbox.create(")
        ? index + 1
        : null
    )
    .filter((line): line is number => line !== null);

  const raceLoop = lines
    .map((line, index) =>
      line.includes("const outcome = await Promise.race([") ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  const pushEvent = lines
    .map((line, index) =>
      line.includes("events.push(outcome.payload)") ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  const sendDigest = lines
    .map((line, index) =>
      line.includes("await sendDigestEmail(") ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  const returnSent = lines
    .map((line, index) =>
      line.includes('status: "sent"') ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  const returnEmpty = lines
    .map((line, index) =>
      line.includes('status: "empty"') ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  return {
    createToken,
    raceLoop,
    pushEvent,
    sendDigest,
    returnSent,
    returnEmpty,
  };
}

function buildStepLineMap(code: string) {
  const lines = code.split("\n");

  const sendBody = lines
    .map((line, index) =>
      line.includes('await fetch("https://email.example.com') ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  const returnLine = lines
    .map((line, index) =>
      line.includes("body: JSON.stringify") ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  return { sendBody, returnLine };
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
            Scheduled Digest
          </h1>
          <p className="max-w-3xl text-lg text-gray-900">
            Collecting events over a time window and batch-processing them normally
            requires a message queue, a cron job, and a database to accumulate state.
            With Workflow DevKit, it is just{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">
              sleep()
            </code>{" "}
            +{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">
              defineHook()
            </code>{" "}
            plus a deterministic token inbox and one send step.
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
            <ScheduledDigestDemo
              workflowCode={workflowCode}
              workflowHtmlLines={workflowHtmlLines}
              workflowLineMap={workflowLineMap}
              stepCode={stepCode}
              stepHtmlLines={stepHtmlLines}
              stepLineMap={stepLineMap}
            />
          </div>
        </section>

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
                You wire up a <strong className="text-gray-1000">message queue</strong> (SQS, RabbitMQ)
                to buffer incoming events, a <strong className="text-gray-1000">cron job</strong> to
                flush the window on a fixed schedule, and a <strong className="text-gray-1000">database
                table</strong> to accumulate state across ticks. If the cron fires before events
                arrive or after the window drifts, you get partial or duplicate digests.
                The {"\u201C"}collect then send{"\u201D"} logic is scattered across three systems.
              </p>
            </div>
            <div className="rounded-lg border border-green-700/40 bg-green-700/5 p-6">
              <div className="text-sm font-semibold text-green-700 uppercase tracking-widest mb-3">
                Workflow Digest
              </div>
              <p className="text-base text-gray-900 leading-relaxed">
                A <code className="text-green-700 font-mono text-sm">defineHook()</code> collects
                events into the workflow while{" "}
                <code className="text-green-700 font-mono text-sm">sleep()</code> holds the window
                open{"\u2014"}durably, at zero compute. When the timer fires, a single{" "}
                <code className="text-green-700 font-mono text-sm">step</code> sends the digest.
                No queue, no cron, no database rows. The entire pipeline is one function.
              </p>
              <p className="text-sm text-gray-900 mt-3 leading-relaxed">
                In production, adjust the window duration per user preference and add
                deduplication logic inside the collector loop.
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
