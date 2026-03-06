import { highlight } from "sugar-high";
import { highlightCodeToHtmlLines } from "@/components/code-highlight-server";
import { ContentPipelineDemo } from "./components/demo";
import { ApiCodeWorkbench } from "@/components/export-code-workbench";

const directiveUseWorkflow = `"use ${"workflow"}"`;
const directiveUseStep = `"use ${"step"}"`;

// ---------------------------------------------------------------------------
// Section names (shared with demo for the checklist)
// ---------------------------------------------------------------------------
const sectionNames = [
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

// ---------------------------------------------------------------------------
// Mock generated content for each section (displayed in the document preview)
// ---------------------------------------------------------------------------
const sectionContent = [
  "This report analyzes the strategic opportunity for expanding into the European market. We evaluate market conditions, technical requirements, and projected returns over a 24-month horizon.",
  "The European SaaS market is projected to reach $142B by 2027, growing at 14.2% CAGR. Key segments include enterprise automation (38%), developer tools (24%), and data infrastructure (19%).",
  "The proposed architecture uses a multi-region deployment across AWS eu-west-1 and eu-central-1 with active-active failover. Data residency is enforced at the routing layer to meet GDPR requirements.",
  "Phase 1 (Q1): Infrastructure setup and compliance review. Phase 2 (Q2): Beta launch with 10 design partners. Phase 3 (Q3-Q4): General availability and sales ramp across 4 initial markets.",
  "Primary risks include GDPR compliance complexity (mitigated by dedicated DPO hire), currency fluctuation (hedged via forward contracts), and competitive pressure from established EU-native vendors.",
  "Year 1 revenue projection: $2.4M with 340 enterprise accounts. Break-even expected by month 18. Gross margin target of 78% aligns with existing product economics.",
  "Key milestones: regulatory approval (March), beta launch (June), first enterprise close (August), GA announcement (October), 100-customer milestone (December).",
  "Proposed team of 12: 5 engineering (2 backend, 2 infra, 1 frontend), 3 sales, 2 compliance, 1 marketing, 1 operations lead. Initial hires co-located in London office.",
  "Three established competitors hold 67% market share. Our differentiation centers on developer experience and pricing flexibility — areas where incumbents score lowest in customer satisfaction surveys.",
  "The European expansion represents a $12M ARR opportunity within 24 months. With controlled investment and phased rollout, risk-adjusted ROI exceeds 3.2x. We recommend proceeding with Phase 1 immediately.",
];

// ---------------------------------------------------------------------------
// Workflow code (displayed in the left pane of the code workbench)
// ---------------------------------------------------------------------------
const workflowCode = `// Each await is a cancellation checkpoint —
// run.cancel() takes effect between steps.
export async function generateReport(
  accountId: string,
  systemPrompt: string
) {
  ${directiveUseWorkflow};

  const intro = await generateSection("Introduction", systemPrompt);
  const market = await generateSection("Market Analysis", intro);
  const tech = await generateSection("Technical Architecture", market);
  const plan = await generateSection("Implementation Plan", tech);
  const risks = await generateSection("Risk Assessment", plan);
  const finance = await generateSection("Financial Projections", risks);
  const timeline = await generateSection("Timeline", finance);
  const team = await generateSection("Team Structure", timeline);
  const landscape = await generateSection("Competitive Landscape", team);
  const conclusion = await generateSection("Conclusion", landscape);

  return { accountId, report: conclusion, status: "completed" };
}`;

// ---------------------------------------------------------------------------
// Step codes (displayed in the right pane, switched by phase)
// ---------------------------------------------------------------------------
const stepCodes = [
  `async function generateSection(
  title: string,
  previous?: string | { title: string }
) {
  ${directiveUseStep};

  const previousTitle =
    typeof previous === "string" ? previous : previous?.title;

  const { text } = await generateText({
    model: "anthropic/claude-sonnet-4.5",
    system: previousTitle
      ? \`You are a professional writer. Previous section: \${previousTitle}\`
      : "You are a professional writer.",
    prompt: \`Write the "\${title}" section of a strategic report.\`,
  });

  return { title, content: text, status: "generated" };
}`,
];

// ---------------------------------------------------------------------------
// Pre-compute highlighted HTML lines (server-side only)
// ---------------------------------------------------------------------------
const workflowLinesHtml = highlightCodeToHtmlLines(workflowCode);
const stepLinesHtml = stepCodes.map((code) => highlightCodeToHtmlLines(code));

// ---------------------------------------------------------------------------
// Scan workflow code for highlight line numbers (dynamic, not hardcoded)
// ---------------------------------------------------------------------------
function buildHighlightLineMap(code: string) {
  const lines = code.split("\n");
  const generateLines: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("await generateSection(")) generateLines.push(i + 1);
  }

  return { generateLines };
}

