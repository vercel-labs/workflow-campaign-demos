import { NextResponse } from "next/server";
import { start } from "workflow/api";
import {
  correlationIdentifierFlow,
  type ServiceName,
} from "@/workflows/correlation-identifier";

type RequestBody = {
  requestId?: unknown;
  service?: unknown;
  payload?: unknown;
};

const VALID_SERVICES = new Set<ServiceName>([
  "payment-api",
  "inventory-api",
  "shipping-api",
  "notification-api",
]);

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const requestId =
    typeof body.requestId === "string" ? body.requestId.trim() : "";
  const service =
    typeof body.service === "string" && VALID_SERVICES.has(body.service as ServiceName)
      ? (body.service as ServiceName)
      : "payment-api";
  const payload =
    typeof body.payload === "string" ? body.payload.trim() : "";

  if (!requestId) {
    return NextResponse.json({ error: "requestId is required" }, { status: 400 });
  }

  if (!payload) {
    return NextResponse.json({ error: "payload is required" }, { status: 400 });
  }

  const run = await start(correlationIdentifierFlow, [requestId, service, payload]);

  return NextResponse.json({
    runId: run.runId,
    requestId,
    service,
    status: "correlating",
  });
}
