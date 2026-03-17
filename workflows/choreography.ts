// getWritable + getStepMetadata are used here to stream demo UI events.
// A production workflow wouldn't need these unless it has its own streaming UI.
import { getStepMetadata, getWritable, sleep } from "workflow";
import { FatalError } from "workflow";

export type ParticipantId =
  | "order-service"
  | "inventory-service"
  | "payment-service"
  | "shipping-service";

export type ChoreographyEvent =
  | { type: "event_emitted"; participant: ParticipantId; event: string; correlationId: string; message: string }
  | { type: "event_received"; participant: ParticipantId; event: string; correlationId: string; message: string }
  | { type: "step_started"; participant: ParticipantId; message: string }
  | { type: "step_completed"; participant: ParticipantId; message: string }
  | { type: "step_retrying"; participant: ParticipantId; attempt: number }
  | { type: "compensation_started"; participant: ParticipantId; reason: string; correlationId: string }
  | { type: "compensation_completed"; participant: ParticipantId; message: string; correlationId: string }
  | { type: "sleeping"; participant: ParticipantId; duration: string; reason: string }
  | { type: "done"; correlationId: string; outcome: "fulfilled" | "compensated"; summary: ChoreographySummary };

type ChoreographySummary = {
  correlationId: string;
  outcome: "fulfilled" | "compensated";
  participantsInvolved: ParticipantId[];
  eventsEmitted: number;
  trackingId: string | null;
  failedService: ParticipantId | null;
};

type OrderItem = { name: string; qty: number };

