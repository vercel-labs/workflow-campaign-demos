// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import {
  findBlockLineNumbers,
  findLineNumbers,
  highlightCodeToHtmlLines,
} from "@/lib/code-workbench.server";

const wf = `"use ${"workflow"}"`;
const st = `"use ${"step"}"`;

type AsyncRequestReplyOrchestratorLineMap = {
  submit: number[];
  wait: number[];
  callback: number[];
  timeout: number[];
};

type AsyncRequestReplyCallbackLineMap = {
  resume: number[];
  duplicate: number[];
  delivered: number[];
};

export type AsyncRequestReplyCodeProps = {
  orchestratorHtmlLines: string[];
  orchestratorLineMap: AsyncRequestReplyOrchestratorLineMap;
  callbackHtmlLines: string[];
  callbackLineMap: AsyncRequestReplyCallbackLineMap;
};

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

function buildOrchestratorLineMap(
  code: string,
): AsyncRequestReplyOrchestratorLineMap {
  const lines = code.split("\n");

  // createWebhook + submitVerification region
  const submit: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("createWebhook(")) {
      for (let j = i; j < lines.length; j++) {
        submit.push(j + 1);
        if (lines[j].includes("submitVerification(")) break;
      }
    }
  }

  // Promise.race / for-await region
  const wait: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("Promise.race(")) {
      for (let j = i; j < lines.length; j++) {
        wait.push(j + 1);
        if (lines[j].includes("]);")) break;
      }
    }
  }

  // for-await callback handling + finalizeResult
  const callback: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("for await")) {
      for (let j = i; j < lines.length; j++) {
        callback.push(j + 1);
        if (
          j > i &&
          lines[j].trim().startsWith("}") &&
          !lines[j].includes("{")
        )
          break;
      }
    }
  }
  // Also add finalizeResult to callback group
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("finalizeResult(")) {
      callback.push(i + 1);
    }
  }

  // timeout branch
  const timeout: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("timed_out")) {
      timeout.push(i + 1);
    }
  }

  return { submit, wait, callback, timeout };
}

function buildCallbackLineMap(
  code: string,
): AsyncRequestReplyCallbackLineMap {
  return {
    resume: findLineNumbers(code, "resumeWebhook"),
    duplicate: findBlockLineNumbers(code, "if (!response)"),
    delivered: findLineNumbers(code, "return response"),
  };
}

export function getAsyncRequestReplyCodeProps(): AsyncRequestReplyCodeProps {
  return {
    orchestratorHtmlLines: highlightCodeToHtmlLines(orchestratorCode),
    orchestratorLineMap: buildOrchestratorLineMap(orchestratorCode),
    callbackHtmlLines: highlightCodeToHtmlLines(callbackCode),
    callbackLineMap: buildCallbackLineMap(callbackCode),
  };
}
