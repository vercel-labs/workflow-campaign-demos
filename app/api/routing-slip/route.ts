// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { routingSlip, type SlipStage } from "@/routing-slip/workflows/routing-slip";

const VALID_STAGES: SlipStage[] = [
  "inventory",
  "payment",
  "packaging",
  "shipping",
  "notification",
];

function isSlipStage(value: unknown): value is SlipStage {
  return typeof value === "string" && VALID_STAGES.includes(value as SlipStage);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    console.warn("[routing-slip] parse_body_failed", {
      attempted: "request.json()",
      failed: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "Request body must be an object" },
      { status: 400 }
    );
  }

  const { orderId, slip } = body as {
    orderId?: unknown;
    slip?: unknown;
  };

  if (typeof orderId !== "string" || orderId.trim().length === 0) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  if (!Array.isArray(slip) || slip.length === 0 || !slip.every(isSlipStage)) {
    return NextResponse.json(
      { error: "slip must be a non-empty array of valid stages" },
      { status: 400 }
    );
  }

  try {
    const run = await start(routingSlip, [orderId.trim(), slip]);
    return NextResponse.json({ runId: run.runId });
  } catch (error) {
    console.error("[routing-slip] start_failed", {
      attempted: "start(routingSlip, [orderId, slip])",
      failed: error instanceof Error ? error.message : String(error),
      orderId,
      slipLength: slip.length,
    });
    return NextResponse.json(
      { error: "Failed to start routing slip workflow" },
      { status: 500 }
    );
  }
}
