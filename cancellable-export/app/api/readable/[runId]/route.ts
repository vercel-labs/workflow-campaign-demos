import { NextRequest } from "next/server";
import { getRun } from "workflow/api";

type ReadableRouteContext = {
  params: Promise<{ runId: string }>;
};

export async function GET(_request: NextRequest, { params }: ReadableRouteContext) {
  const { runId } = await params;

  let run;
  try {
    run = await getRun(runId);
  } catch {
    return Response.json(
      { ok: false, error: { code: "RUN_NOT_FOUND", message: `Run ${runId} not found` } },
      { status: 404 }
    );
  }

  const readable = run.getReadable();

  const encoder = new TextEncoder();
  let completedSections = 0;

  const sseStream = (readable as ReadableStream).pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        const data = typeof chunk === "string" ? chunk : JSON.stringify(chunk);
        // Track completed sections so we can report count on cancellation
        if (typeof chunk === "object" && chunk !== null && "type" in chunk) {
          if ((chunk as { type: string }).type === "section_done") {
            completedSections++;
          }
        }
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      },
      async flush(controller) {
        // When the stream ends, check if the run was cancelled.
        // The workflow runtime terminates the workflow between steps on cancel,
        // so no "cancelled" event is ever emitted by the workflow itself.
        // Inject a synthetic one here so the UI can react.
        try {
          const status = await run.status;
          if (status === "cancelled") {
            const cancelEvent = JSON.stringify({
              type: "cancelled",
              completedCount: completedSections,
              total: 10,
            });
            controller.enqueue(encoder.encode(`data: ${cancelEvent}\n\n`));
          }
        } catch {
          // If we can't check status, just let the stream close
        }
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
