import { highlight } from "sugar-high";
import { IdempotentReceiverDemo } from "./components/demo";

// Split directive strings so withWorkflow() plugin doesn't scan them.
const wf = `"use ${"workflow"}"`;
const st = `"use ${"step"}"`;

const orchestratorCode = `import { getWritable } from "workflow";

export async function idempotentReceiver(
  idempotencyKey: string,
  amount: number,
  currency: string,
  description: string
) {
  ${wf};

  const cached = await checkIdempotencyKey(idempotencyKey);

  if (cached) {
    await emitDuplicateDetected(idempotencyKey, cached);
    return { idempotencyKey, deduplicated: true, result: cached };
  }

  const result = await processPayment(
    idempotencyKey, amount, currency, description
  );

  await emitCompletion(idempotencyKey);

  return { idempotencyKey, deduplicated: false, result };
}`;

const stepCode = `async function checkIdempotencyKey(idempotencyKey: string) {
  ${st};
  const writer = getWritable().getWriter();

  try {
    await writer.write({ type: "checking_key", idempotencyKey });
    const cached = processedKeys.get(idempotencyKey) ?? null;
    return cached;
  } finally {
    writer.releaseLock();
  }
}

async function processPayment(
  idempotencyKey: string,
  amount: number,
  currency: string,
  description: string
) {
  ${st};
  const writer = getWritable().getWriter();

  try {
    await writer.write({ type: "processing_payment", idempotencyKey, amount });

    const result = {
      transactionId: \`txn_\${idempotencyKey}_\${Date.now()}\`,
      amount,
      currency,
      status: "succeeded",
      processedAt: new Date().toISOString(),
    };

    // Store result for future deduplication
    processedKeys.set(idempotencyKey, result);

    await writer.write({ type: "payment_processed", idempotencyKey, result });
    return result;
  } finally {
    writer.releaseLock();
  }
}`;

// ── Pre-highlight on the server ───────────────────────────────────────
const orchestratorHtmlLines = highlight(orchestratorCode).split("\n");
const stepHtmlLines = highlight(stepCode).split("\n");

// ── Build line maps dynamically (never hardcode line numbers) ─────────
function buildLineMap(
  code: string,
  markers: { marker: string; key: string; mode?: "line" | "block" }[]
): Record<string, number[]> {
  const lines = code.split("\n");
  const map: Record<string, number[]> = {};

  for (const { marker, key, mode } of markers) {
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].includes(marker)) continue;

      if (mode === "block") {
        const group = (map[key] ??= []);
        let depth = 0;
        let sawBrace = false;
        for (let j = i; j < lines.length; j++) {
          group.push(j + 1);
          const opens = (lines[j].match(/{/g) ?? []).length;
          const closes = (lines[j].match(/}/g) ?? []).length;
          depth += opens - closes;
          if (opens > 0) sawBrace = true;
          if (sawBrace && depth === 0) break;
        }
      } else {
        (map[key] ??= []).push(i + 1);
      }
      break;
    }
  }

  return map;
}

const orchestratorLineMap = buildLineMap(orchestratorCode, [
  { marker: "checkIdempotencyKey(", key: "checkKey" },
  { marker: "if (cached)", key: "duplicateBranch", mode: "block" },
  { marker: "const result = await processPayment(", key: "processBranch" },
  { marker: "await emitCompletion(", key: "processBranch" },
  { marker: "return { idempotencyKey, deduplicated: false", key: "returnResult" },
]);

// Also add the processPayment + emitCompletion + return lines as a group
(function expandProcessBranch() {
  const lines = orchestratorCode.split("\n");
  const group: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].includes("const result = await processPayment(") ||
      lines[i].includes("idempotencyKey, amount, currency, description") ||
      lines[i].includes("await emitCompletion(") ||
      lines[i].includes("return { idempotencyKey, deduplicated: false")
    ) {
      group.push(i + 1);
    }
    // Also capture the closing paren of processPayment call
    if (lines[i].trim() === ");" && group.length > 0 && group.length < 3) {
      group.push(i + 1);
    }
  }
  if (group.length > 0) {
    orchestratorLineMap.processBranch = group;
  }
})();

const stepLineMap = buildLineMap(stepCode, [
  { marker: "async function checkIdempotencyKey(", key: "checkKey", mode: "block" },
  { marker: "async function processPayment(", key: "processPayment", mode: "block" },
  { marker: "processedKeys.set(", key: "storeResult" },
  { marker: "payment_processed", key: "storeResult" },
]);

// emitDuplicate maps to the whole checkKey block (it's the cached path)
stepLineMap.emitDuplicate = stepLineMap.checkKey ?? [];

export default function Home() {
  return (
    <div className="min-h-screen bg-background-100 text-gray-1000 p-8">
      <main id="main-content" className="max-w-5xl mx-auto" role="main">
        <header className="mb-16">
          <div className="mb-4 inline-flex items-center rounded-full border border-blue-700/40 bg-blue-700/20 px-3 py-1 text-sm font-medium text-blue-700">
            Workflow DevKit Example
          </div>
          <h1 className="text-5xl font-semibold mb-6 tracking-tight text-gray-1000">
            Idempotent Receiver
          </h1>
          <p className="text-gray-900 text-lg max-w-2xl leading-relaxed">
            Accept a payment request with an{" "}
            <code className="text-blue-700 font-mono text-sm">
              Idempotency-Key
            </code>
            , check durable state for duplicates, and skip reprocessing if the
            key was already seen. Click{" "}
            <strong className="text-gray-1000">Send Payment</strong> then{" "}
            <strong className="text-gray-1000">Send Duplicate</strong> to see
            deduplication in the SSE log.
          </p>
        </header>

        <section aria-labelledby="demo-heading" className="mb-16">
          <h2
            id="demo-heading"
            className="text-2xl font-semibold mb-4 tracking-tight"
          >
            Try It
          </h2>
          <div className="bg-background-200 border border-gray-400 rounded-lg p-6">
            <IdempotentReceiverDemo
              orchestratorHtmlLines={orchestratorHtmlLines}
              orchestratorLineMap={orchestratorLineMap}
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
            Why Idempotency Matters
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-400 bg-background-200 p-6">
              <div className="text-sm font-semibold text-red-700 uppercase tracking-widest mb-3">
                Without Idempotency
              </div>
              <p className="text-base text-gray-900 leading-relaxed">
                Network retries, webhook redeliveries, or user double-clicks
                can trigger the same payment twice. Without deduplication you
                charge the customer multiple times and reconcile manually.
              </p>
            </div>
            <div className="rounded-lg border border-green-700/40 bg-green-700/5 p-6">
              <div className="text-sm font-semibold text-green-700 uppercase tracking-widest mb-3">
                With Workflow Idempotency
              </div>
              <p className="text-base text-gray-900 leading-relaxed">
                The workflow checks durable state for the{" "}
                <code className="text-green-700 font-mono text-sm">
                  Idempotency-Key
                </code>{" "}
                before processing. If the key exists, it returns the cached
                result instantly — no double charges, no extra compute.
                The check and store are durable steps that survive restarts.
              </p>
            </div>
          </div>
        </section>

        <footer
          className="border-t border-gray-400 py-6 text-center text-sm text-gray-900"
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
