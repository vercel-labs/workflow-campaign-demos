// getWritable + getStepMetadata are used here to stream demo UI events.
// A production workflow wouldn't need these unless it has its own streaming UI.
import { getStepMetadata, getWritable, sleep } from "workflow";

export type OrderState =
  | "received"
  | "payment_validated"
  | "payment_failed"
  | "inventory_checked"
  | "inventory_reserved"
  | "backordered"
  | "shipped"
  | "delivery_confirmed"
  | "completed"
  | "cancelled";

export type ProcessManagerEvent =
  | { type: "state_transition"; from: OrderState; to: OrderState; step: string }
  | { type: "step_started"; step: string; message: string }
  | { type: "step_completed"; step: string; message: string }
  | { type: "step_retrying"; step: string; attempt: number }
  | { type: "branch_taken"; step: string; branch: string; reason: string }
  | { type: "sleeping"; step: string; duration: string; reason: string }
  | { type: "done"; orderId: string; finalState: OrderState; summary: OrderSummary };

type OrderSummary = {
  orderId: string;
  finalState: OrderState;
  stateTransitions: number;
  paymentMethod: string;
  itemCount: number;
  trackingId: string | null;
};

type OrderPayload = {
  orderId: string;
  items: string[];
  paymentMethod: string;
  simulatePaymentFail?: boolean;
  simulateBackorder?: boolean;
};

