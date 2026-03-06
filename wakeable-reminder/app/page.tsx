import { highlightCodeToHtmlLines } from "./components/code-highlight-server";
import { WakeableReminderDemo } from "./components/demo";

const directiveUseWorkflow = `"use ${"workflow"}"`;
const directiveUseStep = `"use ${"step"}"`;

const workflowCode = `import { sleep, createHook } from "workflow";

export async function scheduleReminder(userId: string, delayMs: number) {
  ${directiveUseWorkflow};

  let sendAt = new Date(Date.now() + delayMs);

  const action = createHook<ReminderAction>({
    token: \`reminder:\${userId}\`,
    metadata: {
      userId,
      initialSendAt: sendAt.toISOString(),
      channel: "email",
    },
  });

  const outcome = await Promise.race([
    sleep(sendAt).then(() => ({ kind: "time" })),
    action.then((payload) => ({ kind: "action", payload })),
  ]);

  if (outcome.kind === "action") {
    if (outcome.payload.type === "cancel") {
      return { userId, status: "cancelled", token: action.token };
    }

    if (outcome.payload.type === "snooze") {
      sendAt = new Date(Date.now() + outcome.payload.seconds * 1000);
      await sleep(sendAt);
    }
    // "send_now" falls through to send immediately
  }

  await sendReminderEmail(userId, sendAt);

  return {
    userId,
    status: "sent",
    sentAt: sendAt.toISOString(),
    token: action.token,
  };
}`;

const stepCode = `async function sendReminderEmail(userId: string, sendAt: Date) {
  ${directiveUseStep};

  console.info("[wakeable-reminder] send_email", {
    userId,
    scheduledFor: sendAt.toISOString(),
  });
}`;

function buildWorkflowLineMap(code: string) {
  const lines = code.split("\n");

  const sleepAndRace: number[] = [];
  const cancelReturn: number[] = [];
  const snoozeBlock: number[] = [];
  const sendNowFallthrough: number[] = [];
  const sendEmail: number[] = [];
  const sentReturn: number[] = [];
  const createHook: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ln = i + 1;

    if (line.includes("const action = createHook")) createHook.push(ln);
    if (line.includes("token:") && line.includes("reminder:")) createHook.push(ln);
    if (line.includes("metadata:")) createHook.push(ln);

    if (line.includes("const outcome = await Promise.race")) sleepAndRace.push(ln);
    if (line.includes("sleep(sendAt)")) sleepAndRace.push(ln);
    if (line.includes("action.then(")) sleepAndRace.push(ln);

    if (line.includes('status: "cancelled"')) cancelReturn.push(ln);

    if (line.includes('outcome.payload.type === "snooze"')) snoozeBlock.push(ln);
    if (line.includes("outcome.payload.seconds * 1000")) snoozeBlock.push(ln);
    if (line.includes("await sleep(sendAt)") && i > 10) snoozeBlock.push(ln);

    if (line.includes('"send_now" falls through')) sendNowFallthrough.push(ln);

    if (line.includes("await sendReminderEmail(")) sendEmail.push(ln);

    if (line.includes('status: "sent"')) sentReturn.push(ln);
    if (line.includes("sentAt: sendAt.toISOString()")) sentReturn.push(ln);
  }

  return {
    sleepAndRace,
    cancelReturn,
    snoozeBlock,
    sendNowFallthrough,
    sendEmail,
    sentReturn,
    createHook,
  };
}

function buildStepLineMap(code: string) {
  const lines = code.split("\n");
  const body: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("console.info(")) body.push(i + 1);
    if (line.includes("scheduledFor:")) body.push(i + 1);
  }

  return { body };
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
            Wakeable Reminder
          </h1>
          <p className="max-w-3xl text-lg text-gray-900">
            Schedule a reminder for an exact time, then cancel, snooze, or
            send it early without cron jobs or database polling. This workflow
            uses{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">
              sleep(Date)
            </code>{" "}
            to park until the target time,{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">
              createHook()
            </code>{" "}
            for external signals, and{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">
              wakeUpRun()
            </code>{" "}
            to interrupt a sleep.
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
            <WakeableReminderDemo
              workflowCode={workflowCode}
              workflowHtmlLines={workflowHtmlLines}
              workflowLineMap={workflowLineMap}
              stepCode={stepCode}
              stepHtmlLines={stepHtmlLines}
              stepLineMap={stepLineMap}
            />
          </div>
        </section>

        {/* ── Why this matters ───────────────────────────── */}
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
                Store a <strong className="text-gray-1000">send_at</strong> timestamp in a database,
                sweep it with a cron job every N seconds, and handle race conditions for
                cancellation, snoozing, and early sends. The scheduling logic lives across
                three systems: the DB schema, the cron handler, and the cancellation endpoint.
              </p>
            </div>
            <div className="rounded-lg border border-green-700/40 bg-green-700/5 p-6">
              <div className="text-sm font-semibold text-green-700 uppercase tracking-widest mb-3">
                Workflow DevKit
              </div>
              <p className="text-base text-gray-900 leading-relaxed">
                <code className="text-green-700 font-mono text-sm">sleep(Date)</code> durably
                parks the workflow at zero compute.{" "}
                <code className="text-green-700 font-mono text-sm">createHook()</code> lets
                external systems cancel, snooze, or fast-forward.{" "}
                <code className="text-green-700 font-mono text-sm">wakeUpRun()</code> interrupts
                the sleep instantly. All scheduling logic lives in one function.
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
