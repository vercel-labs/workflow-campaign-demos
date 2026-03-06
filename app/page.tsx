import { ApprovalDemo } from "./components/demo";
import { highlightCodeToHtmlLines } from "@/components/code-highlight-server";

const workflowCode = `import { defineHook, sleep } from "workflow";

const orderApprovalHook = defineHook<ApprovalPayload>();

export async function approvalGate(
  orderId: string,
  timeout: string = "24h"
) {
  "use ${"workflow"}";

  // Step 1 — sends the email you saw above.
  await requestApproval(orderId);

  // This token is embedded in every URL in that email.
  const hook = orderApprovalHook.create({
    token: \`order_approval:\${orderId}\`,
  });

  // Step 2 — the workflow pauses here. That's the spinner.
  // Clicking a link in the email resolves the hook.
  // If nobody clicks, sleep() wins the race.
  const result = await Promise.race([
    hook.then((payload) => ({ type: "approval", payload })),
    sleep(timeout).then(() => ({ type: "timeout", payload: null })),
  ]);

  if (result.type === "timeout") {
    await cancelOrder(orderId, "Approval timed out");
    return { orderId, status: "timeout" };
  }

  // Step 3 — the signal arrived. Fulfill or cancel.
  const { approved, comment } = result.payload!;
  if (approved) await fulfillOrder(orderId);
  else await cancelOrder(orderId, comment);
  return { orderId, status: approved ? "approved" : "rejected" };
}

// Each step is cached and retryable.
async function requestApproval(orderId: string) {
  "use ${"step"}";
  await sendEmail({ to: approver, token: \`order_approval:\${orderId}\` });
}

async function fulfillOrder(orderId: string) {
  "use ${"step"}";
  await processPayment(orderId);
  await shipItems(orderId);
}

async function cancelOrder(orderId: string, reason: string) {
  "use ${"step"}";
  await releaseInventory(orderId);
  await notifyCustomer(orderId, reason);
}`;

const workflowLinesHtml = highlightCodeToHtmlLines(workflowCode);

