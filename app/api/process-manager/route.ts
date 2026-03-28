// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { processManager } from "@/process-manager/workflows/process-manager";

type ProcessManagerRequestBody = {
  orderId?: unknown;
  items?: unknown;
  paymentMethod?: unknown;
  simulatePaymentFail?: unknown;
  simulateBackorder?: unknown;
};

const VALID_PAYMENT_METHODS = new Set([
  "credit_card",
  "debit_card",
  "paypal",
  "bank_transfer",
]);

export async function POST(request: Request) {
  let body: ProcessManagerRequestBody;

  try {
    body = (await request.json()) as ProcessManagerRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const orderId =
    typeof body.orderId === "string" ? body.orderId.trim() : "";
  const paymentMethod =
    typeof body.paymentMethod === "string" &&
    VALID_PAYMENT_METHODS.has(body.paymentMethod)
      ? body.paymentMethod
      : "credit_card";

  const items = Array.isArray(body.items)
    ? body.items.filter((item): item is string => typeof item === "string")
    : [];

  const simulatePaymentFail = body.simulatePaymentFail === true;
  const simulateBackorder = body.simulateBackorder === true;

  if (!orderId) {
    return NextResponse.json(
      { error: "orderId is required" },
      { status: 400 }
    );
  }

  if (items.length === 0) {
    return NextResponse.json(
      { error: "items array must contain at least one item" },
      { status: 400 }
    );
  }

  const run = await start(processManager, [
    orderId,
    items,
    paymentMethod,
    simulatePaymentFail,
    simulateBackorder,
  ]);

  return NextResponse.json({
    runId: run.runId,
    orderId,
    items,
    paymentMethod,
    status: "processing",
  });
}
