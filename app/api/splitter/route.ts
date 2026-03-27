import { start } from "workflow/api";
import {
  orderSplitter,
  type DemoFailures,
  type LineItem,
} from "@/splitter/workflows/order-splitter";

function createError(status: number, message: string, code: string) {
  return Response.json(
    { ok: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function parseItems(value: unknown): LineItem[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const items: LineItem[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const item = entry as Record<string, unknown>;
    if (
      typeof item.sku !== "string" ||
      typeof item.name !== "string" ||
      typeof item.quantity !== "number" ||
      typeof item.warehouse !== "string"
    ) {
      return null;
    }

    items.push({
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      warehouse: item.warehouse,
    });
  }

  return items;
}

function parseFailures(value: unknown): DemoFailures {
  if (!value || typeof value !== "object") {
    return { failIndices: [] };
  }

  const failIndices = (value as Record<string, unknown>).failIndices;
  if (!Array.isArray(failIndices)) {
    return { failIndices: [] };
  }

  return {
    failIndices: failIndices.filter(
      (entry): entry is number =>
        typeof entry === "number" && Number.isInteger(entry) && entry >= 0,
    ),
  };
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    console.info(JSON.stringify({ level: "info", route: "/api/splitter", action: "invalid_json" }));
    return createError(400, "Invalid JSON body", "INVALID_JSON");
  }

  const orderId =
    typeof body.orderId === "string" ? body.orderId.trim() : "";
  const items = parseItems(body.items);
  const failures = parseFailures(body.failures);

  if (!orderId) {
    return createError(400, "orderId is required", "INVALID_REQUEST");
  }

  if (!items) {
    return createError(
      400,
      "items must be a non-empty array of {sku, name, quantity, warehouse}",
      "INVALID_REQUEST",
    );
  }

  try {
    const run = await start(orderSplitter, [{ orderId, items }, failures]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/splitter",
        action: "workflow_started",
        runId: run.runId,
        orderId,
        itemCount: items.length,
        failures: failures.failIndices,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, orderId, itemCount: items.length },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/splitter",
        action: "start_failed",
        orderId,
        error: message,
      }),
    );
    return createError(500, message, "START_FAILED");
  }
}
