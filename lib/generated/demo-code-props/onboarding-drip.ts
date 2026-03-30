// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { highlightCodeToHtmlLines } from "@/lib/code-workbench.server";

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

    sendLines[stepIdx] = [callLineIdx + 1];

    if (stepIdx < STEP_PATTERNS.length - 1) {
      const nextPattern = STEP_PATTERNS[stepIdx + 1];
      const nextCallLineIdx = lines.findIndex((l) => l.includes(`await ${nextPattern}(`));
      const searchEnd = nextCallLineIdx >= 0 ? nextCallLineIdx : lines.length;
      const found: number[] = [];
      for (let i = callLineIdx + 1; i < searchEnd; i++) {
        if (lines[i].trim().startsWith("await sleep(")) {
          found.push(i + 1);
        }
      }
      sleepLines[stepIdx] = found;
    } else {
      sleepLines[stepIdx] = [];
    }
  }

  return { sendLines, sleepLines };
}

export type OnboardingDripCodeProps = {
  workflowCode: string;
  workflowLinesHtml: string[];
  stepCodes: string[];
  stepLinesHtml: string[][];
  stepSendLines: Record<number, number[]>;
  stepSleepLines: Record<number, number[]>;
};

export function getOnboardingDripCodeProps(): OnboardingDripCodeProps {
  const { sendLines, sleepLines } = buildStepHighlightPhases(workflowCode);

  return {
    workflowCode,
    workflowLinesHtml: highlightCodeToHtmlLines(workflowCode),
    stepCodes,
    stepLinesHtml: stepCodes.map((code) => highlightCodeToHtmlLines(code)),
    stepSendLines: sendLines,
    stepSleepLines: sleepLines,
  };
}
