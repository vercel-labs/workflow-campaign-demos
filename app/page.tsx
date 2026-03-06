import { highlightCodeToHtmlLines } from "./components/code-highlight-server";
import { NamespacedStreamsDemo } from "./components/demo";

const directiveUseWorkflow = `"use ${"workflow"}"`;
const directiveUseStep = `"use ${"step"}"`;

const workflowCode = `import { getWritable, getWorkflowMetadata } from "workflow";

export async function generatePost(topic: string) {
  ${directiveUseWorkflow};

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
}`;

const stepCode = `async function buildOutline(topic: string) {
  ${directiveUseStep};
  return \`# \${topic}\\n\\n## Outline\\n1. Introduction\\n2. Key Concepts\\n3. Implementation\\n4. Best Practices\`;
}

async function writeSections(topic: string, outline: string) {
  ${directiveUseStep};
  return [
    \`## Introduction\\nAn overview of \${topic}...\`,
    \`## Key Concepts\\nThe fundamental building blocks...\`,
    \`## Implementation\\nHere's how to build it...\`,
    \`## Best Practices\\nTesting strategies...\`,
  ];
}`;

function findLines(code: string, match: string): number[] {
  const lines = code.split("\n");
  const result: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(match)) {
      result.push(i + 1);
    }
  }
  return result;
}

function findLine(code: string, match: string): number[] {
  const lines = code.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(match)) {
      return [i + 1];
    }
  }
  return [];
}

const workflowLineMap = {
  draftWriteLines: findLines(workflowCode, "await draft.write("),
  telemetryWriteLines: findLines(workflowCode, "await telemetry.write("),
  telemetryStartLine: findLine(workflowCode, 'type: "start"'),
  telemetryDoneLine: findLine(workflowCode, 'type: "done"'),
  buildOutlineCall: findLine(workflowCode, "await buildOutline("),
  writeSectionsCall: findLine(workflowCode, "await writeSections("),
  returnLine: findLine(workflowCode, 'status: "completed"'),
};

const stepLineMap = {
  buildOutlineBody: findLine(stepCode, "return `# ${topic}"),
  writeSectionsBody: findLine(stepCode, "return ["),
};

const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);
const stepHtmlLines = highlightCodeToHtmlLines(stepCode);

export default function Home() {
  return (
    <div className="min-h-screen bg-background-100 p-8 text-gray-1000">
      <main id="main-content" className="mx-auto max-w-5xl" role="main">
        <header className="mb-10">
          <div className="mb-4 inline-flex items-center rounded-full border border-violet-700/40 bg-violet-700/20 px-3 py-1 text-sm font-medium text-violet-700">
            Workflow DevKit Example
          </div>
          <h1 className="mb-4 text-5xl font-semibold tracking-tight text-gray-1000">
            Namespaced Streams
          </h1>
          <p className="max-w-3xl text-lg text-gray-900">
            AI content generation needs two simultaneous outputs: the user-facing
            draft and internal telemetry. Traditional approach: a websocket
            multiplex layer with message envelopes and ordering bugs. With
            Workflow DevKit, call{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">
              {"getWritable({ namespace })"}
            </code>{" "}
            twice and get two independent, typed streams from one workflow run.
            Pair with{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">
              getWorkflowMetadata()
            </code>{" "}
            for run-level context and{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">
              run.returnValue
            </code>{" "}
            to await the final result from the API route.
          </p>
        </header>

        <section aria-labelledby="try-it-heading" className="mb-12">
          <h2
            id="try-it-heading"
            className="mb-3 text-2xl font-semibold tracking-tight text-gray-1000"
          >
            Try It
          </h2>
          <p className="mb-4 text-sm text-gray-900">
            Start a content generation run and watch two namespaced streams
            update simultaneously: a &ldquo;draft&rdquo; stream carrying
            generated text and a &ldquo;telemetry&rdquo; stream carrying token
            counts and timing. Powered by real workflow API routes using{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-xs">
              {"getWritable({ namespace })"}
            </code>{" "}
            and SSE streaming via{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-xs">
              run.getReadable()
            </code>
            .
          </p>

          <NamespacedStreamsDemo
            workflowCode={workflowCode}
            workflowHtmlLines={workflowHtmlLines}
            workflowLineMap={workflowLineMap}
            stepCode={stepCode}
            stepHtmlLines={stepHtmlLines}
            stepLineMap={stepLineMap}
          />
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
