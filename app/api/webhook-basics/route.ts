// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { paymentWebhook } from "@/webhook-basics/workflows/payment-webhook";

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const run = await start(paymentWebhook as any, [body] as any);

  return NextResponse.json({
    runId: run.runId,
    slug: "webhook-basics",
    status: "started",
  });
}
