import { start } from "workflow/api";
import { competingConsumers } from "@/competing-consumers/workflows/competing-consumers";

function createError(
  status: number,
  error: string,
  code: string,
  details?: Record<string, unknown>,
) {
  return Response.json(
    {
      ok: false,
      error: { code, message: error, details: details ?? null },
    },
    {
      status,
      headers: { "cache-control": "no-store" },
    },
  );
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    console.info(
      JSON.stringify({ level: "info", route: "/api/competing-consumers", action: "invalid_json" }),
    );
    return createError(400, "Invalid JSON body", "INVALID_JSON");
  }

  const items = parseStringArray(body.items);
  const consumers = parseStringArray(body.consumers);
  if (items.length === 0 || consumers.length === 0) {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/competing-consumers",
        action: "invalid_request",
        itemCount: items.length,
        consumerCount: consumers.length,
      }),
    );
    return createError(
      400,
      "items and consumers must both contain at least one value",
      "INVALID_REQUEST",
    );
  }

  try {
    const run = await start(competingConsumers, [items, consumers]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/competing-consumers",
        action: "workflow_started",
        runId: run.runId,
        itemCount: items.length,
        consumerCount: consumers.length,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, items, consumers, status: "running" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/competing-consumers",
        action: "start_failed",
        itemCount: items.length,
        consumerCount: consumers.length,
        error: message,
      }),
    );
    return createError(500, message, "START_FAILED");
  }
}