export default function Home() {
  return (
    <div className="min-h-screen bg-background-100 text-gray-1000 p-8">
      <main id="main-content" className="max-w-4xl mx-auto">
        <header className="mb-12">
          <div className="mb-4 inline-flex items-center rounded-full border border-blue-700/40 bg-blue-700/20 px-3 py-1 text-sm font-medium text-blue-700">
            Workflow DevKit Example
          </div>
          <h1 className="text-4xl font-semibold mb-4 tracking-tight text-gray-1000">
            Approval Gate
          </h1>
          <p className="text-gray-900 text-lg max-w-2xl">
            Your workflow needs a human to say {"\u201C"}yes.{"\u201D"} It pauses
            durably until a signal arrives. No polling, no cron, no
            database. One <code className="bg-background-200 border border-gray-300 px-2 py-0.5 rounded text-sm font-mono">Promise.race()</code>.
          </p>
        </header>

        <section aria-labelledby="how-it-works-heading" className="mb-12">
          <h2
            id="how-it-works-heading"
            className="text-2xl font-semibold mb-4 tracking-tight"
          >
            How It Works
          </h2>
          <ol
            className="bg-background-200 border border-gray-400 rounded-lg p-6 space-y-4 list-none"
            role="list"
            aria-label="Workflow steps"
          >
            <li className="flex items-start gap-4">
              <span
                className="bg-blue-700 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 text-sm font-semibold"
                aria-hidden="true"
              >
                1
              </span>
              <div>
                <h3 className="font-semibold">Order comes in</h3>
                <p className="text-gray-900">
                  The workflow starts and sends a notification with
                  a deterministic token {"\u2014"}{" "}
                  <code className="bg-background-200 border border-gray-300 px-2 py-0.5 rounded text-sm font-mono">
                    order_approval:{"{"}orderId{"}"}
                  </code>
                  . Put it in an email, wire it to a Slack action,
                  call it from a CLI. If you know the order ID, you know the token.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span
                className="bg-blue-700 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 text-sm font-semibold"
                aria-hidden="true"
              >
                2
              </span>
              <div>
                <h3 className="font-semibold">Approval vs timeout race starts</h3>
                <p className="text-gray-900">
                  One{" "}
                  <code className="bg-background-200 border border-gray-300 px-2 py-0.5 rounded text-sm font-mono">
                    Promise.race()
                  </code>
                  {" "}{"\u2014"} two durable branches run in parallel: approval hook
                  vs timeout timer. The hook resolves when someone approves,{" "}
                  <code className="bg-background-200 border border-gray-300 px-2 py-0.5 rounded text-sm font-mono">
                    sleep(&quot;24h&quot;)
                  </code>
                  {" "}resolves after 24 hours. Whichever resolves first wins.
                  The losing branch is discarded for this run.
                </p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span
                className="bg-blue-700 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0 text-sm font-semibold"
                aria-hidden="true"
              >
                3
              </span>
              <div>
                <h3 className="font-semibold">Winner locks the outcome</h3>
                <p className="text-gray-900">
                  If approval arrives first, the workflow resumes and fulfills or
                  rejects. If timeout fires first, it cancels as timed out. A late
                  approval after timeout will not change the result {"\u2014"} and a
                  timeout firing after approval is ignored too.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section aria-labelledby="try-it-heading" className="mb-12">
          <h2
            id="try-it-heading"
            className="text-2xl font-semibold mb-4 tracking-tight"
          >
            Try It
          </h2>
          <p className="text-gray-900 mb-4 text-sm">
            Submit an order, watch the workflow pause, then send the signal {"\u2014"} click
            a link or copy the curl command.
          </p>
          <div className="bg-background-200 border border-gray-400 rounded-lg p-6">
            <ApprovalDemo />
          </div>
        </section>

        <section aria-labelledby="patterns-heading" className="mb-12">
          <h2
            id="patterns-heading"
            className="text-2xl font-semibold mb-4 tracking-tight"
          >
            Why Hooks
          </h2>
          <ul className="space-y-3 text-gray-900" role="list">
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-700 flex-shrink-0 mt-0.5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>
                <strong>No polling, no cron, no database</strong> {"\u2013"} The
                workflow doesn&#39;t know who or what will resume it. Any system
                that can POST with the token works.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-700 flex-shrink-0 mt-0.5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>
                <strong>Pauses durably</strong> {"\u2013"} The workflow suspends
                with zero compute. It can wait for seconds or weeks. The sleep
                survives deploys, restarts, everything.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-700 flex-shrink-0 mt-0.5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>
                <strong>Deterministic tokens</strong> {"\u2013"} Stable across
                restarts. Derived from your data (e.g. order ID), so external
                systems can construct them without storing state.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-700 flex-shrink-0 mt-0.5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span>
                <strong>Typed payloads</strong> {"\u2013"} The data sent back to
                the workflow is typed end-to-end with{" "}
                <code className="bg-background-200 border border-gray-300 px-2 py-0.5 rounded text-sm font-mono">
                  defineHook&lt;T&gt;()
                </code>
                .
              </span>
            </li>
          </ul>
        </section>

        <section aria-labelledby="code-heading" className="mb-12">
          <h2
            id="code-heading"
            className="text-2xl font-semibold mb-4 tracking-tight"
          >
            The Code
          </h2>

          <figure>
            <figcaption className="mb-2 text-sm font-medium text-gray-1000">
              workflows/approval-gate.ts
            </figcaption>
            <pre className="overflow-x-auto rounded-md border border-gray-300 bg-background-100 p-5 text-[13px] leading-5">
              <code className="font-mono">
                {workflowLinesHtml.map((lineHtml, i) => (
                  <div
                    key={i}
                    dangerouslySetInnerHTML={{ __html: lineHtml || " " }}
                  />
                ))}
              </code>
            </pre>
          </figure>
        </section>

        <footer
          className="border-t border-gray-400 py-6 text-center text-sm text-gray-400"
          role="contentinfo"
        >
          <a
            href="https://useworkflow.dev/"
            className="underline underline-offset-2 hover:text-gray-1000 transition-colors"
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
