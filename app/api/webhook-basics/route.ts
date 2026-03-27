import { resumeWebhook, start } from "workflow/api";
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

async function sendWebhookEvent(token: string, body: Record<string, unknown>) {
  await resumeWebhook(
    token,
    new Request(`https://gallery.local/api/webhook/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
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
    const token = `order:${orderId}`;

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