// Demo: simulate real-world latency so the UI can show progress.
const STEP_DELAY_MS: Record<string, number> = {
  initializeOrder: 400,
  validatePayment: 800,
  checkInventory: 600,
  reserveInventory: 500,
  shipOrder: 900,
  confirmDelivery: 700,
  completeOrder: 400,
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function processManager(
  orderId: string,
  items: string[],
  paymentMethod: string,
  simulatePaymentFail = false,
  simulateBackorder = false
): Promise<OrderSummary> {
  "use workflow";

  const order: OrderPayload = {
    orderId,
    items,
    paymentMethod,
    simulatePaymentFail,
    simulateBackorder,
  };

  let currentState: OrderState = "received";
  let stateTransitions = 0;

  // Step 1: Initialize order
  currentState = await initializeOrder(order, currentState);
  stateTransitions++;

  // Step 2: Validate payment — branches on success/failure
  const paymentResult = await validatePayment(order, currentState);
  stateTransitions++;

  if (paymentResult === "payment_failed") {
    // Branch: payment failed → cancel order
    const summary = await cancelOrder(order, paymentResult, stateTransitions);
    return summary;
  }
  currentState = paymentResult;

  // Step 3: Check inventory — branches on available/backorder
  const inventoryResult = await checkInventory(order, currentState);
  stateTransitions++;

  if (inventoryResult === "backordered") {
    // Branch: backordered → sleep and recheck
    await emitSleeping(
      "checkInventory",
      "5s",
      "Waiting for backorder restock"
    );
    await sleep("5s");

    // After sleep, recheck — inventory now available
    const recheckResult = await recheckInventory(order, "backordered");
    stateTransitions++;
    currentState = recheckResult;
  } else {
    currentState = inventoryResult;
  }

  // Step 4: Reserve inventory
  currentState = await reserveInventory(order, currentState);
  stateTransitions++;

  // Step 5: Ship order
  currentState = await shipOrder(order, currentState);
  stateTransitions++;

  // Step 6: Confirm delivery
  currentState = await confirmDelivery(order, currentState);
  stateTransitions++;

  // Step 7: Complete order
  return completeOrder(order, currentState, stateTransitions);
}

async function initializeOrder(
  order: OrderPayload,
  currentState: OrderState
): Promise<OrderState> {
  "use step";

  const writer = getWritable<ProcessManagerEvent>().getWriter();
  const { attempt } = getStepMetadata();

  try {
    if (attempt > 1) {
      await writer.write({ type: "step_retrying", step: "initializeOrder", attempt });
    }

    await writer.write({
      type: "step_started",
      step: "initializeOrder",
      message: `Initializing order ${order.orderId} with ${order.items.length} item(s)`,
    });

    await delay(STEP_DELAY_MS.initializeOrder);

    const nextState: OrderState = "received";
    await writer.write({
      type: "state_transition",
      from: currentState,
      to: nextState,
      step: "initializeOrder",
    });

    await writer.write({
      type: "step_completed",
      step: "initializeOrder",
      message: `Order ${order.orderId} initialized`,
    });

    return nextState;
  } finally {
    writer.releaseLock();
  }
}

async function validatePayment(
  order: OrderPayload,
  currentState: OrderState
): Promise<OrderState> {
  "use step";

  const writer = getWritable<ProcessManagerEvent>().getWriter();
  const { attempt } = getStepMetadata();

  try {
    if (attempt > 1) {
      await writer.write({ type: "step_retrying", step: "validatePayment", attempt });
    }

    await writer.write({
      type: "step_started",
      step: "validatePayment",
      message: `Validating ${order.paymentMethod} payment for order ${order.orderId}`,
    });

    await delay(STEP_DELAY_MS.validatePayment);

    if (order.simulatePaymentFail) {
      const nextState: OrderState = "payment_failed";
      await writer.write({
        type: "branch_taken",
        step: "validatePayment",
        branch: "payment_failed",
        reason: `Payment declined for ${order.paymentMethod}`,
      });
      await writer.write({
        type: "state_transition",
        from: currentState,
        to: nextState,
        step: "validatePayment",
      });
      return nextState;
    }

    const nextState: OrderState = "payment_validated";
    await writer.write({
      type: "state_transition",
      from: currentState,
      to: nextState,
      step: "validatePayment",
    });
    await writer.write({
      type: "step_completed",
      step: "validatePayment",
      message: `Payment validated via ${order.paymentMethod}`,
    });

    return nextState;
  } finally {
    writer.releaseLock();
  }
}

async function checkInventory(
  order: OrderPayload,
  currentState: OrderState
): Promise<OrderState> {
  "use step";

  const writer = getWritable<ProcessManagerEvent>().getWriter();
  const { attempt } = getStepMetadata();

  try {
    if (attempt > 1) {
      await writer.write({ type: "step_retrying", step: "checkInventory", attempt });
    }

    await writer.write({
      type: "step_started",
      step: "checkInventory",
      message: `Checking inventory for ${order.items.length} item(s)`,
    });

    await delay(STEP_DELAY_MS.checkInventory);

    if (order.simulateBackorder) {
      const nextState: OrderState = "backordered";
      await writer.write({
        type: "branch_taken",
        step: "checkInventory",
        branch: "backordered",
        reason: "Items temporarily out of stock, initiating backorder wait",
      });
      await writer.write({
        type: "state_transition",
        from: currentState,
        to: nextState,
        step: "checkInventory",
      });
      return nextState;
    }

    const nextState: OrderState = "inventory_checked";
    await writer.write({
      type: "state_transition",
      from: currentState,
      to: nextState,
      step: "checkInventory",
    });
    await writer.write({
      type: "step_completed",
      step: "checkInventory",
      message: "All items in stock",
    });

    return nextState;
  } finally {
    writer.releaseLock();
  }
}

async function recheckInventory(
  order: OrderPayload,
  currentState: OrderState
): Promise<OrderState> {
  "use step";

  const writer = getWritable<ProcessManagerEvent>().getWriter();

  try {
    await writer.write({
      type: "step_started",
      step: "recheckInventory",
      message: "Rechecking inventory after backorder wait",
    });

    await delay(STEP_DELAY_MS.checkInventory);

    const nextState: OrderState = "inventory_checked";
    await writer.write({
      type: "state_transition",
      from: currentState,
      to: nextState,
      step: "recheckInventory",
    });
    await writer.write({
      type: "step_completed",
      step: "recheckInventory",
      message: "Backorder resolved — items now available",
    });

    return nextState;
  } finally {
    writer.releaseLock();
  }
}

async function reserveInventory(
  order: OrderPayload,
  currentState: OrderState
): Promise<OrderState> {
  "use step";

  const writer = getWritable<ProcessManagerEvent>().getWriter();
  const { attempt } = getStepMetadata();

  try {
    if (attempt > 1) {
      await writer.write({ type: "step_retrying", step: "reserveInventory", attempt });
    }

    await writer.write({
      type: "step_started",
      step: "reserveInventory",
      message: `Reserving ${order.items.length} item(s) in warehouse`,
    });

    await delay(STEP_DELAY_MS.reserveInventory);

    const nextState: OrderState = "inventory_reserved";
    await writer.write({
      type: "state_transition",
      from: currentState,
      to: nextState,
      step: "reserveInventory",
    });
    await writer.write({
      type: "step_completed",
      step: "reserveInventory",
      message: "Inventory reserved successfully",
    });

    return nextState;
  } finally {
    writer.releaseLock();
  }
}

async function shipOrder(
  order: OrderPayload,
  currentState: OrderState
): Promise<OrderState> {
  "use step";

  const writer = getWritable<ProcessManagerEvent>().getWriter();
  const { attempt } = getStepMetadata();

  try {
    if (attempt > 1) {
      await writer.write({ type: "step_retrying", step: "shipOrder", attempt });
    }

    await writer.write({
      type: "step_started",
      step: "shipOrder",
      message: `Shipping order ${order.orderId}`,
    });

    await delay(STEP_DELAY_MS.shipOrder);

    const nextState: OrderState = "shipped";
    await writer.write({
      type: "state_transition",
      from: currentState,
      to: nextState,
      step: "shipOrder",
    });
    await writer.write({
      type: "step_completed",
      step: "shipOrder",
      message: `Order shipped — tracking: TRK-${order.orderId}-${Date.now().toString(36)}`,
    });

    return nextState;
  } finally {
    writer.releaseLock();
  }
}

async function confirmDelivery(
  order: OrderPayload,
  currentState: OrderState
): Promise<OrderState> {
  "use step";

  const writer = getWritable<ProcessManagerEvent>().getWriter();
  const { attempt } = getStepMetadata();

  try {
    if (attempt > 1) {
      await writer.write({ type: "step_retrying", step: "confirmDelivery", attempt });
    }

    await writer.write({
      type: "step_started",
      step: "confirmDelivery",
      message: "Awaiting delivery confirmation",
    });

    await delay(STEP_DELAY_MS.confirmDelivery);

    const nextState: OrderState = "delivery_confirmed";
    await writer.write({
      type: "state_transition",
      from: currentState,
      to: nextState,
      step: "confirmDelivery",
    });
    await writer.write({
      type: "step_completed",
      step: "confirmDelivery",
      message: "Delivery confirmed by recipient",
    });

    return nextState;
  } finally {
    writer.releaseLock();
  }
}

async function completeOrder(
  order: OrderPayload,
  currentState: OrderState,
  stateTransitions: number
): Promise<OrderSummary> {
  "use step";

  const writer = getWritable<ProcessManagerEvent>().getWriter();

  try {
    await writer.write({
      type: "step_started",
      step: "completeOrder",
      message: `Finalizing order ${order.orderId}`,
    });

    await delay(STEP_DELAY_MS.completeOrder);

    const nextState: OrderState = "completed";
    await writer.write({
      type: "state_transition",
      from: currentState,
      to: nextState,
      step: "completeOrder",
    });

    const summary: OrderSummary = {
      orderId: order.orderId,
      finalState: nextState,
      stateTransitions: stateTransitions + 1,
      paymentMethod: order.paymentMethod,
      itemCount: order.items.length,
      trackingId: `TRK-${order.orderId}-${Date.now().toString(36)}`,
    };

    await writer.write({
      type: "done",
      orderId: order.orderId,
      finalState: nextState,
      summary,
    });

    return summary;
  } finally {
    writer.releaseLock();
  }
}

async function cancelOrder(
  order: OrderPayload,
  currentState: OrderState,
  stateTransitions: number
): Promise<OrderSummary> {
  "use step";

  const writer = getWritable<ProcessManagerEvent>().getWriter();

  try {
    await writer.write({
      type: "step_started",
      step: "cancelOrder",
      message: `Cancelling order ${order.orderId} due to payment failure`,
    });

    await delay(STEP_DELAY_MS.completeOrder);

    const nextState: OrderState = "cancelled";
    await writer.write({
      type: "state_transition",
      from: currentState,
      to: nextState,
      step: "cancelOrder",
    });

    const summary: OrderSummary = {
      orderId: order.orderId,
      finalState: nextState,
      stateTransitions: stateTransitions + 1,
      paymentMethod: order.paymentMethod,
      itemCount: order.items.length,
      trackingId: null,
    };

    await writer.write({
      type: "done",
      orderId: order.orderId,
      finalState: nextState,
      summary,
    });

    return summary;
  } finally {
    writer.releaseLock();
  }
}

async function emitSleeping(
  step: string,
  duration: string,
  reason: string
): Promise<void> {
  "use step";
  const writer = getWritable<ProcessManagerEvent>().getWriter();
  try {
    await writer.write({ type: "sleeping", step, duration, reason });
  } finally {
    writer.releaseLock();
  }
}

emitSleeping.maxRetries = 0;
