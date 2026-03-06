import { getWritable, getWorkflowMetadata } from "workflow";

export type DraftEvent = { type: "chunk"; text: string; idx: number };

export type TelemetryEvent =
  | { type: "start"; runId: string; name: string }
  | { type: "tokens"; input: number; output: number }
  | { type: "done"; totalMs: number; totalTokens: number };

export type GenerateResult = {
  status: "completed";
  workflowRunId: string;
  sectionCount: number;
};

export async function generatePost(topic: string): Promise<GenerateResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  const draft = getWritable<DraftEvent>({ namespace: "draft" }).getWriter();
  const telemetry = getWritable<TelemetryEvent>({ namespace: "telemetry" }).getWriter();

  const startedAt = Date.now();

  try {
    await telemetry.write({ type: "start", runId: workflowRunId, name: "generatePost" });

    const outline = await buildOutline(topic);
    await draft.write({ type: "chunk", idx: 0, text: outline });
    await telemetry.write({ type: "tokens", input: 45, output: 120 });

    const sections = await writeSections(topic, outline);
    for (let i = 0; i < sections.length; i++) {
      await draft.write({ type: "chunk", idx: i + 1, text: sections[i] });
      await telemetry.write({ type: "tokens", input: 80 + i * 10, output: 150 + i * 30 });
    }

    const totalMs = Date.now() - startedAt;
    await telemetry.write({ type: "done", totalMs, totalTokens: 945 });

    return { status: "completed", workflowRunId, sectionCount: sections.length + 1 };
  } finally {
    draft.releaseLock();
    telemetry.releaseLock();
  }
}

async function buildOutline(topic: string): Promise<string> {
  "use step";
  return `# ${topic}\n\n## Outline\n1. Introduction\n2. Key Concepts\n3. Implementation\n4. Best Practices`;
}

async function writeSections(topic: string, outline: string): Promise<string[]> {
  "use step";
  void outline;
  return [
    `## Introduction\nAn overview of ${topic} and why it matters for modern applications...`,
    `## Key Concepts\nThe fundamental building blocks: durable execution, deterministic replay, and step boundaries...`,
    `## Implementation\nHere's how to build it step by step with proper error handling and idempotency...`,
    `## Best Practices\nTesting strategies, monitoring, and production deployment patterns...`,
  ];
}
