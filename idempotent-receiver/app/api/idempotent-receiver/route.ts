import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { idempotentReceiver } from "@/workflows/idempotent-receiver";

type RequestBody = {
  idempotencyKey?: unknown;
  amount?: unknown;
  currency?: unknown;
  description?: unknown;
};

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const idempotencyKey =
    typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
  const amount = typeof body.amount === "number" ? body.amount : 0;
  const currency =
    typeof body.currency === "string" ? body.currency.trim() : "USD";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";

  if (!idempotencyKey) {
    return NextResponse.json(
      { error: "idempotencyKey is required" },
      { status: 400 }
    );
  }

  if (amount <= 0) {
    return NextResponse.json(
      { error: "amount must be positive" },
      { status: 400 }
    );
  }

  const run = await start(idempotentReceiver, [
    idempotencyKey,
    amount,
    currency,
    description,
  ]);

  return NextResponse.json({
    runId: run.runId,
    idempotencyKey,
    amount,
    currency,
    description,
    status: "started",
  });
}
