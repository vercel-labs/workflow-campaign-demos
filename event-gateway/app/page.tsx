import { highlightCodeToHtmlLines } from "./components/code-highlight-server";
import { EventGatewayDemo } from "./components/demo";

const directiveUseWorkflow = `"use ${"workflow"}"`;
const directiveUseStep = `"use ${"step"}"`;

type GatewayWorkflowLineMap = {
  createTokens: number[];
  race: number[];
  ship: number[];
  returnShipped: number[];
  returnTimeout: number[];
};

type GatewayStepLineMap = {
  shipFetch: number[];
};

const workflowCode = `import { defineHook, sleep } from "workflow";

const signal = defineHook<{ ok: true }>();

export async function releaseOrder(orderId: string, timeoutMs = 6500) {
  ${directiveUseWorkflow};

  const payment = signal.create({ token: \`payment:\${orderId}\` });
  const inventory = signal.create({ token: \`inventory:\${orderId}\` });
  const fraud = signal.create({ token: \`fraud:\${orderId}\` });

  const outcome = await Promise.race([
    Promise.all([payment, inventory, fraud]).then(() => "ready" as const),
    sleep(\`\${timeoutMs}ms\`).then(() => "timeout" as const),
  ]);

  if (outcome === "timeout") {
    return { orderId, status: "timeout" as const };
  }

  await shipOrder(orderId);
  return { orderId, status: "shipped" as const };
}`;

const stepCode = `async function shipOrder(orderId: string) {
  ${directiveUseStep};

  await fetch("https://shipping.example.com/ship", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orderId }),
  });
}`;

function findLines(code: string, includes: string): number[] {
  return code
    .split("\n")
    .map((line, idx) => (line.includes(includes) ? idx + 1 : null))
    .filter((v): v is number => v !== null);
}

function buildWorkflowLineMap(code: string): GatewayWorkflowLineMap {
  return {
    createTokens: findLines(code, "signal.create({ token"),
    race: findLines(code, "await Promise.race"),
    ship: findLines(code, "await shipOrder(orderId)"),
    returnShipped: findLines(code, 'status: "shipped"'),
    returnTimeout: findLines(code, 'status: "timeout"'),
  };
}

function buildStepLineMap(code: string): GatewayStepLineMap {
  return {
    shipFetch: findLines(code, "await fetch("),
  };
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
            Event Gateway
          </h1>
          <p className="max-w-3xl text-lg text-gray-900">
            This pattern waits for multiple external signals (payment, inventory, fraud)
            in any order, then proceeds only when all have arrived. A single deadline
            enforces an SLA without cron jobs.
          </p>
        </header>

        <section aria-labelledby="try-it-heading" className="mb-12">
          <h2 id="try-it-heading" className="mb-4 text-2xl font-semibold tracking-tight">
            Try It
          </h2>
          <div className="rounded-lg border border-gray-400 bg-background-200 p-6">
            <EventGatewayDemo
              workflowCode={workflowCode}
              workflowHtmlLines={workflowHtmlLines}
              workflowLineMap={workflowLineMap}
              stepCode={stepCode}
              stepHtmlLines={stepHtmlLines}
              stepLineMap={stepLineMap}
            />
          </div>
        </section>
      </main>
    </div>
  );
}
