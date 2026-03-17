"use workflow";

import { FatalError } from "workflow";

// --- Types ---
export type Order = {
  id: string;
  amount: number;
  region: string;
  fraudScore: number;
  customer: string;
};

export type FilterVerdict = "pass" | "reject";

export type FilterEvent = {
  type: "filter_start" | "filter_check" | "filter_result" | "filter_done";
  orderId: string;
  stage?: string;
  verdict?: FilterVerdict;
  reason?: string;
  passedOrders?: Order[];
  rejectedOrders?: { order: Order; stage: string; reason: string }[];
};

export type DemoConfig = {
  fraudThreshold: number;
  minAmount: number;
  allowedRegions: string[];
};

const DEFAULT_CONFIG: DemoConfig = {
  fraudThreshold: 70,
  minAmount: 10,
  allowedRegions: ["US", "EU", "CA"],
};

const SAMPLE_ORDERS: Order[] = [
  { id: "ORD-001", amount: 250, region: "US", fraudScore: 12, customer: "Alice" },
  { id: "ORD-002", amount: 5, region: "EU", fraudScore: 8, customer: "Bob" },
  { id: "ORD-003", amount: 1200, region: "CN", fraudScore: 45, customer: "Charlie" },
  { id: "ORD-004", amount: 89, region: "US", fraudScore: 92, customer: "Diana" },
  { id: "ORD-005", amount: 430, region: "CA", fraudScore: 15, customer: "Eve" },
  { id: "ORD-006", amount: 75, region: "BR", fraudScore: 55, customer: "Frank" },
  { id: "ORD-007", amount: 3, region: "EU", fraudScore: 88, customer: "Grace" },
  { id: "ORD-008", amount: 610, region: "US", fraudScore: 5, customer: "Hank" },
];

// --- Entry point ---
export async function orderFilter(config?: Partial<DemoConfig>) {
  "use workflow";
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const orders = SAMPLE_ORDERS;

  const afterFraud = await applyFraudCheck(orders, cfg.fraudThreshold);
  const afterAmount = await applyAmountThreshold(afterFraud.passed, cfg.minAmount);
  const afterRegion = await applyRegionFilter(afterAmount.passed, cfg.allowedRegions);

  await emitResults(
    afterRegion.passed,
    [...afterFraud.rejected, ...afterAmount.rejected, ...afterRegion.rejected]
  );
}

type StageResult = {
  passed: Order[];
  rejected: { order: Order; stage: string; reason: string }[];
};

// --- Step: Fraud check ---
export async function applyFraudCheck(orders: Order[], threshold: number): Promise<StageResult> {
  "use step";
  const { getWritable } = await import("workflow");
  const writable = getWritable<FilterEvent>();
  const writer = writable.getWriter();
  const passed: Order[] = [];
  const rejected: StageResult["rejected"] = [];

  for (const order of orders) {
    await writer.write({
      type: "filter_check",
      orderId: order.id,
      stage: "fraud",
    });
    await new Promise((r) => setTimeout(r, 300));

    if (order.fraudScore > threshold) {
      rejected.push({ order, stage: "fraud", reason: `Fraud score ${order.fraudScore} > ${threshold}` });
      await writer.write({
        type: "filter_result",
        orderId: order.id,
        stage: "fraud",
        verdict: "reject",
        reason: `Fraud score ${order.fraudScore} exceeds threshold ${threshold}`,
      });
    } else {
      passed.push(order);
      await writer.write({
        type: "filter_result",
        orderId: order.id,
        stage: "fraud",
        verdict: "pass",
      });
    }
  }

  writer.close();
  return { passed, rejected };
}

// --- Step: Amount threshold ---
export async function applyAmountThreshold(orders: Order[], minAmount: number): Promise<StageResult> {
  "use step";
  const { getWritable } = await import("workflow");
  const writable = getWritable<FilterEvent>();
  const writer = writable.getWriter();
  const passed: Order[] = [];
  const rejected: StageResult["rejected"] = [];

  for (const order of orders) {
    await writer.write({
      type: "filter_check",
      orderId: order.id,
      stage: "amount",
    });
    await new Promise((r) => setTimeout(r, 300));

    if (order.amount < minAmount) {
      rejected.push({ order, stage: "amount", reason: `Amount $${order.amount} < $${minAmount}` });
      await writer.write({
        type: "filter_result",
        orderId: order.id,
        stage: "amount",
        verdict: "reject",
        reason: `Order amount $${order.amount} below minimum $${minAmount}`,
      });
    } else {
      passed.push(order);
      await writer.write({
        type: "filter_result",
        orderId: order.id,
        stage: "amount",
        verdict: "pass",
      });
    }
  }

  writer.close();
  return { passed, rejected };
}

// --- Step: Region filter ---
export async function applyRegionFilter(orders: Order[], allowedRegions: string[]): Promise<StageResult> {
  "use step";
  const { getWritable } = await import("workflow");
  const writable = getWritable<FilterEvent>();
  const writer = writable.getWriter();
  const passed: Order[] = [];
  const rejected: StageResult["rejected"] = [];

  for (const order of orders) {
    await writer.write({
      type: "filter_check",
      orderId: order.id,
      stage: "region",
    });
    await new Promise((r) => setTimeout(r, 300));

    if (!allowedRegions.includes(order.region)) {
      rejected.push({ order, stage: "region", reason: `Region ${order.region} not in ${allowedRegions.join(",")}` });
      await writer.write({
        type: "filter_result",
        orderId: order.id,
        stage: "region",
        verdict: "reject",
        reason: `Region "${order.region}" not in allowed regions [${allowedRegions.join(", ")}]`,
      });
    } else {
      passed.push(order);
      await writer.write({
        type: "filter_result",
        orderId: order.id,
        stage: "region",
        verdict: "pass",
      });
    }
  }

  writer.close();
  return { passed, rejected };
}

// --- Step: Emit final results ---
export async function emitResults(
  passedOrders: Order[],
  rejectedOrders: { order: Order; stage: string; reason: string }[]
) {
  "use step";
  const { getWritable } = await import("workflow");
  const writable = getWritable<FilterEvent>();
  const writer = writable.getWriter();

  await writer.write({
    type: "filter_done",
    orderId: "summary",
    passedOrders,
    rejectedOrders,
  });

  writer.close();
}
