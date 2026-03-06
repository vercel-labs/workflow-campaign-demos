import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { circuitBreakerFlow } from "@/workflows/circuit-breaker";

type StartRequestBody = {
  serviceId?: unknown;
  maxRequests?: unknown;
  failRange?: unknown;
};

export async function POST(request: Request) {
  let body: StartRequestBody;

  try {
    body = (await request.json()) as StartRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const serviceId =
    typeof body.serviceId === "string" ? body.serviceId.trim() : "payment-api";
  const maxRequests =
    typeof body.maxRequests === "number" ? body.maxRequests : 10;

  let failStart = 4;
  let failEnd = 6;
  if (
    Array.isArray(body.failRange) &&
    body.failRange.length === 2 &&
    typeof body.failRange[0] === "number" &&
    typeof body.failRange[1] === "number"
  ) {
    failStart = body.failRange[0];
    failEnd = body.failRange[1];
  } else if (body.failRange === undefined || body.failRange === null) {
    // No fail range means no failures
    failStart = 0;
    failEnd = 0;
  }

  const run = await start(circuitBreakerFlow, [
    serviceId,
    maxRequests,
    failStart,
    failEnd,
  ]);

  return NextResponse.json({
    runId: run.runId,
    serviceId,
    maxRequests,
    failRange: [failStart, failEnd],
    status: "running",
  });
}
