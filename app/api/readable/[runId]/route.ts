import { getRun } from "workflow/api";
import type { GalleryRouteContext } from "@/lib/demo-adapters/types";
import { jsonError } from "@/lib/http/json-error";

export async function GET(_request: Request, { params }: GalleryRouteContext) {
  const { runId } = await params;

  let run;
  try {
    run = await getRun(runId);
  } catch {
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/readable/[runId]",
        action: "run_not_found",
        runId,
      }),
    );

    return jsonError(404, "RUN_NOT_FOUND", `Run ${runId} not found`, {
      runId,
    });
  }

  console.info(
    JSON.stringify({
      level: "info",
      route: "/api/readable/[runId]",
      action: "stream_opened",
      runId,
    }),
  );

  const readable = run.getReadable();
  const encoder = new TextEncoder();
  let eventCount = 0;

  const sseStream = (readable as ReadableStream).pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        eventCount += 1;
        const data = typeof chunk === "string" ? chunk : JSON.stringify(chunk);
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      },
      flush() {
        console.info(
          JSON.stringify({
            level: "info",
            route: "/api/readable/[runId]",
            action: "stream_closed",
            runId,
            eventCount,
          }),
        );
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