const highlightLineMap = buildHighlightLineMap(workflowCode);

// ---------------------------------------------------------------------------
// API route code (displayed side-by-side in the API Routes workbench)
// ---------------------------------------------------------------------------
const apiStartCode = `export async function POST(request: Request) {
  const body = await request.json();
  const { accountId, systemPrompt } = body;

  if (!accountId || typeof accountId !== "string") {
    return NextResponse.json(
      { error: "accountId is required" },
      { status: 400 }
    );
  }

  // start() enqueues the pipeline and returns a runId for reconnects.
  const run = await start(generateReport, [accountId, systemPrompt]);

  return NextResponse.json({
    runId: run.runId,
    accountId,
    message: "Generation pipeline started",
  });
}`;

const apiCancelCode = `export async function POST(request: Request) {
  const body = await request.json();
  const { runId } = body;

  if (!runId || typeof runId !== "string") {
    return NextResponse.json(
      { error: "runId is required" },
      { status: 400 }
    );
  }

  // getRun() recovers any existing run for status checks or cancellation.
  const run = getRun(runId);
  const currentStatus = await run.status;

  if (currentStatus === "completed" ||
      currentStatus === "cancelled" ||
      currentStatus === "failed") {
    return NextResponse.json(
      { error: \`Cannot cancel a \${currentStatus} workflow\` },
      { status: 400 }
    );
  }

  // run.cancel() requests termination — the workflow exits at the next safe boundary.
  await run.cancel();

  return NextResponse.json({
    runId,
    message: "Cancellation requested. Waiting for checkpoint.",
    previousStatus: currentStatus,
    currentStatus: "cancelling",
  });
}`;

const apiStartLinesHtml = highlightCodeToHtmlLines(apiStartCode);
const apiCancelLinesHtml = highlightCodeToHtmlLines(apiCancelCode);

// ---------------------------------------------------------------------------
// Build per-line highlight maps for the API route panes.
// Colors: 0 = amber (start), 1 = red (cancel), 2 = green (response)
// ---------------------------------------------------------------------------
function buildApiLineHighlights(startCode: string, cancelCode: string) {
  const startLines = startCode.split("\n");
  const cancelLines = cancelCode.split("\n");
  const startMap: Record<number, number> = {};
  const cancelMap: Record<number, number> = {};

  // Step 1 (amber=0): the start() call + comment in API Start
  for (let i = 0; i < startLines.length; i++) {
    if (startLines[i].includes("// start()")) startMap[i + 1] = 0;
    if (startLines[i].includes("await start(")) {
      startMap[i + 1] = 0;
      break;
    }
  }

  // Step 2 (red=1): getRun comment + run handle + run.cancel comment + cancel in API Cancel
  for (let i = 0; i < cancelLines.length; i++) {
    const line = cancelLines[i];
    if (
      line.includes("// getRun()") ||
      line.includes("getRun(") ||
      line.includes("run.status") ||
      line.includes("// run.cancel()") ||
      line.includes("run.cancel()")
    ) {
      cancelMap[i + 1] = 1;
    }
  }

  // Step 2 (green=2): only the runId line in the response block
  for (let i = 0; i < startLines.length; i++) {
    if (startLines[i].includes("runId: run.runId")) {
      startMap[i + 1] = 2;
      break;
    }
  }

  return { startMap, cancelMap };
}

const { startMap: apiStartHighlights, cancelMap: apiCancelHighlights } =
  buildApiLineHighlights(apiStartCode, apiCancelCode);

