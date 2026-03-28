// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { syncCrmContact } from "@/retryable-rate-limit/workflows/retryable-rate-limit";

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_JSON", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const contactId = body.contactId;
  if (!contactId || typeof contactId !== "string") {
    return NextResponse.json(
      { ok: false, error: { code: "MISSING_FIELD", message: "contactId is required" } },
      { status: 400 }
    );
  }

  const failuresBeforeSuccess =
    typeof body.failuresBeforeSuccess === "number"
      ? Math.max(0, Math.min(4, Math.floor(body.failuresBeforeSuccess)))
      : 2;

  try {
    const run = await start(syncCrmContact, [contactId, failuresBeforeSuccess]);
    return NextResponse.json({ ok: true, runId: run.runId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: { code: "START_FAILED", message } },
      { status: 500 }
    );
  }
}
