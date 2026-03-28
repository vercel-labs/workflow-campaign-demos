// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { transactionalOutbox } from "@/transactional-outbox/workflows/transactional-outbox";

type OutboxRequestBody = {
  orderId?: unknown;
  payload?: unknown;
};

export async function POST(request: Request) {
  let body: OutboxRequestBody;

  try {
    body = (await request.json()) as OutboxRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const orderId =
    typeof body.orderId === "string" ? body.orderId.trim() : "";
  const payload =
    typeof body.payload === "string" ? body.payload.trim() : "";

  if (!orderId) {
    return NextResponse.json({ error: "orderId is required" }, { status: 400 });
  }

  if (!payload) {
    return NextResponse.json({ error: "payload is required" }, { status: 400 });
  }

  const run = await start(transactionalOutbox, [orderId, payload]);

  return NextResponse.json({
    runId: run.runId,
    orderId,
    status: "persisting",
  });
}
