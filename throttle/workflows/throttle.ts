import { getWritable } from "workflow";

export type ThrottleEvent =
  | { type: "config"; capacity: number; refillRate: number; requestCount: number }
  | { type: "request_received"; requestId: string; position: number }
  | { type: "token_check"; requestId: string; tokensAvailable: number }
  | { type: "request_accepted"; requestId: string; tokensRemaining: number }
  | { type: "request_rejected"; requestId: string; retryAfterMs: number }
  | { type: "token_refilled"; tokensAvailable: number }
  | { type: "done"; accepted: number; rejected: number; total: number };

export interface ThrottleResult {
  accepted: number;
  rejected: number;
  total: number;
}

export type RequestItem = {
  id: string;
  label: string;
};

export interface ThrottleInput {
  capacity: number;
  refillRate: number;
  requests: RequestItem[];
}

// Demo timing
const PROCESS_DELAY_MS = 300;
const CHECK_DELAY_MS = 200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function throttleFlow(
  input: ThrottleInput
): Promise<ThrottleResult> {
  "use workflow";

  const { capacity, refillRate, requests } = input;
  let tokens = capacity;
  let accepted = 0;
  let rejected = 0;

  await emitEvent({
    type: "config",
    capacity,
    refillRate,
    requestCount: requests.length,
  });

  for (let i = 0; i < requests.length; i++) {
    const req = requests[i];
    const hasToken = tokens > 0;

    await evaluateRequest(req, i + 1, tokens, refillRate);

    if (hasToken) {
      tokens--;
      accepted++;
    } else {
      rejected++;
    }

    // Refill: every refillRate requests, add 1 token back (simulates time passing)
    if ((i + 1) % refillRate === 0 && tokens < capacity) {
      tokens++;
      await emitEvent({ type: "token_refilled", tokensAvailable: tokens });
    }
  }

  await emitEvent({
    type: "done",
    accepted,
    rejected,
    total: requests.length,
  });

  return { accepted, rejected, total: requests.length };
}

async function evaluateRequest(
  req: RequestItem,
  position: number,
  tokens: number,
  refillRate: number
): Promise<void> {
  "use step";

  const writer = getWritable<ThrottleEvent>().getWriter();
  try {
    await writer.write({
      type: "request_received",
      requestId: req.id,
      position,
    });
    await delay(PROCESS_DELAY_MS);

    await writer.write({
      type: "token_check",
      requestId: req.id,
      tokensAvailable: tokens,
    });
    await delay(CHECK_DELAY_MS);

    if (tokens > 0) {
      await writer.write({
        type: "request_accepted",
        requestId: req.id,
        tokensRemaining: tokens - 1,
      });
    } else {
      await writer.write({
        type: "request_rejected",
        requestId: req.id,
        retryAfterMs: refillRate * 1000,
      });
    }
  } finally {
    writer.releaseLock();
  }
}

async function emitEvent(event: ThrottleEvent): Promise<void> {
  "use step";
  const writer = getWritable<ThrottleEvent>().getWriter();
  try {
    await writer.write(event);
  } finally {
    writer.releaseLock();
  }
}
