import { start } from "workflow/api";
import { choreography } from "@/choreography/workflows/choreography";

type OrderItem = { name: string; qty: number };
type FailService = "inventory" | "payment" | "shipping";

const VALID_FAIL_SERVICES = new Set<FailService>(["inventory", "payment", "shipping"]);

function createError(
  status: number,
  error: string,
  code: string,
  details?: Record<string, unknown>,
) {
  return Response.json(
    {
      ok: false,
      error: { code, message: error, details: details ?? null },
    },
    {
      status,
      headers: { "cache-control": "no-store" },
    },
  );
}

function parseItems(value: unknown): OrderItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const qty =
      typeof record.qty === "number" && Number.isFinite(record.qty) && record.qty > 0
        ? Math.trunc(record.qty)
        : 0;
    if (!name || qty < 1) {
      return [];
    }
    return [{ name, qty }];
  });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    console.info(JSON.stringify({ level: "info", route: "/api/choreography", action: "invalid_json" }));
    return createError(400, "Invalid JSON body", "INVALID_JSON");
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  if (!orderId) {
    console.info(JSON.stringify({ level: "info", route: "/api/choreography", action: "missing_order_id" }));
    return createError(400, "orderId is required", "INVALID_REQUEST");
  }

  const items = parseItems(body.items);
  if (items.length === 0) {
    console.info(JSON.stringify({ level: "info", route: "/api/choreography", action: "missing_items" }));
    return createError(400, "items must contain at least one valid item", "INVALID_REQUEST");
  }

  const failService =
    typeof body.failService === "string" && VALID_FAIL_SERVICES.has(body.failService as FailService)
      ? body.failService
      : null;

  try {
    const run = await start(choreography, [orderId, items, failService]);

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/choreography",
        action: "workflow_started",
        runId: run.runId,
        orderId,
        itemCount: items.length,
        failService,
      }),
    );

    return Response.json(
      { ok: true, runId: run.runId, orderId, items, failService, status: "running" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    console.error(
      JSON.stringify({
        level: "error",
        route: "/api/choreography",
        action: "start_failed",
        orderId,
        itemCount: items.length,
        failService,
        error: message,
      }),
    );
    return createError(500, message, "START_FAILED");
  }
}
