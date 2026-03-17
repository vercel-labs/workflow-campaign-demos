import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { choreography } from "@/workflows/choreography";

type ChoreographyRequestBody = {
  orderId?: unknown;
  items?: unknown;
  failService?: unknown;
};

const VALID_SERVICES = new Set([
  "inventory",
  "payment",
  "shipping",
]);

export async function POST(request: Request) {
  let body: ChoreographyRequestBody;

  try {
    body = (await request.json()) as ChoreographyRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const orderId =
    typeof body.orderId === "string" ? body.orderId.trim() : "";
  const items = Array.isArray(body.items) ? body.items : [];
  const failService =
    typeof body.failService === "string" &&
    VALID_SERVICES.has(body.failService)
      ? body.failService
      : null;

  if (!orderId) {
    return NextResponse.json(
      { error: "orderId is required" },
      { status: 400 }
    );
  }

  if (items.length === 0) {
    return NextResponse.json(
      { error: "items array is required and must not be empty" },
      { status: 400 }
    );
  }

  const run = await start(choreography, [orderId, items, failService]);

  return NextResponse.json({
    runId: run.runId,
    orderId,
    items,
    failService,
    status: "choreography_started",
  });
}
