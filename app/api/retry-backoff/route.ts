// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { retryBackoffContactSync } from "@/retry-backoff/workflows/retry-backoff";

type StartRequestBody = {
  contactId?: unknown;
  maxAttempts?: unknown;
  baseDelayMs?: unknown;
  failuresBeforeSuccess?: unknown;
};

export async function POST(request: Request) {
  let body: StartRequestBody;

  try {
    body = (await request.json()) as StartRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const contactId =
    typeof body.contactId === "string" ? body.contactId.trim() : "";
  if (!contactId) {
    return NextResponse.json(
      { error: "contactId is required" },
      { status: 400 }
    );
  }

  const maxAttempts =
    typeof body.maxAttempts === "number" &&
    Number.isInteger(body.maxAttempts) &&
    body.maxAttempts >= 1 &&
    body.maxAttempts <= 10
      ? body.maxAttempts
      : 5;

  const baseDelayMs =
    typeof body.baseDelayMs === "number" &&
    Number.isFinite(body.baseDelayMs) &&
    body.baseDelayMs >= 50 &&
    body.baseDelayMs <= 2_000
      ? Math.trunc(body.baseDelayMs)
      : 1_000;

  const failuresBeforeSuccess =
    typeof body.failuresBeforeSuccess === "number" &&
    Number.isInteger(body.failuresBeforeSuccess) &&
    body.failuresBeforeSuccess >= 0 &&
    body.failuresBeforeSuccess <= 20
      ? body.failuresBeforeSuccess
      : 2;

  const run = await start(retryBackoffContactSync, [
    contactId,
    maxAttempts,
    baseDelayMs,
    failuresBeforeSuccess,
  ]);

  return NextResponse.json({
    runId: run.runId,
    contactId,
    maxAttempts,
    baseDelayMs,
    failuresBeforeSuccess,
    status: "running",
  });
}
