import { highlight } from "sugar-high";
import { PaymentWebhookDemo } from "./components/demo";

// Split directive strings so withWorkflow() plugin doesn't scan them.
const wf = `"use ${"workflow"}"`;
const st = `"use ${"step"}"`;

const orchestratorCode = `import { createWebhook } from "workflow";

export async function paymentWebhook(orderId: string) {
  ${wf};

  const webhook = createWebhook({
    token: \`order:\${orderId}\`,
    respondWith: "manual",
  });

  const ledger: { type: string; amount?: number }[] = [];

  for await (const request of webhook) {
    const entry = await processPaymentEvent(request);
    ledger.push(entry);
    if (entry.type === "refund.created" || entry.type === "order.completed") break;
  }

  return { orderId, webhookUrl: webhook.url, ledger, status: "settled" };
}`;

const stepCode = `import { type RequestWithResponse } from "workflow";

async function processPaymentEvent(request: RequestWithResponse) {
  ${st};

  const body = await request.json().catch(() => ({}));
  const type = body?.type ?? "unknown";
  const amount = typeof body?.amount === "number" ? body.amount : undefined;

  if (type === "payment.created") {
    await request.respondWith(Response.json({ ack: true, action: "received" }));
    return { type, amount, processedAt: new Date().toISOString() };
  }

  if (type === "payment.requires_action") {
    await request.respondWith(Response.json({ ack: true, action: "awaiting customer" }));
    return { type, amount, processedAt: new Date().toISOString() };
  }

  if (type === "payment.succeeded") {
    await request.respondWith(Response.json({ ack: true, action: "captured" }));
    return { type, amount, processedAt: new Date().toISOString() };
  }

  if (type === "payment.failed") {
    await request.respondWith(Response.json({ ack: true, action: "flagged" }));
    return { type, amount, processedAt: new Date().toISOString() };
  }

  if (type === "refund.created") {
    await request.respondWith(Response.json({ ack: true, action: "refunded" }));
    return { type, amount, processedAt: new Date().toISOString() };
  }

  await request.respondWith(Response.json({ ack: true, action: "ignored" }));
  return { type, processedAt: new Date().toISOString() };
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
        for (let j = i; j < lines.length; j++) {
          group.push(j + 1);
          if (j > i && lines[j].trim() === "}") break;
        }
      } else {
        (map[key] ??= []).push(i + 1);
      }
      break;
    }
  }

  return map;
}

// Orchestrator: createWebhook region needs special handling (multi-line call)
function buildOrchestratorMap(code: string): Record<string, number[]> {
  const lines = code.split("\n");
  const map: Record<string, number[]> = {};

  // createWebhook region
  let inCreate = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("createWebhook(")) inCreate = true;
    if (inCreate) {
      (map.connect ??= []).push(i + 1);
      if (lines[i].includes("});")) inCreate = false;
    }
  }

  // for-await loop lines
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("for await")) (map.loop ??= []).push(i + 1);
    if (
      lines[i].includes("processPaymentEvent") &&
      !lines[i].includes("async function")
    )
      (map.loop ??= []).push(i + 1);
    if (lines[i].includes("ledger.push")) (map.loop ??= []).push(i + 1);
  }

  // break lines (terminal events + safety cap)
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("break;"))
      (map.breakLine ??= []).push(i + 1);
    if (lines[i].includes("return {") && lines[i].includes("orderId"))
      (map.returnResult ??= []).push(i + 1);
  }

  return map;
}

const orchestratorLineMap = buildOrchestratorMap(orchestratorCode);

const stepLineMap = buildLineMap(stepCode, [
  { marker: "request.json()", key: "parse" },
  { marker: "body?.type", key: "parse" },
  { marker: "body?.amount", key: "parse" },
  { marker: '"payment.created"', key: "payment.created", mode: "block" },
  { marker: '"payment.requires_action"', key: "payment.requires_action", mode: "block" },
  { marker: '"payment.succeeded"', key: "payment.succeeded", mode: "block" },
  { marker: '"payment.failed"', key: "payment.failed", mode: "block" },
  { marker: '"refund.created"', key: "refund.created", mode: "block" },
]);

export default function Home() {
  return (
    <div className="min-h-screen bg-background-100 text-gray-1000 p-8">
      <main id="main-content" className="max-w-5xl mx-auto" role="main">
        {/* ── Hero ───────────────────────────────────────────────── */}
        <header className="mb-16">
          <div className="mb-4 inline-flex items-center rounded-full border border-green-700/40 bg-green-700/10 px-3 py-1 text-sm font-medium text-green-700">
            Workflow DevKit Example
          </div>
          <h1 className="text-5xl font-semibold mb-6 tracking-tight text-gray-1000">
            Payment Webhook
          </h1>
          <p className="text-gray-900 text-lg max-w-2xl leading-relaxed">
            When a customer places an order, your workflow opens a durable
            webhook and tracks the payment lifecycle {"\u2014"} charges, failures,
            refunds {"\u2014"} inside a{" "}
            <code className="text-green-700 font-mono text-sm">for await</code>{" "}
            loop. It sleeps at{" "}
            <strong className="text-gray-1000">zero compute</strong> between
            events, whether they arrive seconds or weeks apart.
          </p>
        </header>

        {/* ── Demo + code (single integrated section) ──────────── */}
        <section aria-labelledby="demo-heading" className="mb-16">
          <h2
            id="demo-heading"
            className="text-2xl font-semibold mb-4 tracking-tight"
          >
            Try It
          </h2>
          <div className="bg-background-200 border border-gray-400 rounded-lg p-6">
            <PaymentWebhookDemo
              orchestratorHtmlLines={orchestratorHtmlLines}
              orchestratorLineMap={orchestratorLineMap}
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
            Why Not Just Use an Endpoint?
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-400 bg-background-200 p-6">
              <div className="text-sm font-semibold text-red-700 uppercase tracking-widest mb-3">
                Traditional
              </div>
              <p className="text-base text-gray-900 leading-relaxed">
                Each webhook hit is a <strong className="text-gray-1000">stateless HTTP handler</strong>.
                To track an order{"\u2019"}s payment lifecycle you need a database, a
                state machine, reconciliation logic, and cleanup jobs. The{" "}
                {"\u201C"}flow{"\u201D"} is scattered across handlers and DB rows.
              </p>
            </div>
            <div className="rounded-lg border border-green-700/40 bg-green-700/5 p-6">
              <div className="text-sm font-semibold text-green-700 uppercase tracking-widest mb-3">
                Workflow Webhook
              </div>
              <p className="text-base text-gray-900 leading-relaxed">
                The <code className="text-green-700 font-mono text-sm">for await</code> loop{" "}
                <strong className="text-gray-1000">expresses</strong> the state machine. Local variables like{" "}
                <code className="text-green-700 font-mono text-sm">ledger</code> persist across
                events without you managing a database. The workflow sleeps at zero compute between
                hits and the loop exits naturally when the payment settles.
              </p>
              <p className="text-sm text-gray-900 mt-3 leading-relaxed">
                In production, verify provider signatures (e.g. Stripe{"\u2019"}s{" "}
                <code className="font-mono text-xs">Stripe-Signature</code>) to
                prevent spoofed deliveries to the webhook URL.
              </p>
            </div>
          </div>
        </section>

        {/* ── Footer ─────────────────────────────────────────────── */}
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
