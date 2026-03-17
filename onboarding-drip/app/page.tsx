import { highlightCodeToHtmlLines } from "@/app/components/code-highlight-server";
import { OnboardingDripDemoClient } from "@/app/components/onboarding-drip-demo-client";

const directiveUseWorkflow = `"use ${"workflow"}"`;
const directiveUseStep = `"use ${"step"}"`;

const workflowCode = `import { sleep } from "workflow";

export async function runOnboardingDrip(email: string) {
  ${directiveUseWorkflow};

  // Day 0: Welcome email
  await sendWelcomeEmail(email);

  // Day 1: Getting started tips
  await sleep("1d");
  await sendGettingStartedEmail(email);

  // Day 3: Feature highlights
  await sleep("2d");
  await sendFeatureHighlightsEmail(email);

  // Day 7: Follow-up
  await sleep("4d");
  await sendFollowUpEmail(email);
}`;

const stepCodes = [
  `async function sendWelcomeEmail(email: string) {
  ${directiveUseStep};

  // Day 0: Immediate welcome after signup
  await fetch("https://mail.example.com/send", {
    method: "POST",
    body: JSON.stringify({
      to: email,
      template: "welcome",
      subject: "Welcome to Workflow DevKit",
    }),
  });

  return { sent: true, day: 0 };
}`,
  `async function sendGettingStartedEmail(email: string) {
  ${directiveUseStep};

  // Day 1: Practical tips after first 24 hours
  await fetch("https://mail.example.com/send", {
    method: "POST",
    body: JSON.stringify({
      to: email,
      template: "getting-started",
      subject: "Getting started tips for your first workflow",
    }),
  });

  return { sent: true, day: 1 };
}`,
  `async function sendFeatureHighlightsEmail(email: string) {
  ${directiveUseStep};

  // Day 3: Showcase key features
  await fetch("https://mail.example.com/send", {
    method: "POST",
    body: JSON.stringify({
      to: email,
      template: "feature-highlights",
      subject: "Feature highlights you should try next",
    }),
  });

  return { sent: true, day: 3 };
}`,
  `async function sendFollowUpEmail(email: string) {
  ${directiveUseStep};

  // Day 7: Request feedback
  await fetch("https://mail.example.com/send", {
    method: "POST",
    body: JSON.stringify({
      to: email,
      template: "follow-up",
      subject: "How did your first workflow week go?",
    }),
  });

  return { sent: true, day: 7 };
}`,
];

// Compute highlight ranges by scanning workflowCode for step call patterns.
// This avoids hardcoded line numbers that break if the code string is edited.
const STEP_PATTERNS = [
  "sendWelcomeEmail",
  "sendGettingStartedEmail",
  "sendFeatureHighlightsEmail",
  "sendFollowUpEmail",
];

function buildStepHighlightPhases(code: string) {
  const lines = code.split("\n");
  const sendLines: Record<number, number[]> = {};
  const sleepLines: Record<number, number[]> = {};

  for (let stepIdx = 0; stepIdx < STEP_PATTERNS.length; stepIdx++) {
    const pattern = STEP_PATTERNS[stepIdx];
    const callLineIdx = lines.findIndex((l) => l.includes(`await ${pattern}(`));
    if (callLineIdx === -1) continue;

    // Send line: the await call itself
    sendLines[stepIdx] = [callLineIdx + 1]; // 1-indexed

    // Sleep line: the await sleep() between this step's send and the next
    if (stepIdx < STEP_PATTERNS.length - 1) {
      const nextPattern = STEP_PATTERNS[stepIdx + 1];
      const nextCallLineIdx = lines.findIndex((l) => l.includes(`await ${nextPattern}(`));
      const searchEnd = nextCallLineIdx >= 0 ? nextCallLineIdx : lines.length;
      const found: number[] = [];
      for (let i = callLineIdx + 1; i < searchEnd; i++) {
        if (lines[i].trim().startsWith("await sleep(")) {
          found.push(i + 1); // 1-indexed
        }
      }
      sleepLines[stepIdx] = found;
    } else {
      sleepLines[stepIdx] = [];
    }
  }

  return { sendLines, sleepLines };
}

const { sendLines: stepSendLines, sleepLines: stepSleepLines } = buildStepHighlightPhases(workflowCode);

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background-100 font-sans">
      <main
        className="flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-12 px-6 py-16 sm:px-12"
        role="main"
        aria-labelledby="page-title"
      >
        <header className="flex flex-col items-center gap-4 text-center">
          <div
            className="inline-flex items-center gap-2 rounded-full border border-green-700/40 bg-green-700/20 px-3 py-1 text-sm font-medium text-green-700"
            role="status"
            aria-label="Example type"
          >
            <span aria-hidden="true">&#x2709;</span>
            <span>Drip Campaign Example</span>
          </div>
          <h1
            id="page-title"
            className="text-4xl font-semibold tracking-tight text-gray-1000 sm:text-5xl"
          >
            Onboarding Drip Campaign
          </h1>
          <p className="max-w-3xl text-lg text-gray-900">
            A multi-day email campaign that uses durable sleeps between steps.
            The interactive timeline below visualizes how workflow compute bursts
            stay tiny while the campaign spans an entire week.
          </p>
        </header>

        <section aria-labelledby="demo-heading" className="w-full max-w-5xl">
          <h2
            id="demo-heading"
            className="mb-4 text-2xl font-semibold tracking-tight text-gray-1000"
          >
            Try It Out
          </h2>
          <OnboardingDripDemoClient
            workflowCode={workflowCode}
            workflowLinesHtml={highlightCodeToHtmlLines(workflowCode)}
            stepCodes={stepCodes}
            stepLinesHtml={stepCodes.map((code) => highlightCodeToHtmlLines(code))}
            stepSendLines={stepSendLines}
            stepSleepLines={stepSleepLines}
          />
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
