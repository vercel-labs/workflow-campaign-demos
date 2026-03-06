import { getWritable, sleep } from "workflow";

export type CircuitState = "closed" | "open" | "half-open";

export type CircuitEvent =
  | { type: "request_attempt"; requestNum: number; circuitState: CircuitState }
  | { type: "request_success"; requestNum: number; circuitState: CircuitState }
  | { type: "request_fail"; requestNum: number; circuitState: CircuitState }
  | { type: "circuit_open"; requestNum: number }
  | { type: "cooldown_start"; requestNum: number; cooldownMs: number }
  | { type: "cooldown_end"; requestNum: number }
  | { type: "circuit_half_open"; requestNum: number }
  | { type: "circuit_closed"; requestNum: number }
  | {
      type: "done";
      status: "recovered" | "failed";
      totalRequests: number;
      totalFailures: number;
      circuitOpened: number;
    };

export interface CircuitBreakerResult {
  serviceId: string;
  status: "recovered" | "failed";
  totalRequests: number;
  totalFailures: number;
  circuitOpened: number;
}

// Demo timing: simulate realistic request latency for the UI
const REQUEST_DELAY_MS = 500;
const COOLDOWN_MS = 3000;
const FAILURE_THRESHOLD = 3;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function circuitBreakerFlow(
  serviceId: string,
  maxRequests: number = 10,
  failStart: number = 4,
  failEnd: number = 6
): Promise<CircuitBreakerResult> {
  "use workflow";

  let state: CircuitState = "closed";
  let consecutiveFailures = 0;
  let totalRequests = 0;
  let totalFailures = 0;
  let circuitOpened = 0;

  for (let i = 1; i <= maxRequests; i++) {
    if (state === "open") {
      await emitEvent({
        type: "cooldown_start",
        requestNum: i,
        cooldownMs: COOLDOWN_MS,
      });
      await sleep(`${COOLDOWN_MS}ms`);
      state = "half-open";
      await emitEvent({ type: "cooldown_end", requestNum: i });
      await emitEvent({ type: "circuit_half_open", requestNum: i });
    }

    const success = await callPaymentService(
      serviceId,
      i,
      state,
      failStart,
      failEnd
    );
    totalRequests++;

    if (success) {
      consecutiveFailures = 0;
      if (state === "half-open") {
        state = "closed";
        await emitEvent({ type: "circuit_closed", requestNum: i });
      }
    } else {
      totalFailures++;
      consecutiveFailures++;
      if (consecutiveFailures >= FAILURE_THRESHOLD) {
        state = "open";
        circuitOpened++;
        consecutiveFailures = 0;
        await emitEvent({ type: "circuit_open", requestNum: i });
      }
    }
  }

  const result: CircuitBreakerResult = {
    serviceId,
    status: state === "closed" ? "recovered" : "failed",
    totalRequests,
    totalFailures,
    circuitOpened,
  };

  await emitEvent({
    type: "done",
    status: result.status,
    totalRequests: result.totalRequests,
    totalFailures: result.totalFailures,
    circuitOpened: result.circuitOpened,
  });

  return result;
}

async function emitEvent(event: CircuitEvent): Promise<void> {
  "use step";
  const writer = getWritable<CircuitEvent>().getWriter();
  try {
    await writer.write(event);
  } finally {
    writer.releaseLock();
  }
}

async function callPaymentService(
  serviceId: string,
  requestNum: number,
  circuitState: CircuitState,
  failStart: number,
  failEnd: number
): Promise<boolean> {
  "use step";

  const writer = getWritable<CircuitEvent>().getWriter();

  try {
    await writer.write({
      type: "request_attempt",
      requestNum,
      circuitState,
    });

    await delay(REQUEST_DELAY_MS);

    const shouldFail = requestNum >= failStart && requestNum <= failEnd;

    if (shouldFail) {
      await writer.write({
        type: "request_fail",
        requestNum,
        circuitState,
      });
      return false;
    }

    await writer.write({
      type: "request_success",
      requestNum,
      circuitState,
    });

    return true;
  } finally {
    writer.releaseLock();
  }
}
