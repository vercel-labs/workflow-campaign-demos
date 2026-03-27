import { start } from "workflow/api";
import {
  orderFilter,
  type DemoConfig,
} from "@/message-filter/workflows/order-filter";
import { jsonError } from "@/lib/http/json-error";

type RequestBody = {
  config?: unknown;
};

function parseConfig(value: unknown): Partial<DemoConfig> | null {
  if (value === undefined) {
    return {};
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const config = value as Record<string, unknown>;
  const next: Partial<DemoConfig> = {};

  if (config.fraudThreshold !== undefined) {
    if (
      typeof config.fraudThreshold !== "number" ||
      !Number.isFinite(config.fraudThreshold)
    ) {
      return null;
    }
    next.fraudThreshold = config.fraudThreshold;
  }

  if (config.minAmount !== undefined) {
    if (typeof config.minAmount !== "number" || !Number.isFinite(config.minAmount)) {
      return null;
    }
    next.minAmount = config.minAmount;
  }

  if (config.allowedRegions !== undefined) {
    if (!Array.isArray(config.allowedRegions)) {
      return null;
    }
    const regions = config.allowedRegions.filter(
      (item): item is string => typeof item === "string",
    );
    if (regions.length !== config.allowedRegions.length) {
      return null;
    }
    next.allowedRegions = regions;
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
        route: "/api/message-filter",
        action: "invalid_json",
      }),
    );

    return jsonError(400, "INVALID_JSON", "Invalid JSON body");
  }

  const config = parseConfig(body.config);

  if (!config) {
    return jsonError(400, "INVALID_REQUEST", "config must be a valid partial filter config");
  }

  try {
    const run = await start(orderFilter, [config]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/message-filter",
        action: "workflow_started",
        runId: run.runId,
      }),
    );

    return Response.json(
      {
        ok: true,
        runId: run.runId,
        config,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";

    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/message-filter",
        action: "start_failed",
        error: message,
      }),
    );

    return jsonError(500, "START_FAILED", message);
  }
}
