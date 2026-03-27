import { start } from "workflow/api";
import {
  hedgeRequestFlow,
  type ProviderConfig,
} from "@/hedge-request/workflows/hedge-request";
import { jsonError } from "@/lib/http/json-error";

type RequestBody = {
  query?: unknown;
  providers?: unknown;
};

function parseProviders(value: unknown): ProviderConfig[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const providers: ProviderConfig[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return null;
    }

    const provider = item as Record<string, unknown>;
    const name = typeof provider.name === "string" ? provider.name.trim() : "";
    const simulatedLatencyMs =
      typeof provider.simulatedLatencyMs === "number" &&
      Number.isFinite(provider.simulatedLatencyMs) &&
      provider.simulatedLatencyMs > 0
        ? provider.simulatedLatencyMs
        : null;

    if (!name || simulatedLatencyMs === null) {
      return null;
    }

    providers.push({ name, simulatedLatencyMs });
  }

  return providers;
}

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/hedge-request",
        action: "invalid_json",
      }),
    );

    return jsonError(400, "INVALID_JSON", "Invalid JSON body");
  }

  const query =
    typeof body.query === "string" && body.query.trim().length > 0
      ? body.query.trim()
      : "translate greeting";
  const providers = parseProviders(body.providers);

  if (!providers) {
    return jsonError(
      400,
      "INVALID_REQUEST",
      "providers must be a non-empty array of { name, simulatedLatencyMs }",
    );
  }

  try {
    const run = await start(hedgeRequestFlow, [{ query, providers }]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/hedge-request",
        action: "workflow_started",
        runId: run.runId,
        providerCount: providers.length,
      }),
    );

    return Response.json(
      {
        ok: true,
        runId: run.runId,
        query,
        providers,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";

    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/hedge-request",
        action: "start_failed",
        error: message,
      }),
    );

    return jsonError(500, "START_FAILED", message);
  }
}
