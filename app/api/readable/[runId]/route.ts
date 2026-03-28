// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextRequest } from "next/server";
import { getRun } from "workflow/api";

type ReadableRouteContext = {
  params: Promise<{ runId: string }>;
};

function log(
  level: "info" | "warn" | "error",
  action: string,
  data: Record<string, unknown>,
) {
  const entry = {
    level,
    route: "/api/readable/[runId]",
    action,
    ...data,
  };
  if (level === "error") {
    console.error(JSON.stringify(entry));
    return;
  }
  if (level === "warn") {
    console.warn(JSON.stringify(entry));
    return;
  }
  console.log(JSON.stringify(entry));
}

function jsonError(
  status: number,
  code: string,
  message: string,
  runId: string,
) {
  return Response.json(
    { ok: false, error: { code, message }, runId },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(
  _request: NextRequest,
  { params }: ReadableRouteContext,
) {
  const { runId } = await params;
  log("info", "readable_open", { runId });

  let run;
  try {
    run = getRun(runId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Run not found";
    log("warn", "readable_run_not_found", { runId, message });
    return jsonError(404, "RUN_NOT_FOUND", message, runId);
  }

  const readable = run.getReadable();
  const encoder = new TextEncoder();
  const sseStream = (readable as ReadableStream).pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        const data =
          typeof chunk === "string" ? chunk : JSON.stringify(chunk);
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      },
      flush() {
        log("info", "readable_closed", { runId });
      },
    }),
  );

  return new Response(sseStream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