// Demo: simulate real-world latency so the UI can show progress.
const STEP_DELAY_MS: Record<string, number> = {
  orderService: 400,
  inventoryService: 700,
  paymentService: 800,
  shippingService: 600,
  compensation: 500,
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function choreography(
  orderId: string,
  items: OrderItem[],
  failService: string | null
): Promise<ChoreographySummary> {
  "use workflow";

  const correlationId = `COR-${orderId}`;
  let eventsEmitted = 0;
  const participantsInvolved: ParticipantId[] = [];

  // Participant 1: Order Service places the order and emits "order_placed"
  const orderPlaced = await orderServicePlaceOrder(correlationId, orderId, items);
  eventsEmitted += orderPlaced.events;
  participantsInvolved.push("order-service");

  // Participant 2: Inventory Service reacts to "order_placed", reserves stock
  const inventoryResult = await inventoryServiceReserve(
    correlationId,
    items,
    failService === "inventory"
  );
  eventsEmitted += inventoryResult.events;
  participantsInvolved.push("inventory-service");

  if (!inventoryResult.success) {
    // Compensation: Order Service rolls back
    const comp = await orderServiceCompensate(correlationId, orderId, "inventory_failed");
    eventsEmitted += comp.events;

    return finalizeOutcome(correlationId, "compensated", participantsInvolved, eventsEmitted, null, "inventory-service");
  }

  // Durable sleep: simulate async handoff latency between participants
  await emitSleeping("inventory-service", "3s", "Awaiting payment-service to react to inventory_reserved event");
  await sleep("3s");

  // Participant 3: Payment Service reacts to "inventory_reserved", charges customer
  const paymentResult = await paymentServiceCharge(
    correlationId,
    orderId,
    failService === "payment"
  );
  eventsEmitted += paymentResult.events;
  participantsInvolved.push("payment-service");

  if (!paymentResult.success) {
    // Compensation: Inventory Service releases stock, then Order Service rolls back
    const invComp = await inventoryServiceCompensate(correlationId, items, "payment_failed");
    eventsEmitted += invComp.events;
    const orderComp = await orderServiceCompensate(correlationId, orderId, "payment_failed");
    eventsEmitted += orderComp.events;

    return finalizeOutcome(correlationId, "compensated", participantsInvolved, eventsEmitted, null, "payment-service");
  }

  // Participant 4: Shipping Service reacts to "payment_processed", ships order
  const shippingResult = await shippingServiceShip(
    correlationId,
    orderId,
    items,
    failService === "shipping"
  );
  eventsEmitted += shippingResult.events;
  participantsInvolved.push("shipping-service");

  if (!shippingResult.success) {
    // Compensation: Payment refund, Inventory release, Order rollback
    const payComp = await paymentServiceCompensate(correlationId, orderId, "shipping_failed");
    eventsEmitted += payComp.events;
    const invComp = await inventoryServiceCompensate(correlationId, items, "shipping_failed");
    eventsEmitted += invComp.events;
    const orderComp = await orderServiceCompensate(correlationId, orderId, "shipping_failed");
    eventsEmitted += orderComp.events;

    return finalizeOutcome(correlationId, "compensated", participantsInvolved, eventsEmitted, null, "shipping-service");
  }

  // All participants succeeded — order fulfilled
  return finalizeOutcome(
    correlationId,
    "fulfilled",
    participantsInvolved,
    eventsEmitted,
    `TRK-${orderId}-${Date.now().toString(36)}`,
    null
  );
}

// ---------------------------------------------------------------------------
// Participant: Order Service
// ---------------------------------------------------------------------------

async function orderServicePlaceOrder(
  correlationId: string,
  orderId: string,
  items: OrderItem[]
): Promise<{ events: number }> {
  "use step";

  const writer = getWritable<ChoreographyEvent>().getWriter();
  const { attempt } = getStepMetadata();

  try {
    if (attempt > 1) {
      await writer.write({ type: "step_retrying", participant: "order-service", attempt });
    }

    await writer.write({
      type: "step_started",
      participant: "order-service",
      message: `Placing order ${orderId} with ${items.length} item(s)`,
    });

    await delay(STEP_DELAY_MS.orderService);

    await writer.write({
      type: "event_emitted",
      participant: "order-service",
      event: "order_placed",
      correlationId,
      message: `Order ${orderId} placed — notifying downstream participants`,
    });

    await writer.write({
      type: "step_completed",
      participant: "order-service",
      message: `Order ${orderId} accepted and order_placed event emitted`,
    });

    return { events: 1 };
  } finally {
    writer.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Participant: Inventory Service
// ---------------------------------------------------------------------------

async function inventoryServiceReserve(
  correlationId: string,
  items: OrderItem[],
  simulateFail: boolean
): Promise<{ success: boolean; events: number }> {
  "use step";

  const writer = getWritable<ChoreographyEvent>().getWriter();
  const { attempt } = getStepMetadata();

  try {
    if (attempt > 1) {
      await writer.write({ type: "step_retrying", participant: "inventory-service", attempt });
    }

    await writer.write({
      type: "event_received",
      participant: "inventory-service",
      event: "order_placed",
      correlationId,
      message: "Received order_placed — checking stock levels",
    });

    await writer.write({
      type: "step_started",
      participant: "inventory-service",
      message: `Reserving ${items.length} item(s) in warehouse`,
    });

    await delay(STEP_DELAY_MS.inventoryService);

    if (simulateFail) {
      await writer.write({
        type: "event_emitted",
        participant: "inventory-service",
        event: "inventory_failed",
        correlationId,
        message: "Insufficient stock — emitting inventory_failed event",
      });

      throw new FatalError("Inventory reservation failed: insufficient stock");
    }

    await writer.write({
      type: "event_emitted",
      participant: "inventory-service",
      event: "inventory_reserved",
      correlationId,
      message: "Stock reserved — emitting inventory_reserved event",
    });

    await writer.write({
      type: "step_completed",
      participant: "inventory-service",
      message: `${items.length} item(s) reserved successfully`,
    });

    return { success: true, events: 2 };
  } catch (err) {
    if (err instanceof FatalError) {
      return { success: false, events: 2 };
    }
    throw err;
  } finally {
    writer.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Participant: Payment Service
// ---------------------------------------------------------------------------

async function paymentServiceCharge(
  correlationId: string,
  orderId: string,
  simulateFail: boolean
): Promise<{ success: boolean; events: number }> {
  "use step";

  const writer = getWritable<ChoreographyEvent>().getWriter();
  const { attempt } = getStepMetadata();

  try {
    if (attempt > 1) {
      await writer.write({ type: "step_retrying", participant: "payment-service", attempt });
    }

    await writer.write({
      type: "event_received",
      participant: "payment-service",
      event: "inventory_reserved",
      correlationId,
      message: "Received inventory_reserved — processing payment",
    });

    await writer.write({
      type: "step_started",
      participant: "payment-service",
      message: `Charging payment for order ${orderId}`,
    });

    await delay(STEP_DELAY_MS.paymentService);

    if (simulateFail) {
      await writer.write({
        type: "event_emitted",
        participant: "payment-service",
        event: "payment_failed",
        correlationId,
        message: "Payment declined — emitting payment_failed event",
      });

      throw new FatalError("Payment processing failed: card declined");
    }

    await writer.write({
      type: "event_emitted",
      participant: "payment-service",
      event: "payment_processed",
      correlationId,
      message: "Payment charged — emitting payment_processed event",
    });

    await writer.write({
      type: "step_completed",
      participant: "payment-service",
      message: `Payment for order ${orderId} processed successfully`,
    });

    return { success: true, events: 2 };
  } catch (err) {
    if (err instanceof FatalError) {
      return { success: false, events: 2 };
    }
    throw err;
  } finally {
    writer.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Participant: Shipping Service
// ---------------------------------------------------------------------------

async function shippingServiceShip(
  correlationId: string,
  orderId: string,
  items: OrderItem[],
  simulateFail: boolean
): Promise<{ success: boolean; events: number }> {
  "use step";

  const writer = getWritable<ChoreographyEvent>().getWriter();
  const { attempt } = getStepMetadata();

  try {
    if (attempt > 1) {
      await writer.write({ type: "step_retrying", participant: "shipping-service", attempt });
    }

    await writer.write({
      type: "event_received",
      participant: "shipping-service",
      event: "payment_processed",
      correlationId,
      message: "Received payment_processed — preparing shipment",
    });

    await writer.write({
      type: "step_started",
      participant: "shipping-service",
      message: `Shipping ${items.length} item(s) for order ${orderId}`,
    });

    await delay(STEP_DELAY_MS.shippingService);

    if (simulateFail) {
      await writer.write({
        type: "event_emitted",
        participant: "shipping-service",
        event: "shipping_failed",
        correlationId,
        message: "Shipment failed — emitting shipping_failed event",
      });

      throw new FatalError("Shipping failed: carrier unavailable");
    }

    await writer.write({
      type: "event_emitted",
      participant: "shipping-service",
      event: "order_shipped",
      correlationId,
      message: `Order ${orderId} shipped — emitting order_shipped event`,
    });

    await writer.write({
      type: "step_completed",
      participant: "shipping-service",
      message: `Order ${orderId} shipped with tracking`,
    });

    return { success: true, events: 2 };
  } catch (err) {
    if (err instanceof FatalError) {
      return { success: false, events: 2 };
    }
    throw err;
  } finally {
    writer.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Compensation steps
// ---------------------------------------------------------------------------

async function orderServiceCompensate(
  correlationId: string,
  orderId: string,
  reason: string
): Promise<{ events: number }> {
  "use step";

  const writer = getWritable<ChoreographyEvent>().getWriter();

  try {
    await writer.write({
      type: "compensation_started",
      participant: "order-service",
      reason,
      correlationId,
    });

    await delay(STEP_DELAY_MS.compensation);

    await writer.write({
      type: "compensation_completed",
      participant: "order-service",
      message: `Order ${orderId} rolled back`,
      correlationId,
    });

    return { events: 1 };
  } finally {
    writer.releaseLock();
  }
}

async function inventoryServiceCompensate(
  correlationId: string,
  items: OrderItem[],
  reason: string
): Promise<{ events: number }> {
  "use step";

  const writer = getWritable<ChoreographyEvent>().getWriter();

  try {
    await writer.write({
      type: "compensation_started",
      participant: "inventory-service",
      reason,
      correlationId,
    });

    await delay(STEP_DELAY_MS.compensation);

    await writer.write({
      type: "compensation_completed",
      participant: "inventory-service",
      message: `${items.length} item(s) released back to stock`,
      correlationId,
    });

    return { events: 1 };
  } finally {
    writer.releaseLock();
  }
}

async function paymentServiceCompensate(
  correlationId: string,
  orderId: string,
  reason: string
): Promise<{ events: number }> {
  "use step";

  const writer = getWritable<ChoreographyEvent>().getWriter();

  try {
    await writer.write({
      type: "compensation_started",
      participant: "payment-service",
      reason,
      correlationId,
    });

    await delay(STEP_DELAY_MS.compensation);

    await writer.write({
      type: "compensation_completed",
      participant: "payment-service",
      message: `Payment for order ${orderId} refunded`,
      correlationId,
    });

    return { events: 1 };
  } finally {
    writer.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Finalize
// ---------------------------------------------------------------------------

async function finalizeOutcome(
  correlationId: string,
  outcome: "fulfilled" | "compensated",
  participantsInvolved: ParticipantId[],
  eventsEmitted: number,
  trackingId: string | null,
  failedService: ParticipantId | null
): Promise<ChoreographySummary> {
  "use step";

  const writer = getWritable<ChoreographyEvent>().getWriter();

  try {
    const summary: ChoreographySummary = {
      correlationId,
      outcome,
      participantsInvolved,
      eventsEmitted,
      trackingId,
      failedService,
    };

    await writer.write({
      type: "done",
      correlationId,
      outcome,
      summary,
    });

    return summary;
  } finally {
    writer.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Helper: emit sleeping event
// ---------------------------------------------------------------------------

async function emitSleeping(
  participant: ParticipantId,
  duration: string,
  reason: string
): Promise<void> {
  "use step";
  const writer = getWritable<ChoreographyEvent>().getWriter();
  try {
    await writer.write({ type: "sleeping", participant, duration, reason });
  } finally {
    writer.releaseLock();
  }
}

emitSleeping.maxRetries = 0;
