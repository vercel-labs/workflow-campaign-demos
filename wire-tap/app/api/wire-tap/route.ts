import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { wireTap } from "@/workflows/wire-tap";

type WireTapRequestBody = {
  orderId?: unknown;
  item?: unknown;
  quantity?: unknown;
};

export async function POST(request: Request) {
  let body: WireTapRequestBody;

  try {
    body = (await request.json()) as WireTapRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const orderId =
    typeof body.orderId === "string" ? body.orderId.trim() : "";
  const item =
    typeof body.item === "string" ? body.item.trim() : "";
  const quantity =
    typeof body.quantity === "number" ? body.quantity : 0;

  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  if (!item) {
    return NextResponse.json({ error: "item is required" }, { status: 400 });
  }

  if (quantity <= 0) {
    return NextResponse.json({ error: "quantity must be > 0" }, { status: 400 });
  }

  const run = await start(wireTap, [orderId, item, quantity]);

  return NextResponse.json({
    runId: run.runId,
    orderId,
    item,
    quantity,
    status: "processing",
  });
}
