// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import {
  scatterGather,
  type ProviderId,
} from "@/scatter-gather/workflows/scatter-gather";

type RequestBody = {
  packageId?: unknown;
  failProviders?: unknown;
};

const VALID_PROVIDERS = new Set<ProviderId>(["fedex", "ups", "dhl", "usps"]);

function parseFailProviders(value: unknown): ProviderId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (p): p is ProviderId =>
      typeof p === "string" && VALID_PROVIDERS.has(p as ProviderId)
  );
}

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const packageId =
    typeof body.packageId === "string" ? body.packageId.trim() : "";
  const failProviders = parseFailProviders(body.failProviders);

  if (!packageId) {
    return NextResponse.json({ error: "packageId is required" }, { status: 400 });
  }

  const run = await start(scatterGather, [packageId, failProviders]);

  return NextResponse.json({
    runId: run.runId,
    packageId,
    failProviders,
    status: "scatter",
  });
}
