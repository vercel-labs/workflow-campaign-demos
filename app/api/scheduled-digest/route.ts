import { start } from "workflow/api";
import {
  collectAndSendDigest,
  digestEvent,
} from "@/scheduled-digest/workflows/scheduled-digest";

function createError(status: number, message: string, code: string) {
  return Response.json(
    { ok: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function createDigestId() {
  return `digest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function seedDemoEvents(token: string) {
  const events = [
    { type: "comment.created", message: "Comment added to the thread" },
    { type: "ticket.updated", message: "Ticket priority changed to urgent" },
    { type: "invoice.paid", message: "Invoice INV-204 settled" },
  ];

  for (let index = 0; index < events.length; index += 1) {
    await wait(500 + index * 350);
    await digestEvent.resume(token, events[index]);
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    console.info(JSON.stringify({ level: "info", route: "/api/scheduled-digest", action: "invalid_json" }));
    return createError(400, "Invalid JSON body", "INVALID_JSON");
  }

  const userId =
    typeof body.userId === "string" && body.userId.trim()
      ? body.userId.trim()
      : "user_123";
  const windowMs =
    typeof body.windowMs === "number" && Number.isFinite(body.windowMs) && body.windowMs > 0
      ? Math.trunc(body.windowMs)
      : 4000;
  const digestId = createDigestId();
  const token = `digest:${digestId}`;

  try {
    const run = await start(collectAndSendDigest, [digestId, userId, windowMs]);
    void seedDemoEvents(token).catch((error) => {
      console.error(
        JSON.stringify({
          level: "error",
          route: "/api/scheduled-digest",
          action: "seed_failed",
          token,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/scheduled-digest",
        action: "workflow_started",
        runId: run.runId,
        digestId,
        userId,
        windowMs,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, digestId, token, userId, windowMs },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/scheduled-digest",
        action: "start_failed",
        digestId,
        error: message,
      }),
    );
    return createError(500, message, "START_FAILED");
  }
}
