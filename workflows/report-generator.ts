import { getWritable } from "workflow";

export type SectionEvent =
  | { type: "section_start"; index: number; title: string }
  | { type: "section_done"; index: number; title: string }
  | { type: "complete"; total: number }
  | { type: "cancelled"; completedCount: number; total: number };

const SECTION_DELAY_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SECTION_TITLES = [
  "Introduction",
  "Market Analysis",
  "Technical Architecture",
  "Implementation Plan",
  "Risk Assessment",
  "Financial Projections",
  "Timeline",
  "Team Structure",
  "Competitive Landscape",
  "Conclusion",
];

export async function generateReport(
  accountId: string,
  systemPrompt: string
) {
  "use workflow";

  // Each await is a cancellation checkpoint —
  // run.cancel() takes effect between steps.
  const sections: { title: string; status: string }[] = [];

  for (let i = 0; i < SECTION_TITLES.length; i++) {
    const title = SECTION_TITLES[i];
    const result = await generateSection(i, title, sections[i - 1]?.title);
    sections.push(result);
  }

  await emitDone(sections.length);

  return { accountId, sections, status: "completed" };
}

async function emitDone(total: number) {
  "use step";
  const writer = getWritable<SectionEvent>().getWriter();
  try {
    await writer.write({ type: "complete", total });
  } finally {
    writer.releaseLock();
  }
}

emitDone.maxRetries = 0;

async function generateSection(
  index: number,
  title: string,
  previousTitle?: string
) {
  "use step";

  const writer = getWritable<SectionEvent>().getWriter();
  try {
    await writer.write({ type: "section_start", index, title });
    await delay(SECTION_DELAY_MS);
    await writer.write({ type: "section_done", index, title });
    return { title, previous: previousTitle, status: "generated" };
  } finally {
    writer.releaseLock();
  }
}
