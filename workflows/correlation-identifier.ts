import { getWritable, sleep } from "workflow";

export type RequestStatus =
  | "pending"
  | "sent"
  | "awaiting_response"
  | "matched"
  | "delivered"
  | "timeout";

export type CorrelationEvent =
  | { type: "correlation_id_generated"; requestId: string; correlationId: string }
  | { type: "request_sent"; requestId: string; correlationId: string; service: string }
  | { type: "awaiting_response"; requestId: string; correlationId: string; timeoutMs: number }
  | { type: "response_received"; requestId: string; correlationId: string; responseService: string; latencyMs: number }
  | { type: "correlation_matched"; requestId: string; correlationId: string; requestPayloadHash: string; responsePayloadHash: string }
  | { type: "delivery_complete"; requestId: string; correlationId: string; destination: string }
  | { type: "timeout_expired"; requestId: string; correlationId: string }
  | { type: "done"; requestId: string; correlationId: string; status: RequestStatus; totalSteps: number };

export interface CorrelationIdentifierResult {
  requestId: string;
  correlationId: string;
  status: RequestStatus;
  totalSteps: number;
}

// Simulated external services
const SERVICES = ["payment-api", "inventory-api", "shipping-api", "notification-api"] as const;
export type ServiceName = (typeof SERVICES)[number];

// Demo timing
const GENERATE_DELAY_MS = 400;
const SEND_DELAY_MS = 600;
const RESPONSE_MIN_MS = 500;
const RESPONSE_MAX_MS = 1500;
const MATCH_DELAY_MS = 300;
const DELIVER_DELAY_MS = 400;
const RESPONSE_TIMEOUT_MS = 5000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateId(): string {
  return `corr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function hashPayload(payload: string): string {
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) - hash + payload.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

export async function correlationIdentifierFlow(
  requestId: string,
  service: ServiceName,
  payload: string
): Promise<CorrelationIdentifierResult> {
  "use workflow";

  // Step 1: Generate a unique correlation ID for this request
  const correlationId = await generateCorrelationId(requestId);

  // Step 2: Send the request with correlation ID attached
  await sendRequest(requestId, correlationId, service, payload);

  // Step 3: Await and match the async response using correlation ID
  const matched = await awaitResponse(requestId, correlationId, service, payload);

  if (!matched) {
    await emitEvent({
      type: "done",
      requestId,
      correlationId,
      status: "timeout",
      totalSteps: 3,
    });
    return { requestId, correlationId, status: "timeout", totalSteps: 3 };
  }

  // Step 4: Deliver the matched response to the caller
  await matchAndDeliver(requestId, correlationId, service, payload);

  await emitEvent({
    type: "done",
    requestId,
    correlationId,
    status: "delivered",
    totalSteps: 4,
  });

  return { requestId, correlationId, status: "delivered", totalSteps: 4 };
}

async function generateCorrelationId(requestId: string): Promise<string> {
  "use step";

  const writer = getWritable<CorrelationEvent>().getWriter();
  try {
    await delay(GENERATE_DELAY_MS);
    const correlationId = generateId();
    await writer.write({
      type: "correlation_id_generated",
      requestId,
      correlationId,
    });
    return correlationId;
  } finally {
    writer.releaseLock();
  }
}

async function sendRequest(
  requestId: string,
  correlationId: string,
  service: ServiceName,
  _payload: string
): Promise<void> {
  "use step";

  const writer = getWritable<CorrelationEvent>().getWriter();
  try {
    await delay(SEND_DELAY_MS);
    await writer.write({
      type: "request_sent",
      requestId,
      correlationId,
      service,
    });
  } finally {
    writer.releaseLock();
  }
}

async function awaitResponse(
  requestId: string,
  correlationId: string,
  _service: ServiceName,
  _payload: string
): Promise<boolean> {
  "use step";

  const writer = getWritable<CorrelationEvent>().getWriter();
  try {
    await writer.write({
      type: "awaiting_response",
      requestId,
      correlationId,
      timeoutMs: RESPONSE_TIMEOUT_MS,
    });

    // Simulate waiting for async response with durable sleep
    const responseLatency =
      RESPONSE_MIN_MS + Math.random() * (RESPONSE_MAX_MS - RESPONSE_MIN_MS);

    await sleep(`${Math.round(responseLatency)}ms`);

    // Simulate: response arrives before timeout (demo always succeeds)
    await writer.write({
      type: "response_received",
      requestId,
      correlationId,
      responseService: _service,
      latencyMs: Math.round(responseLatency),
    });

    return true;
  } finally {
    writer.releaseLock();
  }
}

async function matchAndDeliver(
  requestId: string,
  correlationId: string,
  service: ServiceName,
  payload: string
): Promise<void> {
  "use step";

  const writer = getWritable<CorrelationEvent>().getWriter();
  try {
    // Match: verify correlation ID on response matches the original request
    const requestHash = hashPayload(payload);
    const responseHash = hashPayload(`response-for-${payload}`);

    await delay(MATCH_DELAY_MS);
    await writer.write({
      type: "correlation_matched",
      requestId,
      correlationId,
      requestPayloadHash: requestHash,
      responsePayloadHash: responseHash,
    });

    // Deliver the matched response to the caller
    await delay(DELIVER_DELAY_MS);
    await writer.write({
      type: "delivery_complete",
      requestId,
      correlationId,
      destination: `${service}-callback`,
    });
  } finally {
    writer.releaseLock();
  }
}

async function emitEvent(event: CorrelationEvent): Promise<void> {
  "use step";
  const writer = getWritable<CorrelationEvent>().getWriter();
  try {
    await writer.write(event);
  } finally {
    writer.releaseLock();
  }
}
