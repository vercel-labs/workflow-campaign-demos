// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { requestReplyFlow } from "@/request-reply/workflows/request-reply";

type RequestBody = {
  requestId?: unknown;
  services?: unknown;
  timeoutMs?: unknown;
  maxAttempts?: unknown;
};

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const requestId =
    typeof body.requestId === "string" ? body.requestId.trim() : "";

  if (!requestId) {
    return NextResponse.json({ error: "requestId is required" }, { status: 400 });
  }

  const services =
    Array.isArray(body.services) && body.services.every((s: unknown) => typeof s === "string")
      ? (body.services as string[])
      : ["user-service", "inventory-service", "payment-service"];

  const timeoutMs =
    typeof body.timeoutMs === "number" && body.timeoutMs > 0
      ? body.timeoutMs
      : 800;

  const maxAttempts =
    typeof body.maxAttempts === "number" && body.maxAttempts > 0
      ? body.maxAttempts
      : 2;

  const run = await start(requestReplyFlow, [requestId, services, timeoutMs, maxAttempts]);

  return NextResponse.json({
    runId: run.runId,
    requestId,
    services,
    status: "started",
  });
}
