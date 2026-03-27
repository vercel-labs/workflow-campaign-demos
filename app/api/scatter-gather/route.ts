import { start } from "workflow/api";
import {
  scatterGather,
  type ProviderId,
} from "@/scatter-gather/workflows/scatter-gather";

function createError(status: number, message: string, code: string) {
  return Response.json(
    { ok: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

const VALID_PROVIDERS = new Set<ProviderId>(["fedex", "ups", "dhl", "usps"]);

function parseProviders(value: unknown): ProviderId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (provider): provider is ProviderId =>
      typeof provider === "string" &&
      VALID_PROVIDERS.has(provider as ProviderId),
  );
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    console.info(JSON.stringify({ level: "info", route: "/api/scatter-gather", action: "invalid_json" }));
    return createError(400, "Invalid JSON body", "INVALID_JSON");
  }

  const packageId =
    typeof body.packageId === "string" ? body.packageId.trim() : "";
  const failProviders = parseProviders(body.failProviders);

  if (!packageId) {
    return createError(400, "packageId is required", "INVALID_REQUEST");
  }

  try {
    const run = await start(scatterGather, [packageId, failProviders]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/scatter-gather",
        action: "workflow_started",
        runId: run.runId,
        packageId,
        failProviders,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, packageId, failProviders },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/scatter-gather",
        action: "start_failed",
        packageId,
        error: message,
      }),
    );
    return createError(500, message, "START_FAILED");
  }
}
