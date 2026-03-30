// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { highlightCodeToHtmlLines } from "@/lib/code-workbench.server";

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

function buildOrchestratorMap(code: string): Record<string, number[]> {
  const lines = code.split("\n");
  const map: Record<string, number[]> = {};

  // createWebhook region (multi-line call)
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

function buildLineMap(
  code: string,
  markers: { marker: string; key: string; mode?: "line" | "block" }[],
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

export type WebhookBasicsCodeProps = {
  orchestratorHtmlLines: string[];
  orchestratorLineMap: Record<string, number[]>;
  stepHtmlLines: string[];
  stepLineMap: Record<string, number[]>;
};

export function getWebhookBasicsCodeProps(): WebhookBasicsCodeProps {
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

  return {
    orchestratorHtmlLines: highlightCodeToHtmlLines(orchestratorCode),
    orchestratorLineMap,
    stepHtmlLines: highlightCodeToHtmlLines(stepCode),
    stepLineMap,
  };
}
