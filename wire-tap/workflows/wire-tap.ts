// getWritable is used here to stream demo UI events.
// A production workflow wouldn't need this unless it has its own streaming UI.
import { getWritable } from "workflow";

// Local FatalError — prevents the SDK's automatic retry for permanent failures.
// The workflow package does not export this class, so we define it here.
class FatalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FatalError";
  }
}

export type StageName = "validate" | "enrich" | "transform" | "deliver";

export type WireTapEvent =
  | { type: "stage_start"; stage: string }
  | { type: "tap_captured"; stage: string; snapshot: Record<string, unknown> }
  | { type: "stage_done"; stage: string; durationMs: number }
  | { type: "done"; auditCount: number; totalMs: number };

type OrderPayload = {
  orderId: string;
  item: string;
  quantity: number;
  validated?: boolean;
  price?: number;
  total?: number;
  format?: string;
  deliveredTo?: string;
};

type ProcessingResult = {
  orderId: string;
  status: "completed";
  auditTrail: Array<{ stage: string; snapshot: Record<string, unknown> }>;
  totalMs: number;
};

// Demo: simulate network latency so the UI can show each stage.
const STAGE_DELAY_MS: Record<StageName, number> = {
  validate: 600,
  enrich: 800,
  transform: 500,
  deliver: 700,
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Wire Tap pattern: each processing stage is tapped — a copy of the message
// is sent to an audit channel without altering the main flow. Think of it
// as a network packet sniffer for your workflow messages.
export async function wireTap(
  orderId: string,
  item: string,
  quantity: number
): Promise<ProcessingResult> {
  "use workflow";

  const startMs = Date.now();
  const auditTrail: Array<{ stage: string; snapshot: Record<string, unknown> }> = [];

  let message: OrderPayload = { orderId, item, quantity };

  message = await validateOrder(message, auditTrail);
  message = await enrichOrder(message, auditTrail);
  message = await transformOrder(message, auditTrail);
  message = await deliverOrder(message, auditTrail);

  await emitDone(auditTrail.length, startMs);

  return {
    orderId,
    status: "completed",
    auditTrail,
    totalMs: Date.now() - startMs,
  };
}

// Each step processes the message AND taps a snapshot to the audit trail.
// The tap is non-invasive — it copies, never mutates the message it captures.

async function validateOrder(
  message: OrderPayload,
  auditTrail: Array<{ stage: string; snapshot: Record<string, unknown> }>
): Promise<OrderPayload> {
  "use step";

  const writer = getWritable<WireTapEvent>().getWriter();
  try {
    await writer.write({ type: "stage_start", stage: "validate" });
    await delay(STAGE_DELAY_MS.validate);

    if (message.quantity <= 0) {
      throw new FatalError("Invalid quantity: must be greater than 0");
    }

    const result: OrderPayload = { ...message, validated: true };

    // Wire tap: capture a snapshot without altering the flow
    const snapshot = { ...result } as unknown as Record<string, unknown>;
    auditTrail.push({ stage: "validate", snapshot });
    await writer.write({ type: "tap_captured", stage: "validate", snapshot });
    await writer.write({ type: "stage_done", stage: "validate", durationMs: STAGE_DELAY_MS.validate });

    return result;
  } finally {
    writer.releaseLock();
  }
}

async function enrichOrder(
  message: OrderPayload,
  auditTrail: Array<{ stage: string; snapshot: Record<string, unknown> }>
): Promise<OrderPayload> {
  "use step";

  const writer = getWritable<WireTapEvent>().getWriter();
  try {
    await writer.write({ type: "stage_start", stage: "enrich" });
    await delay(STAGE_DELAY_MS.enrich);

    // Simulate price lookup
    const unitPrice = 29.99;
    const result: OrderPayload = {
      ...message,
      price: unitPrice,
      total: unitPrice * message.quantity,
    };

    // Wire tap: capture enriched state
    const snapshot = { ...result } as unknown as Record<string, unknown>;
    auditTrail.push({ stage: "enrich", snapshot });
    await writer.write({ type: "tap_captured", stage: "enrich", snapshot });
    await writer.write({ type: "stage_done", stage: "enrich", durationMs: STAGE_DELAY_MS.enrich });

    return result;
  } finally {
    writer.releaseLock();
  }
}

async function transformOrder(
  message: OrderPayload,
  auditTrail: Array<{ stage: string; snapshot: Record<string, unknown> }>
): Promise<OrderPayload> {
  "use step";

  const writer = getWritable<WireTapEvent>().getWriter();
  try {
    await writer.write({ type: "stage_start", stage: "transform" });
    await delay(STAGE_DELAY_MS.transform);

    // Simulate format transformation
    const result: OrderPayload = { ...message, format: "canonical-v2" };

    // Wire tap: capture transformed state
    const snapshot = { ...result } as unknown as Record<string, unknown>;
    auditTrail.push({ stage: "transform", snapshot });
    await writer.write({ type: "tap_captured", stage: "transform", snapshot });
    await writer.write({ type: "stage_done", stage: "transform", durationMs: STAGE_DELAY_MS.transform });

    return result;
  } finally {
    writer.releaseLock();
  }
}

async function deliverOrder(
  message: OrderPayload,
  auditTrail: Array<{ stage: string; snapshot: Record<string, unknown> }>
): Promise<OrderPayload> {
  "use step";

  const writer = getWritable<WireTapEvent>().getWriter();
  try {
    await writer.write({ type: "stage_start", stage: "deliver" });
    await delay(STAGE_DELAY_MS.deliver);

    // Simulate delivery
    const result: OrderPayload = { ...message, deliveredTo: "warehouse-us-east-1" };

    // Wire tap: capture final delivery state
    const snapshot = { ...result } as unknown as Record<string, unknown>;
    auditTrail.push({ stage: "deliver", snapshot });
    await writer.write({ type: "tap_captured", stage: "deliver", snapshot });
    await writer.write({ type: "stage_done", stage: "deliver", durationMs: STAGE_DELAY_MS.deliver });

    return result;
  } finally {
    writer.releaseLock();
  }
}

async function emitDone(
  auditCount: number,
  startMs: number
): Promise<void> {
  "use step";

  const writer = getWritable<WireTapEvent>().getWriter();
  try {
    await writer.write({ type: "done", auditCount, totalMs: Date.now() - startMs });
  } finally {
    writer.releaseLock();
  }
}
