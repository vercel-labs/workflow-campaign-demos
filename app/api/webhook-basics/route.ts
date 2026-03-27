import { start } from "workflow/api";
import { paymentWebhook } from "@/webhook-basics/workflows/payment-webhook";

function createError(status: number, message: string, code: string) {
  return Response.json(
    { ok: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseSseChunk(rawChunk: string): unknown | null {
  const payload = rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

async function readWebhookToken(
  readable: ReadableStream<Uint8Array<ArrayBufferLike>>
) {
  const reader = readable.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.replaceAll("\r\n", "\n").split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const event = parseSseChunk(chunk) as Record<string, unknown> | null;
        if (event?.type === "webhook_ready" && typeof event.token === "string") {
          return event.token;
        }
      }
    }

    if (buffer.trim()) {
      const event = parseSseChunk(buffer) as Record<string, unknown> | null;
      if (event?.type === "webhook_ready" && typeof event.token === "string") {
        return event.token;
      }
    }

    throw new Error("Workflow did not emit a webhook token");
  } finally {
    reader.releaseLock();
    await readable.cancel().catch(() => undefined);
  }
}

async function sendWebhookEvent(token: string, body: Record<string, unknown>) {
  const response = await fetch(`http://127.0.0.1:3000/api/webhook/${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Webhook request failed (${response.status}): ${message || response.statusText}`);
  }
}

async function seedWebhook(token: string) {
  await wait(300);
  await sendWebhookEvent(token, { type: "payment.created", amount: 1299 });
  await wait(450);
  await sendWebhookEvent(token, { type: "payment.succeeded", amount: 1299 });
  await wait(450);
  await sendWebhookEvent(token, { type: "order.completed" });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    console.info(JSON.stringify({ level: "info", route: "/api/webhook-basics", action: "invalid_json" }));
    return createError(400, "Invalid JSON body", "INVALID_JSON");
  }

  const orderId =
    typeof body.orderId === "string" ? body.orderId.trim() : "";

  if (!orderId) {
    return createError(400, "orderId is required", "INVALID_REQUEST");
  }

  try {
    const run = await start(paymentWebhook, [orderId]);
    const token = await readWebhookToken(run.readable);

    void seedWebhook(token).catch((error) => {
      console.error(
        JSON.stringify({
          level: "error",
          route: "/api/webhook-basics",
          action: "seed_failed",
          token,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/webhook-basics",
        action: "workflow_started",
        runId: run.runId,
        orderId,
        token,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, orderId, token },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/webhook-basics",
        action: "start_failed",
        orderId,
        error: message,
      }),
    );
    return createError(500, message, "START_FAILED");
  }
}
