import { getWritable } from "workflow";

export type SlipStage = "inventory" | "payment" | "packaging" | "shipping" | "notification";

export type SlipEvent =
  | { type: "stage_start"; stage: SlipStage; index: number }
  | { type: "stage_complete"; stage: SlipStage; index: number; message: string; durationMs: number }
  | { type: "done"; totalMs: number; stageCount: number };

export type StageResult = {
  stage: SlipStage;
  status: "completed";
  message: string;
  durationMs: number;
};

export type RoutingSlipResult = {
  status: "completed";
  orderId: string;
  stages: StageResult[];
  totalMs: number;
};

// Demo: per-stage delays so the UI shows staggered progression
const STAGE_DELAY_MS: Record<SlipStage, number> = {
  inventory: 600,
  payment: 750,
  packaging: 800,
  shipping: 900,
  notification: 650,
};

export async function routingSlip(
  orderId: string,
  slip: SlipStage[]
): Promise<RoutingSlipResult> {
  "use workflow";

  const results: StageResult[] = [];
  const startMs = Date.now();

  for (let i = 0; i < slip.length; i++) {
    const result = await processStage(orderId, slip[i], i);
    results.push(result);
  }

  const totalMs = Date.now() - startMs;
  await emitDone(totalMs, results.length);

  return {
    status: "completed",
    orderId,
    stages: results,
    totalMs,
  };
}

async function processStage(
  orderId: string,
  stage: SlipStage,
  index: number
): Promise<StageResult> {
  "use step";

  const writer = getWritable<SlipEvent>().getWriter();
  const startMs = Date.now();

  try {
    await writer.write({ type: "stage_start", stage, index });

    // Demo: simulate processing time for visualization
    await new Promise((r) => setTimeout(r, STAGE_DELAY_MS[stage]));

    const messages: Record<SlipStage, string> = {
      inventory: `Verified stock for order ${orderId}`,
      payment: `Payment processed for order ${orderId}`,
      packaging: `Package prepared for order ${orderId}`,
      shipping: `Shipment dispatched for order ${orderId}`,
      notification: `Customer notified for order ${orderId}`,
    };

    const durationMs = Date.now() - startMs;
    await writer.write({ type: "stage_complete", stage, index, message: messages[stage], durationMs });

    return {
      stage,
      status: "completed",
      message: messages[stage],
      durationMs,
    };
  } finally {
    writer.releaseLock();
  }
}

async function emitDone(totalMs: number, stageCount: number): Promise<void> {
  "use step";

  const writer = getWritable<SlipEvent>().getWriter();
  try {
    await writer.write({ type: "done", totalMs, stageCount });
  } finally {
    writer.releaseLock();
  }
}
