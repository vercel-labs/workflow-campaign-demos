// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import {
  findBlockLineNumbers,
  findLineNumbers,
  highlightCodeToHtmlLines,
} from "@/lib/code-workbench.server";

const wf = `"use ${"workflow"}"`;
const st = `"use ${"step"}"`;

type ChoreographyFlowLineMap = {
  orderServicePlaceOrder: number[];
  inventoryServiceReserve: number[];
  sleepHandoff: number[];
  paymentServiceCharge: number[];
  shippingServiceShip: number[];
  compensationBranch: number[];
  finalizeOutcome: number[];
};

type ChoreographyParticipantLineMap = {
  orderService: number[];
  inventoryService: number[];
  paymentService: number[];
  shippingService: number[];
  orderServiceCompensate: number[];
  inventoryServiceCompensate: number[];
  paymentServiceCompensate: number[];
};

export type ChoreographyCodeProps = {
  flowCode: string;
  flowHtmlLines: string[];
  flowLineMap: ChoreographyFlowLineMap;
  participantCode: string;
  participantHtmlLines: string[];
  participantLineMap: ChoreographyParticipantLineMap;
};

const flowCode = `import { sleep } from "workflow";
import { FatalError } from "workflow";

export async function choreography(
  orderId: string,
  items: OrderItem[],
  failService: string | null
) {
  ${wf};

  const correlationId = \`COR-\${orderId}\`;

  // Participant 1: Order Service places the order
  const orderPlaced = await orderServicePlaceOrder(correlationId, orderId, items);

  // Participant 2: Inventory Service reacts to "order_placed"
  const inventoryResult = await inventoryServiceReserve(
    correlationId, items, failService === "inventory"
  );

  if (!inventoryResult.success) {
    // Compensation: Order Service rolls back
    await orderServiceCompensate(correlationId, orderId, "inventory_failed");
    return finalizeOutcome(correlationId, "compensated", ...);
  }

  // Durable sleep: async handoff latency between participants
  await sleep("3s");

  // Participant 3: Payment Service reacts to "inventory_reserved"
  const paymentResult = await paymentServiceCharge(
    correlationId, orderId, failService === "payment"
  );

  if (!paymentResult.success) {
    // Compensation: unwind inventory + order
    await inventoryServiceCompensate(correlationId, items, "payment_failed");
    await orderServiceCompensate(correlationId, orderId, "payment_failed");
    return finalizeOutcome(correlationId, "compensated", ...);
  }

  // Participant 4: Shipping Service reacts to "payment_processed"
  const shippingResult = await shippingServiceShip(
    correlationId, orderId, items, failService === "shipping"
  );

  if (!shippingResult.success) {
    // Compensation: unwind payment + inventory + order
    await paymentServiceCompensate(correlationId, orderId, "shipping_failed");
    await inventoryServiceCompensate(correlationId, items, "shipping_failed");
    await orderServiceCompensate(correlationId, orderId, "shipping_failed");
    return finalizeOutcome(correlationId, "compensated", ...);
  }

  // All participants succeeded
  return finalizeOutcome(correlationId, "fulfilled", ...);
}`;

const participantCode = `async function orderServicePlaceOrder(correlationId, orderId, items) {
  ${st};
  // Emit "order_placed" event for downstream participants
  // writer.write({ type: "event_emitted", event: "order_placed", ... })
  return { events: 1 };
}

async function inventoryServiceReserve(correlationId, items, simulateFail) {
  ${st};
  // React to "order_placed", reserve stock
  // On failure: emit "inventory_failed", throw FatalError
  // On success: emit "inventory_reserved"
  return { success: true, events: 2 };
}

async function paymentServiceCharge(correlationId, orderId, simulateFail) {
  ${st};
  // React to "inventory_reserved", charge payment
  // On failure: emit "payment_failed", throw FatalError
  // On success: emit "payment_processed"
  return { success: true, events: 2 };
}

async function shippingServiceShip(correlationId, orderId, items, simulateFail) {
  ${st};
  // React to "payment_processed", ship order
  // On failure: emit "shipping_failed", throw FatalError
  // On success: emit "order_shipped"
  return { success: true, events: 2 };
}

async function orderServiceCompensate(correlationId, orderId, reason) {
  ${st};
  // Roll back order placement
  return { events: 1 };
}

async function inventoryServiceCompensate(correlationId, items, reason) {
  ${st};
  // Release reserved stock
  return { events: 1 };
}

async function paymentServiceCompensate(correlationId, orderId, reason) {
  ${st};
  // Refund payment
  return { events: 1 };
}`;

function buildFlowLineMap(code: string): ChoreographyFlowLineMap {
  return {
    orderServicePlaceOrder: findLineNumbers(
      code,
      "await orderServicePlaceOrder(",
    ),
    inventoryServiceReserve: findLineNumbers(
      code,
      "await inventoryServiceReserve(",
    ),
    sleepHandoff: findLineNumbers(code, 'await sleep("3s")'),
    paymentServiceCharge: findLineNumbers(
      code,
      "await paymentServiceCharge(",
    ),
    shippingServiceShip: findLineNumbers(
      code,
      "await shippingServiceShip(",
    ),
    compensationBranch: [
      ...findBlockLineNumbers(code, "if (!inventoryResult.success)"),
      ...findBlockLineNumbers(code, "if (!paymentResult.success)"),
      ...findBlockLineNumbers(code, "if (!shippingResult.success)"),
    ],
    finalizeOutcome: findLineNumbers(code, "return finalizeOutcome("),
  };
}

function buildParticipantLineMap(
  code: string,
): ChoreographyParticipantLineMap {
  return {
    orderService: findBlockLineNumbers(
      code,
      "async function orderServicePlaceOrder(",
    ),
    inventoryService: findBlockLineNumbers(
      code,
      "async function inventoryServiceReserve(",
    ),
    paymentService: findBlockLineNumbers(
      code,
      "async function paymentServiceCharge(",
    ),
    shippingService: findBlockLineNumbers(
      code,
      "async function shippingServiceShip(",
    ),
    orderServiceCompensate: findBlockLineNumbers(
      code,
      "async function orderServiceCompensate(",
    ),
    inventoryServiceCompensate: findBlockLineNumbers(
      code,
      "async function inventoryServiceCompensate(",
    ),
    paymentServiceCompensate: findBlockLineNumbers(
      code,
      "async function paymentServiceCompensate(",
    ),
  };
}

export function getChoreographyCodeProps(): ChoreographyCodeProps {
  return {
    flowCode,
    flowHtmlLines: highlightCodeToHtmlLines(flowCode),
    flowLineMap: buildFlowLineMap(flowCode),
    participantCode,
    participantHtmlLines: highlightCodeToHtmlLines(participantCode),
    participantLineMap: buildParticipantLineMap(participantCode),
  };
}
