import { start } from "workflow/api";
import { normalizer, type DemoConfig } from "@/normalizer/workflows/normalizer";
import { jsonError } from "@/lib/http/json-error";

type RequestBody = {
  config?: unknown;
};

function normalizeConfig(value: unknown): Partial<DemoConfig> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const config = value as Record<string, unknown>;
  const next: Partial<DemoConfig> = {};

  if (typeof config.strictMode === "boolean") {
    next.strictMode = config.strictMode;
  }

  return next;
}

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/normalizer",
        action: "invalid_json",
      }),
    );
    return jsonError(400, "INVALID_JSON", "Invalid JSON body");
  }

  const config = normalizeConfig(body.config);

  try {
    const run = await start(normalizer, [config]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/normalizer",
        action: "workflow_started",
        runId: run.runId,
        strictMode: config?.strictMode ?? false,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, config: config ?? null, status: "normalizing" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/normalizer",
        action: "start_failed",
        error: message,
      }),
    );
    return jsonError(500, "START_FAILED", message);
  }
}
