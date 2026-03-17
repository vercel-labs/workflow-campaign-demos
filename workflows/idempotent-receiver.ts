// getWritable is used here to stream demo UI events.
// A production workflow wouldn't need this unless it has its own streaming UI.
import { getWritable } from "workflow";

export type IdempotentEvent =
  | { type: "checking_key"; idempotencyKey: string }
  | { type: "duplicate_detected"; idempotencyKey: string; cachedResult: PaymentResult }
  | { type: "processing_payment"; idempotencyKey: string; amount: number }
  | { type: "payment_processed"; idempotencyKey: string; result: PaymentResult }
  | { type: "done"; status: "completed" | "deduplicated"; idempotencyKey: string };

export type PaymentResult = {
  transactionId: string;
  amount: number;
  currency: string;
  status: "succeeded";
  processedAt: string;
};

type PaymentInput = {
  idempotencyKey: string;
  amount: number;
  currency: string;
  description: string;
};

type IdempotentReport = {
  idempotencyKey: string;
  deduplicated: boolean;
  result: PaymentResult;
};

// Demo: in-memory store simulates durable state for idempotency checks.
// In production, this would be the workflow's built-in durable storage
// (the workflow itself is keyed by idempotencyKey via the runId).
const processedKeys = new Map<string, PaymentResult>();

const CHECK_DELAY_MS = 400;
const PROCESS_DELAY_MS = 800;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function idempotentReceiver(
  idempotencyKey: string,
  amount: number,
  currency: string,
  description: string
): Promise<IdempotentReport> {
  "use workflow";

  const cached = await checkIdempotencyKey(idempotencyKey);

  if (cached) {
    await emitDuplicateDetected(idempotencyKey, cached);
    return { idempotencyKey, deduplicated: true, result: cached };
  }

  const result = await processPayment(idempotencyKey, amount, currency, description);

  await emitCompletion(idempotencyKey);

  return { idempotencyKey, deduplicated: false, result };
}

async function checkIdempotencyKey(
  idempotencyKey: string
): Promise<PaymentResult | null> {
  "use step";
  const writer = getWritable<IdempotentEvent>().getWriter();

  try {
    await writer.write({ type: "checking_key", idempotencyKey });
    await delay(CHECK_DELAY_MS); // Demo: simulate lookup latency

    const cached = processedKeys.get(idempotencyKey) ?? null;
    return cached;
  } finally {
    writer.releaseLock();
  }
}

async function emitDuplicateDetected(
  idempotencyKey: string,
  cachedResult: PaymentResult
): Promise<void> {
  "use step";
  const writer = getWritable<IdempotentEvent>().getWriter();

  try {
    await writer.write({ type: "duplicate_detected", idempotencyKey, cachedResult });
    await delay(200); // Demo: brief pause for UI visibility
    await writer.write({ type: "done", status: "deduplicated", idempotencyKey });
  } finally {
    writer.releaseLock();
  }
}

async function processPayment(
  idempotencyKey: string,
  amount: number,
  currency: string,
  description: string
): Promise<PaymentResult> {
  "use step";
  const writer = getWritable<IdempotentEvent>().getWriter();

  try {
    await writer.write({ type: "processing_payment", idempotencyKey, amount });
    await delay(PROCESS_DELAY_MS); // Demo: simulate payment processing latency

    const result: PaymentResult = {
      transactionId: `txn_${idempotencyKey}_${Date.now()}`,
      amount,
      currency,
      status: "succeeded",
      processedAt: new Date().toISOString(),
    };

    // Store result for future deduplication
    processedKeys.set(idempotencyKey, result);

    await writer.write({ type: "payment_processed", idempotencyKey, result });

    return result;
  } finally {
    writer.releaseLock();
  }
}

async function emitCompletion(idempotencyKey: string): Promise<void> {
  "use step";
  const writer = getWritable<IdempotentEvent>().getWriter();

  try {
    await writer.write({ type: "done", status: "completed", idempotencyKey });
  } finally {
    writer.releaseLock();
  }
}
