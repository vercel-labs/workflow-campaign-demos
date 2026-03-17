import { NextResponse } from "next/server";
import { start } from "workflow/api";
import {
  hedgeRequestFlow,
  type ProviderConfig,
} from "@/workflows/hedge-request";

type RequestBody = {
  query?: unknown;
  providers?: unknown;
};

function parseProviders(value: unknown): ProviderConfig[] | null {
  if (!Array.isArray(value)) return null;

  const items: ProviderConfig[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const obj = item as Record<string, unknown>;
    if (typeof obj.name !== "string" || typeof obj.simulatedLatencyMs !== "number") return null;
    items.push({ name: obj.name, simulatedLatencyMs: obj.simulatedLatencyMs });
  }

  return items.length > 0 ? items : null;
}

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query : "translate greeting";
  const providers = parseProviders(body.providers);
  if (!providers) {
    return NextResponse.json(
      { error: "providers is required: array of { name, simulatedLatencyMs }" },
      { status: 400 }
    );
  }

  const run = await start(hedgeRequestFlow, [{ query, providers }]);

  return NextResponse.json({
    runId: run.runId,
    providerCount: providers.length,
    status: "queued",
  });
}
