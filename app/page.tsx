import { highlight } from "sugar-high";
import { highlightCodeToHtmlLines } from "@/components/code-highlight-server";
import { RoutingSlipDemo, type RoutingSlipLineMap } from "./components/demo";

const directiveUseWorkflow = `"use ${"workflow"}"`;
const directiveUseStep = `"use ${"step"}"`;

const workflowCode = `export async function routingSlip(orderId: string, slip: SlipStage[]) {
  ${directiveUseWorkflow};

  const results: StageResult[] = [];

  for (const stage of slip) {
    const result = await processStage(orderId, stage);
    results.push(result);
  }

  return {
    status: "completed",
    orderId,
    stages: results,
  };
}`;

const stepCode = `async function processStage(orderId: string, stage: SlipStage): Promise<StageResult> {
  ${directiveUseStep};

  const delay = 500 + Math.floor(Math.random() * 700);
  await new Promise((resolve) => setTimeout(resolve, delay));

  const messages: Record<SlipStage, string> = {
    inventory: \`Verified stock for order \${orderId}\`,
    payment: \`Payment processed for order \${orderId}\`,
    packaging: \`Package prepared for order \${orderId}\`,
    shipping: \`Shipment dispatched for order \${orderId}\`,
    notification: \`Customer notified for order \${orderId}\`,
  };

  return {
    stage,
    status: "completed",
    message: messages[stage],
    durationMs: delay,
  };
}`;

const workflowLinesHtml = highlightCodeToHtmlLines(workflowCode);
const stepLinesHtml = highlightCodeToHtmlLines(stepCode);

function getLine(lines: string[], pattern: string): number {
  const index = lines.findIndex((line) => line.includes(pattern));
  return index >= 0 ? index + 1 : 1;
}

function buildLineMap(workflow: string, step: string): RoutingSlipLineMap {
  const workflowLines = workflow.split("\n");
  const stepLines = step.split("\n");

  return {
    workflowLoopLine: getLine(workflowLines, "for (const stage of slip)"),
    workflowProcessLine: getLine(workflowLines, "await processStage(orderId, stage)"),
    workflowReturnLine: getLine(workflowLines, "return {"),
    stepDelayLine: getLine(stepLines, "await new Promise((resolve) => setTimeout(resolve, delay))"),
    stepReturnLine: getLine(stepLines, "return {"),
    stepMessageLines: {
      inventory: getLine(stepLines, "inventory:"),
      payment: getLine(stepLines, "payment:"),
      packaging: getLine(stepLines, "packaging:"),
      shipping: getLine(stepLines, "shipping:"),
      notification: getLine(stepLines, "notification:"),
    },
  };
}

const lineMap = buildLineMap(workflowCode, stepCode);

const howItWorksSteps = [
  {
    circle: "bg-violet-700",
    border: "border-violet-700",
    bg: "bg-violet-700/10",
    title: "Attach the route to the message",
    description:
      "Each order carries its own ordered slip. Standard orders use all five stages; digital orders skip packaging and shipping.",
    code: highlight(`const slip = ["inventory", "payment", "notification"];`),
  },
  {
    circle: "bg-amber-700",
    border: "border-amber-700",
    bg: "bg-amber-700/10",
    title: "Loop through the slip durably",
    description:
      "The workflow reads the slip and executes each stage in sequence. Every await is a durable checkpoint.",
    code: highlight(
      `for (const stage of slip) {\n  const result = await processStage(orderId, stage);\n  results.push(result);\n}`
    ),
  },
  {
    circle: "bg-green-700",
    border: "border-green-700",
    bg: "bg-green-700/10",
    title: "Each stage does one job, then handoff",
    description:
      "A step receives the current stage, performs that operation, and returns a typed result for the next stage.",
    code: highlight(
      `async function processStage(orderId: string, stage: SlipStage) {\n  ${directiveUseStep};\n  // do stage work\n}`
    ),
  },
];

export default function Page() {
  return (
    <div className="min-h-screen bg-background-100 p-8 text-gray-1000">
      <main id="main-content" className="mx-auto max-w-5xl">
        <header className="mb-12">
          <div className="mb-4 inline-flex items-center rounded-full border border-violet-700/40 bg-violet-700/20 px-3 py-1 text-xs font-medium text-violet-700">
            Workflow DevKit Example
          </div>
          <h1 className="mb-4 text-4xl font-semibold tracking-tight text-gray-1000">
            Routing Slip
          </h1>
          <p className="max-w-3xl text-lg text-gray-900">
            A dynamic ordered list of processing steps attached to each message.
            The workflow reads the slip and executes each stage sequentially
            — different message types get different routes through the system.
          </p>
        </header>

        <section aria-labelledby="how-it-works-heading" className="mb-12">
          <h2
            id="how-it-works-heading"
            className="mb-4 text-2xl font-semibold tracking-tight text-gray-1000"
          >
            How It Works
          </h2>
          <ol
            className="list-none space-y-5 rounded-lg border border-gray-400 bg-background-200 p-6"
            role="list"
            aria-label="Routing slip stages"
          >
            {howItWorksSteps.map((step, index) => (
              <li key={step.title} className="flex items-start gap-4">
                <span
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold text-black ${step.circle}`}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-1000">{step.title}</h3>
                  <p className="mt-1 text-sm text-gray-900">{step.description}</p>
                  <div
                    className={`mt-3 overflow-x-auto rounded-md border-l-2 px-3 py-2 ${step.border} ${step.bg}`}
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

        <section aria-labelledby="try-it-heading" className="mb-12">
          <h2
            id="try-it-heading"
            className="mb-4 text-2xl font-semibold tracking-tight text-gray-1000"
          >
            Try It
          </h2>
          <p className="mb-4 text-sm text-gray-900">
            Pick an order type, run the slip, and watch line-by-line execution in
            the code workbench below.
          </p>
          <RoutingSlipDemo
            workflowCode={workflowCode}
            workflowLinesHtml={workflowLinesHtml}
            stepCode={stepCode}
            stepLinesHtml={stepLinesHtml}
            lineMap={lineMap}
          />
        </section>

        <footer className="border-t border-gray-400 py-6 text-center text-sm text-gray-900">
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
