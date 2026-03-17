import { getWritable, sleep } from "workflow";

export type RequestReplyEvent =
  | { type: "request_sent"; requestId: string; service: string; payload: string }
  | { type: "waiting_for_reply"; requestId: string; service: string; deadline: string }
  | { type: "reply_received"; requestId: string; service: string; response: string; latencyMs: number }
  | { type: "timeout"; requestId: string; service: string; attempt: number }
  | { type: "retrying"; requestId: string; service: string; attempt: number; maxAttempts: number }
  | { type: "all_replies_collected"; requestId: string; results: Array<{ service: string; response: string }> }
  | { type: "failed"; requestId: string; service: string; reason: string }
  | { type: "done"; requestId: string; totalServices: number; successCount: number; failCount: number };

export interface RequestReplyResult {
  requestId: string;
  results: Array<{ service: string; response: string | null; success: boolean }>;
}

// Demo timing
const REQUEST_DELAY_MS = 400;
const REPLY_BASE_DELAY_MS = 600;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Simulated service responses — in production these would be real RPC calls
const SERVICE_RESPONSES: Record<string, { response: string; latencyMs: number; failOnFirstAttempt: boolean }> = {
  "user-service": { response: "user_profile={name:'Ada',plan:'pro'}", latencyMs: 350, failOnFirstAttempt: false },
  "inventory-service": { response: "stock={sku:'WF-100',qty:42}", latencyMs: 1200, failOnFirstAttempt: true },
  "payment-service": { response: "payment={method:'card',last4:'4242'}", latencyMs: 500, failOnFirstAttempt: false },
};

export async function requestReplyFlow(
  requestId: string,
  services: string[] = ["user-service", "inventory-service", "payment-service"],
  timeoutMs: number = 800,
  maxAttempts: number = 2
): Promise<RequestReplyResult> {
  "use workflow";

  const results: Array<{ service: string; response: string | null; success: boolean }> = [];

  for (const service of services) {
    const result = await sendRequest(requestId, service, `lookup:${requestId}`, timeoutMs, maxAttempts);
    results.push(result);
  }

  const successResults = results
    .filter((r) => r.success && r.response)
    .map((r) => ({ service: r.service, response: r.response! }));

  await emitEvent({
    type: "all_replies_collected",
    requestId,
    results: successResults,
  });

  await emitEvent({
    type: "done",
    requestId,
    totalServices: services.length,
    successCount: results.filter((r) => r.success).length,
    failCount: results.filter((r) => !r.success).length,
  });

  return { requestId, results };
}

async function sendRequest(
  requestId: string,
  service: string,
  payload: string,
  timeoutMs: number,
  maxAttempts: number
): Promise<{ service: string; response: string | null; success: boolean }> {
  "use step";

  const writer = getWritable<RequestReplyEvent>().getWriter();
  const serviceConfig = SERVICE_RESPONSES[service] ?? {
    response: "ok",
    latencyMs: 400,
    failOnFirstAttempt: false,
  };

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await writer.write({
        type: "request_sent",
        requestId,
        service,
        payload,
      });

      await delay(REQUEST_DELAY_MS);

      await writer.write({
        type: "waiting_for_reply",
        requestId,
        service,
        deadline: `${timeoutMs}ms`,
      });

      // Simulate: first attempt of a slow service exceeds timeout
      const simulatedLatency =
        serviceConfig.failOnFirstAttempt && attempt === 1
          ? timeoutMs + 500 // will exceed deadline
          : serviceConfig.latencyMs;

      if (simulatedLatency > timeoutMs) {
        // Timeout — service too slow
        await delay(timeoutMs);
        await writer.write({ type: "timeout", requestId, service, attempt });

        if (attempt < maxAttempts) {
          await writer.write({
            type: "retrying",
            requestId,
            service,
            attempt: attempt + 1,
            maxAttempts,
          });
        }
        continue;
      }

      // Reply arrives within deadline
      await delay(simulatedLatency);
      await writer.write({
        type: "reply_received",
        requestId,
        service,
        response: serviceConfig.response,
        latencyMs: simulatedLatency,
      });

      return { service, response: serviceConfig.response, success: true };
    }

    // Exhausted all attempts
    await writer.write({
      type: "failed",
      requestId,
      service,
      reason: `No reply after ${maxAttempts} attempts`,
    });

    return { service, response: null, success: false };
  } finally {
    writer.releaseLock();
  }
}

async function emitEvent(event: RequestReplyEvent): Promise<void> {
  "use step";
  const writer = getWritable<RequestReplyEvent>().getWriter();
  try {
    await writer.write(event);
  } finally {
    writer.releaseLock();
  }
}
