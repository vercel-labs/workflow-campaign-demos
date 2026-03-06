import { highlightCodeToHtmlLines } from "./components/code-highlight-server";
import { CircuitBreakerDemo } from "./components/demo";

const directiveUseWorkflow = `"use ${"workflow"}"`;
const directiveUseStep = `"use ${"step"}"`;

const workflowCode = `import { sleep } from "workflow";

export async function circuitBreakerFlow(serviceId: string) {
  ${directiveUseWorkflow};

  let state: CircuitState = "closed";
  let consecutiveFailures = 0;
  const failureThreshold = 3;

  for (let i = 1; i <= maxRequests; i++) {
    if (state === "open") {
      await sleep(\`${"${cooldownMs}"}ms\`);
      state = "half-open";
    }

    const success = await callPaymentService(serviceId, i, state);

    if (success) {
      consecutiveFailures = 0;
      if (state === "half-open") {
        state = "closed";
      }
    } else {
      consecutiveFailures++;
      if (consecutiveFailures >= failureThreshold) {
        state = "open";
        consecutiveFailures = 0;
      }
    }
  }

  return { serviceId, status: state === "closed" ? "recovered" : "failed" };
}`;

const stepCode = `async function callPaymentService(
  serviceId: string,
  requestNum: number,
  circuitState: CircuitState
): Promise<boolean> {
  ${directiveUseStep};

  const response = await fetch(\`https://payments.example.com/charge\`, {
    method: "POST",
    headers: { "x-circuit-state": circuitState },
    body: JSON.stringify({ serviceId, requestNum }),
  });

  if (!response.ok) {
    throw new Error(\`Payment service returned \${response.status}\`);
  }

  return true;
}`;

function buildWorkflowLineMap(code: string) {
  const lines = code.split("\n");

  const callService = lines
    .map((line, index) =>
      line.includes("await callPaymentService(") ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  const sleep = lines
    .map((line, index) => (line.includes("await sleep(") ? index + 1 : null))
    .filter((line): line is number => line !== null);

  const successReturn = lines
    .map((line, index) =>
      line.includes('"recovered"') ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  const failureReturn = lines
    .map((line, index) =>
      line.includes('"failed"') && line.includes("status:") ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  const circuitOpen = lines
    .map((line, index) =>
      line.includes('"open"') && line.includes("state =") ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  const circuitClosed = lines
    .map((line, index) =>
      line.includes('"closed"') && line.includes("state =") ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  return {
    callService,
    sleep,
    successReturn,
    failureReturn,
    circuitOpen,
    circuitClosed,
  };
}

function buildStepLineMap(code: string) {
  const lines = code.split("\n");

  const callService = lines
    .map((line, index) =>
      line.includes("const response = await fetch(") ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  const successReturn = lines
    .map((line, index) => (line.includes("return true;") ? index + 1 : null))
    .filter((line): line is number => line !== null);

  return { callService, successReturn };
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
            Circuit Breaker
          </h1>
          <p className="max-w-3xl text-lg text-gray-900">
            When a downstream service starts failing, a circuit breaker prevents
            cascading failures by fast-failing requests until the service recovers.
            This workflow tracks failures in a local variable, opens the circuit after
            a threshold, and uses durable{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">
              sleep()
            </code>{" "}
            for the cooldown period — zero compute while waiting, no Redis needed.
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
            <CircuitBreakerDemo
              workflowCode={workflowCode}
              workflowHtmlLines={workflowHtmlLines}
              workflowLineMap={workflowLineMap}
              stepCode={stepCode}
              stepHtmlLines={stepHtmlLines}
              stepLineMap={stepLineMap}
            />
          </div>
        </section>

        {/* ── Why this matters ────────────────────────────────────── */}
        <section aria-labelledby="contrast-heading" className="mb-16">
          <h2
            id="contrast-heading"
            className="text-2xl font-semibold mb-4 tracking-tight"
          >
            Why Not Just Use Redis?
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-400 bg-background-200 p-6">
              <div className="text-sm font-semibold text-red-700 uppercase tracking-widest mb-3">
                Traditional
              </div>
              <p className="text-base text-gray-900 leading-relaxed">
                You need <strong className="text-gray-1000">Redis or Memcached</strong>{" "}
                for shared circuit state, custom middleware to intercept requests,
                health-check endpoints, and a state machine spread across multiple
                services. The failure counter, cooldown timer, and half-open probe
                logic live in different codebases.
              </p>
            </div>
            <div className="rounded-lg border border-green-700/40 bg-green-700/5 p-6">
              <div className="text-sm font-semibold text-green-700 uppercase tracking-widest mb-3">
                Workflow Circuit Breaker
              </div>
              <p className="text-base text-gray-900 leading-relaxed">
                A <code className="text-green-700 font-mono text-sm">for</code> loop
                with a <code className="text-green-700 font-mono text-sm">let state</code>{" "}
                variable <strong className="text-gray-1000">is</strong> the circuit breaker.
                Each{" "}
                <code className="text-green-700 font-mono text-sm">sleep()</code> is a
                durable cooldown at zero compute. The consecutive failure counter and
                state transitions are plain local variables that survive across restarts.
              </p>
              <p className="text-sm text-gray-900 mt-3 leading-relaxed">
                No Redis. No external state store. No health-check endpoints. The
                workflow <em>is</em> the circuit breaker.
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
