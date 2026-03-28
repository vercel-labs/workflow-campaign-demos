// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import {
  orderSplitter,
  type LineItem,
  type DemoFailures,
} from "@/splitter/workflows/order-splitter";

type SplitterRequestBody = {
  orderId?: unknown;
  items?: unknown;
  failures?: unknown;
};

function parseItems(value: unknown): LineItem[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const items: LineItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") return null;
    const obj = raw as Record<string, unknown>;
    if (
      typeof obj.sku !== "string" ||
      typeof obj.name !== "string" ||
      typeof obj.quantity !== "number" ||
      typeof obj.warehouse !== "string"
    ) {
      return null;
    }
    items.push({
      sku: obj.sku,
      name: obj.name,
      quantity: obj.quantity,
      warehouse: obj.warehouse,
    });
  }
  return items;
}

function parseFailures(value: unknown): DemoFailures {
  if (!value || typeof value !== "object") {
    return { failIndices: [] };
  }
  const obj = value as Record<string, unknown>;
  if (!Array.isArray(obj.failIndices)) {
    return { failIndices: [] };
  }
  return {
    failIndices: obj.failIndices.filter(
      (i): i is number => typeof i === "number" && Number.isInteger(i) && i >= 0
    ),
  };
}

export async function POST(request: Request) {
  let body: SplitterRequestBody;

  try {
    body = (await request.json()) as SplitterRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const orderId =
    typeof body.orderId === "string" ? body.orderId.trim() : "";
  const items = parseItems(body.items);
  const failures = parseFailures(body.failures);

  if (!orderId) {
    return NextResponse.json(
      { error: "orderId is required" },
      { status: 400 }
    );
  }

  if (!items) {
    return NextResponse.json(
      { error: "items must be a non-empty array of {sku, name, quantity, warehouse}" },
      { status: 400 }
    );
  }

  const order = { orderId, items };
  const run = await start(orderSplitter, [order, failures]);

  return NextResponse.json({
    runId: run.runId,
    orderId,
    itemCount: items.length,
    status: "splitting",
  });
}
