// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { generateReport } from "@/cancellable-export/workflows/report-generator";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const accountId = body.accountId;
  if (!accountId || typeof accountId !== "string") {
    return NextResponse.json(
      { ok: false, error: { code: "MISSING_ACCOUNT_ID", message: "accountId is required" } },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const systemPrompt = typeof body.systemPrompt === "string" ? body.systemPrompt : "";

  try {
    const run = await start(generateReport, [accountId, systemPrompt]);

    return NextResponse.json(
      { ok: true, runId: run.runId, accountId },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: { code: "START_FAILED", message } },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
