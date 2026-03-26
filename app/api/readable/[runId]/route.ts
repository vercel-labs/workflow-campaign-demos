import { getRun } from "workflow/api";
import type { GalleryRouteContext } from "@/lib/demo-adapters/types";

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
      })
    );
    return Response.json(
      { ok: false, error: { code: "RUN_NOT_FOUND", message: `Run ${runId} not found` } },
      { status: 404 }
    );
  }

  console.info(
    JSON.stringify({
      level: "info",
      route: "/api/readable/[runId]",
      action: "stream_opened",
      runId,
    })
  );

  const readable = run.getReadable();

  const encoder = new TextEncoder();
  const sseStream = (readable as ReadableStream).pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        const data = typeof chunk === "string" ? chunk : JSON.stringify(chunk);
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      },
    })
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
