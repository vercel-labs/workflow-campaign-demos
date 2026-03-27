import { start } from "workflow/api";
import { throttleFlow, type RequestItem } from "@/throttle/workflows/throttle";

function createError(status: number, message: string, code: string) {
  return Response.json(
    { ok: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function parseRequests(value: unknown): RequestItem[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const requests: RequestItem[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const item = entry as Record<string, unknown>;
    if (typeof item.id !== "string" || typeof item.label !== "string") {
      return null;
    }

    requests.push({ id: item.id, label: item.label });
  }

  return requests;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    console.info(JSON.stringify({ level: "info", route: "/api/throttle", action: "invalid_json" }));
    return createError(400, "Invalid JSON body", "INVALID_JSON");
  }

  const capacity =
    typeof body.capacity === "number" && Number.isFinite(body.capacity) ? body.capacity : 3;
  const refillRate =
    typeof body.refillRate === "number" && Number.isFinite(body.refillRate)
      ? body.refillRate
      : 3;
  const requests = parseRequests(body.requests);

  if (!requests) {
    return createError(
      400,
      "requests is required: array of { id, label }",
      "INVALID_REQUEST",
    );
  }

  try {
    const run = await start(throttleFlow, [{ capacity, refillRate, requests }]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/throttle",
        action: "workflow_started",
        runId: run.runId,
        capacity,
        refillRate,
        requestCount: requests.length,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, capacity, refillRate, requestCount: requests.length },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/throttle",
        action: "start_failed",
        error: message,
      }),
    );
    return createError(500, message, "START_FAILED");
  }
}
