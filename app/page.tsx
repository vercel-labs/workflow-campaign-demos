import { highlightCodeToHtmlLines } from "./components/code-highlight-server";
import { RateLimitDemo } from "./components/demo";

const directiveUseWorkflow = `"use ${"workflow"}"`;
const directiveUseStep = `"use ${"step"}"`;

const workflowCode = `import { RetryableError, getStepMetadata, fetch } from "workflow";

export async function syncCrmContact(contactId: string) {
  ${directiveUseWorkflow};

  const contact = await fetchContactFromCrm(contactId);
  await upsertIntoWarehouse(contactId, contact);

  return { contactId, status: "synced" };
}`;

const stepCode = `async function fetchContactFromCrm(contactId: string) {
  ${directiveUseStep};

  const { stepId, attempt } = getStepMetadata();

  const res = await fetch(\`https://crm.example.com/api/contacts/\${contactId}\`, {
    headers: {
      "Idempotency-Key": \`crm-sync:\${contactId}:\${stepId}\`,
      "X-Attempt": String(attempt),
    },
  });

  if (res.status === 429) {
    const retryAfterSec = Number(res.headers.get("Retry-After") || "3");
    throw new RetryableError("CRM rate-limited", {
      retryAfter: retryAfterSec * 1000,
    });
  }

  if (res.status >= 500) {
    throw new RetryableError("CRM temporarily unavailable", {
      retryAfter: 2000,
    });
  }

  if (!res.ok) {
    throw new Error(\`CRM request failed: \${res.status}\`);
  }

  return res.json();
}`;

function buildWorkflowLineMap(code: string) {
  const lines = code.split("\n");

  const fetchCall = lines
    .map((line, index) =>
      line.includes("await fetchContactFromCrm(") ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  const upsertCall = lines
    .map((line, index) =>
      line.includes("await upsertIntoWarehouse(") ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  const successReturn = lines
    .map((line, index) =>
      line.includes('status: "synced"') ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  return {
    fetchCall,
    upsertCall,
    successReturn,
  };
}

function buildStepLineMap(code: string) {
  const lines = code.split("\n");

  const fetchCall = lines
    .map((line, index) =>
      line.includes("const res = await fetch(") ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  const retryableErrorThrow = lines
    .map((line, index) =>
      line.includes('throw new RetryableError("CRM rate-limited"') ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  const serverErrorThrow = lines
    .map((line, index) =>
      line.includes('throw new RetryableError("CRM temporarily unavailable"') ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  const returnJson = lines
    .map((line, index) =>
      line.includes("return res.json()") ? index + 1 : null
    )
    .filter((line): line is number => line !== null);

  return { fetchCall, retryableErrorThrow, serverErrorThrow, returnJson };
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
          <div className="mb-4 inline-flex items-center rounded-full border border-amber-700/40 bg-amber-700/20 px-3 py-1 text-sm font-medium text-amber-700">
            Workflow DevKit Example
          </div>
          <h1 className="mb-4 text-4xl font-semibold tracking-tight text-gray-1000">
            Rate Limit Retry
          </h1>
          <p className="max-w-3xl text-lg text-gray-900">
            CRM APIs return{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">
              429 Too Many Requests
            </code>{" "}
            with a{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">
              Retry-After
            </code>{" "}
            header. Instead of building a retry queue, a database table, and a
            cron sweeper, throw a{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">
              RetryableError
            </code>{" "}
            and let the runtime handle scheduling. Use{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">
              getStepMetadata()
            </code>{" "}
            for idempotency keys and attempt tracking.
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
            <RateLimitDemo
              workflowCode={workflowCode}
              workflowHtmlLines={workflowHtmlLines}
              workflowLineMap={workflowLineMap}
              stepCode={stepCode}
              stepHtmlLines={stepHtmlLines}
              stepLineMap={stepLineMap}
            />
          </div>
        </section>

        <section aria-labelledby="contrast-heading" className="mb-16">
          <h2
            id="contrast-heading"
            className="text-2xl font-semibold mb-4 tracking-tight"
          >
            Why Not Just Build a Retry Queue?
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-400 bg-background-200 p-6">
              <div className="text-sm font-semibold text-red-700 uppercase tracking-widest mb-3">
                Traditional
              </div>
              <p className="text-base text-gray-900 leading-relaxed">
                You need a <strong className="text-gray-1000">delayed-job queue</strong>,
                a <strong className="text-gray-1000">database retry table</strong> tracking
                attempt counts and next-retry timestamps, and a{" "}
                <strong className="text-gray-1000">cron sweeper</strong> that periodically
                polls the table to re-enqueue jobs. Parsing{" "}
                <code className="text-gray-1000 font-mono text-sm">Retry-After</code>{" "}
                headers means custom scheduling logic scattered across three services.
              </p>
            </div>
            <div className="rounded-lg border border-green-700/40 bg-green-700/5 p-6">
              <div className="text-sm font-semibold text-green-700 uppercase tracking-widest mb-3">
                RetryableError
              </div>
              <p className="text-base text-gray-900 leading-relaxed">
                Throw{" "}
                <code className="text-green-700 font-mono text-sm">
                  new RetryableError(&quot;msg&quot;, {"{"} retryAfter: ms {"}"})
                </code>{" "}
                and the runtime schedules the retry for you. No queue, no database, no
                cron.{" "}
                <code className="text-green-700 font-mono text-sm">getStepMetadata()</code>{" "}
                gives you a stable <code className="text-green-700 font-mono text-sm">stepId</code>{" "}
                for idempotency keys and the current{" "}
                <code className="text-green-700 font-mono text-sm">attempt</code>{" "}
                number for observability.
              </p>
              <p className="text-sm text-gray-900 mt-3 leading-relaxed">
                The step function reads the{" "}
                <code className="text-gray-1000 font-mono text-sm">Retry-After</code>{" "}
                header and passes it straight to{" "}
                <code className="text-gray-1000 font-mono text-sm">RetryableError</code>.
                The runtime does the rest.
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
