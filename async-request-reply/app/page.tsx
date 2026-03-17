import { highlight } from "sugar-high";
import { AsyncRequestReplyDemo } from "./components/demo";

// Split directive strings so withWorkflow() plugin doesn't scan them.
const wf = `"use ${"workflow"}"`;
const st = `"use ${"step"}"`;

const orchestratorCode = `import { createWebhook, sleep, FatalError } from "workflow";

export async function asyncRequestReply(documentId: string) {
  ${wf};

  const correlationId = \`doc:\${documentId}\`;

  // Phase 1 — Submit verification and register webhook
  const webhook = createWebhook({ respondWith: "manual" });
  await submitVerification(documentId, correlationId, webhook.token);

  // Phase 2 — Wait for callback or timeout
  let settled = false;

  const result = await Promise.race([
    // Listen for vendor callbacks
    (async () => {
      let first = true;
      for await (const request of webhook) {
        const payload = await processCallback(request, correlationId, first);
        if (first) {
          first = false;
          settled = true;
          return { outcome: payload.status, details: payload.details };
        }
      }
      throw new FatalError("Webhook closed without callback");
    })(),
    // Heartbeat loop with timeout
    (async () => {
      let elapsed = 0;
      while (elapsed < TIMEOUT_MS && !settled) {
        await sleep(new Date(Date.now() + HEARTBEAT_MS));
        if (settled) break;
        elapsed += HEARTBEAT_MS;
      }
      if (settled) return { outcome: "timed_out", details: "Cancelled" };
      settled = true;
      return { outcome: "timed_out" };
    })(),
  ]);

  // Phase 3 — Finalize result
  await finalizeResult(result);
  return { documentId, correlationId, outcome: result.outcome };
}`;

const callbackCode = `import { resumeWebhook } from "workflow/api";

// POST /api/webhook/[token]
export async function POST(request: Request, { params }) {
  ${st};

  const { token } = await params;
  const decoded = decodeURIComponent(token);

  // resumeWebhook delivers the request to the for-await loop
  const response = await resumeWebhook(decoded, request);

  if (!response) {
    // Webhook not found or already settled (duplicate)
    return Response.json({ ok: false, duplicate: true }, { status: 409 });
  }

  return response;
}`;

// ── Pre-highlight on the server ───────────────────────────────────────
const orchestratorHtmlLines = highlight(orchestratorCode).split("\n");
const callbackHtmlLines = highlight(callbackCode).split("\n");

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

function buildOrchestratorMap(code: string): Record<string, number[]> {
  const lines = code.split("\n");
  const map: Record<string, number[]> = {};

  // createWebhook + submitVerification region
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("createWebhook(")) {
      for (let j = i; j < lines.length; j++) {
        (map.submit ??= []).push(j + 1);
        if (lines[j].includes("submitVerification(")) break;
      }
    }
  }

  // Promise.race / for-await region
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("Promise.race(")) {
      for (let j = i; j < lines.length; j++) {
        (map.wait ??= []).push(j + 1);
        if (lines[j].includes("]);")) break;
      }
    }
  }

  // for-await callback handling
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("for await")) {
      for (let j = i; j < lines.length; j++) {
        (map.callback ??= []).push(j + 1);
        if (j > i && lines[j].trim().startsWith("}") && !lines[j].includes("{")) break;
      }
    }
  }

  // timeout branch
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("timed_out")) {
      (map.timeout ??= []).push(i + 1);
    }
  }

  // finalizeResult
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("finalizeResult(")) {
      (map.callback ??= []).push(i + 1);
    }
  }

  return map;
}

const orchestratorLineMap = buildOrchestratorMap(orchestratorCode);

const callbackLineMap = buildLineMap(callbackCode, [
  { marker: "resumeWebhook", key: "resume" },
  { marker: "!response", key: "duplicate", mode: "block" },
  { marker: "return response", key: "delivered" },
]);

export default function Home() {
  return (
    <div className="min-h-screen bg-background-100 text-gray-1000 p-8">
      <main id="main-content" className="max-w-5xl mx-auto" role="main">
        {/* ── Hero ───────────────────────────────────────────────── */}
        <header className="mb-16">
          <div className="mb-4 inline-flex items-center rounded-full border border-blue-700/40 bg-blue-700/10 px-3 py-1 text-sm font-medium text-blue-700">
            Workflow DevKit Example
          </div>
          <h1 className="text-5xl font-semibold mb-6 tracking-tight text-gray-1000">
            Async Request-Reply
          </h1>
          <p className="text-gray-900 text-lg max-w-2xl leading-relaxed">
            Submit a document for third-party verification, then durably wait
            for a vendor callback {"\u2014"} or time out. The workflow sleeps at{" "}
            <strong className="text-gray-1000">zero compute</strong> while
            waiting, and the first callback wins (duplicates are ignored).
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
            <AsyncRequestReplyDemo
              orchestratorHtmlLines={orchestratorHtmlLines}
              orchestratorLineMap={orchestratorLineMap}
              callbackHtmlLines={callbackHtmlLines}
              callbackLineMap={callbackLineMap}
            />
          </div>
        </section>

        {/* ── Why this matters ────────────────────────────────────── */}
        <section aria-labelledby="contrast-heading" className="mb-16">
          <h2
            id="contrast-heading"
            className="text-2xl font-semibold mb-4 tracking-tight"
          >
            Why Not Just Poll?
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-gray-400 bg-background-200 p-6">
              <div className="text-sm font-semibold text-red-700 uppercase tracking-widest mb-3">
                Traditional
              </div>
              <p className="text-base text-gray-900 leading-relaxed">
                You submit a job, store the correlation ID in a database, then
                spin up a polling loop or cron job. Timeouts need separate
                cleanup. Duplicate callbacks need deduplication logic. The
                {"\u201C"}flow{"\u201D"} is scattered across timers, DB rows,
                and handlers.
              </p>
            </div>
            <div className="rounded-lg border border-blue-700/40 bg-blue-700/5 p-6">
              <div className="text-sm font-semibold text-blue-700 uppercase tracking-widest mb-3">
                Workflow Request-Reply
              </div>
              <p className="text-base text-gray-900 leading-relaxed">
                <code className="text-blue-700 font-mono text-sm">createWebhook()</code>{" "}
                registers a durable endpoint, then{" "}
                <code className="text-blue-700 font-mono text-sm">for await</code>{" "}
                listens for callbacks while a parallel{" "}
                <code className="text-blue-700 font-mono text-sm">sleep()</code>{" "}
                loop handles heartbeats and timeout. The workflow sleeps at zero
                compute, wakes on the first signal, and duplicates get a 409.
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