// ---------------------------------------------------------------------------
// How It Works — inline code snippets, pre-highlighted and color-matched
// ---------------------------------------------------------------------------
const howItWorksSteps = [
  {
    circle: "bg-amber-700",
    border: "border-amber-700",
    bg: "bg-amber-700/10",
    tab: "API Start" as const,
    title: "Start the pipeline and get a runId",
    description:
      "start() enqueues the generation pipeline and returns immediately with a run handle. The runId lets you stream progress, check status, or cancel mid-pipeline.",
    code: highlight(
      `const run = await start(generateReport, [\n  accountId,\n  systemPrompt,\n]);`
    ),
  },
  {
    circle: "bg-green-700",
    border: "border-green-700",
    bg: "bg-green-700/10",
    tab: "API Start" as const,
    title: "Return the run handle for reconnects",
    description:
      "The response includes the runId so clients can reconnect to the progress stream, poll status, or cancel — even after a page reload or network interruption.",
    code: highlight(`runId: run.runId,`),
  },
  {
    circle: "bg-red-700",
    border: "border-red-700",
    bg: "bg-red-700/10",
    tab: "API Cancel" as const,
    title: "Cancel at the next step boundary",
    description:
      "getRun() recovers the run handle from any route using just the runId. run.cancel() requests termination — the workflow finishes the current step and exits at the next step boundary. No section is left half-written.",
    code: highlight(
      `const run = getRun(runId);\nconst currentStatus = await run.status;\n\nawait run.cancel();`
    ),
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background-100 p-8 text-gray-1000">
      <main className="mx-auto max-w-4xl" role="main">
        <header className="mb-12">
          <h1 className="mb-4 text-4xl font-semibold tracking-tight text-gray-1000">
            Safe Cancel
          </h1>
          <p className="max-w-2xl text-lg text-gray-900">
            AI content generation burns tokens and time. When a run goes
            off the rails, this pattern lets you request cancellation —
            the current step finishes and the pipeline stops at the next
            boundary, keeping every completed section intact.
          </p>
        </header>

        <section aria-labelledby="try-it-heading" className="mb-12">
          <h2
            id="try-it-heading"
            className="mb-4 text-2xl font-semibold tracking-tight"
          >
            Try It
          </h2>
          <p className="mb-4 text-sm text-gray-900">
            Start the pipeline, watch sections generate one by one, then
            cancel mid-run. Every completed section is preserved — review
            what the run produced to see where it drifted.
          </p>
          <ContentPipelineDemo
            workflowCode={workflowCode}
            workflowLinesHtml={workflowLinesHtml}
            stepCodes={stepCodes}
            stepLinesHtml={stepLinesHtml}
            highlightLineMap={highlightLineMap}
            sectionNames={sectionNames}
            sectionContent={sectionContent}
          />
        </section>

        <section aria-labelledby="how-it-works-heading" className="mb-12">
          <h2
            id="how-it-works-heading"
            className="mb-4 text-2xl font-semibold tracking-tight"
          >
            How It Works
          </h2>
          <ol
            className="list-none space-y-6 rounded-lg border border-gray-400 bg-background-200 p-6"
            role="list"
            aria-label="Generation pipeline steps"
          >
            {howItWorksSteps.map((step, index) => (
              <li key={index} className="flex items-start gap-4">
                <span
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-black ${step.circle}`}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-1000">
                    {step.title}
                  </h3>
                  <p className="mt-1 text-sm text-gray-900">
                    {step.description}
                  </p>
                  <div
                    className={`mt-3 overflow-x-auto rounded-md border-l-2 ${step.border} ${step.bg} px-3 py-2`}
                  >
                    <pre className="text-[13px] leading-5">
                      <code
                        className="font-mono"
                        dangerouslySetInnerHTML={{ __html: step.code }}
                      />
                    </pre>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="code-heading" className="mb-12">
          <h2
            id="code-heading"
            className="mb-4 text-2xl font-semibold tracking-tight"
          >
            API Routes
          </h2>
          <p className="mb-4 text-sm text-gray-900">
            The start and cancel API routes enqueue the pipeline and manage
            run lifecycle. Highlighted lines match the steps above.
          </p>
          <ApiCodeWorkbench
            leftCode={apiStartCode}
            leftLinesHtml={apiStartLinesHtml}
            leftFilename="api/start/route.ts"
            leftLineHighlights={apiStartHighlights}
            rightCode={apiCancelCode}
            rightLinesHtml={apiCancelLinesHtml}
            rightFilename="api/cancel/route.ts"
            rightLineHighlights={apiCancelHighlights}
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
