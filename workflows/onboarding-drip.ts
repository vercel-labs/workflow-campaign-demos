import { getWritable, sleep } from "workflow";

export type DripEvent =
  | { type: "email_sending"; day: number; label: string }
  | { type: "email_sent"; day: number; label: string }
  | { type: "sleeping"; duration: string; fromDay: number; toDay: number }
  | { type: "done" };

const SEND_DELAY_MS = 600;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runOnboardingDrip(email: string) {
  "use workflow";

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

  return { email, status: "completed", totalDays: 7 };
}

async function sendWelcomeEmail(email: string) {
  "use step";
  const writer = getWritable<DripEvent>().getWriter();
  try {
    await writer.write({ type: "email_sending", day: 0, label: "Welcome Email" });
    await delay(SEND_DELAY_MS);
    await writer.write({ type: "email_sent", day: 0, label: "Welcome Email" });
    await writer.write({ type: "sleeping", duration: "1d", fromDay: 0, toDay: 1 });
    return { sent: true, day: 0 };
  } finally {
    writer.releaseLock();
  }
}

async function sendGettingStartedEmail(email: string) {
  "use step";
  const writer = getWritable<DripEvent>().getWriter();
  try {
    await writer.write({ type: "email_sending", day: 1, label: "Getting Started Tips" });
    await delay(SEND_DELAY_MS);
    await writer.write({ type: "email_sent", day: 1, label: "Getting Started Tips" });
    await writer.write({ type: "sleeping", duration: "2d", fromDay: 1, toDay: 3 });
    return { sent: true, day: 1 };
  } finally {
    writer.releaseLock();
  }
}

async function sendFeatureHighlightsEmail(email: string) {
  "use step";
  const writer = getWritable<DripEvent>().getWriter();
  try {
    await writer.write({ type: "email_sending", day: 3, label: "Feature Highlights" });
    await delay(SEND_DELAY_MS);
    await writer.write({ type: "email_sent", day: 3, label: "Feature Highlights" });
    await writer.write({ type: "sleeping", duration: "4d", fromDay: 3, toDay: 7 });
    return { sent: true, day: 3 };
  } finally {
    writer.releaseLock();
  }
}

async function sendFollowUpEmail(email: string) {
  "use step";
  const writer = getWritable<DripEvent>().getWriter();
  try {
    await writer.write({ type: "email_sending", day: 7, label: "Follow-up & Feedback" });
    await delay(SEND_DELAY_MS);
    await writer.write({ type: "email_sent", day: 7, label: "Follow-up & Feedback" });
    await writer.write({ type: "done" });
    return { sent: true, day: 7 };
  } finally {
    writer.releaseLock();
  }
}
