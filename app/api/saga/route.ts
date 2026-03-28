// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { subscriptionUpgradeSaga } from "@/saga/workflows/subscription-upgrade-saga";

type SagaRequestBody = {
  accountId?: unknown;
  seats?: unknown;
  failAtStep?: unknown;
};

export async function POST(request: Request) {
  let body: SagaRequestBody;

  try {
    body = (await request.json()) as SagaRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const accountId =
    typeof body.accountId === "string" ? body.accountId.trim() : "";
  const seats = typeof body.seats === "number" ? body.seats : 0;
  const failAtStep =
    body.failAtStep === 1 || body.failAtStep === 2 || body.failAtStep === 3
      ? body.failAtStep
      : null;

  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  if (seats < 1) {
    return NextResponse.json({ error: "seats must be >= 1" }, { status: 400 });
  }

  const run = await start(subscriptionUpgradeSaga, [accountId, seats, failAtStep]);

  return NextResponse.json({
    runId: run.runId,
    accountId,
    seats,
    failAtStep,
  });
}
