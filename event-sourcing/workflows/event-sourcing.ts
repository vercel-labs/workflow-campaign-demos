// getWritable is used here to stream demo UI events.
// A production workflow wouldn't need these unless it has its own streaming UI.
import { getWritable } from "workflow";

export type CommandType =
  | "CreateOrder"
  | "AuthorizePayment"
  | "ReserveInventory"
  | "ShipOrder"
  | "CancelOrder";

export type DomainEvent =
  | { kind: "OrderCreated"; orderId: string; timestamp: number }
  | { kind: "PaymentAuthorized"; orderId: string; amount: number; timestamp: number }
  | { kind: "InventoryReserved"; orderId: string; sku: string; timestamp: number }
  | { kind: "OrderShipped"; orderId: string; trackingId: string; timestamp: number }
  | { kind: "OrderCancelled"; orderId: string; reason: string; timestamp: number };

export type Projection = {
  orderId: string;
  status: "none" | "created" | "authorized" | "reserved" | "shipped" | "cancelled";
  paymentAuthorized: boolean;
  inventoryReserved: boolean;
  trackingId: string | null;
};

export type ESEvent =
  | { type: "command_endpoint_ready"; aggregateId: string }
  | { type: "command_received"; command: CommandType; aggregateId: string }
  | { type: "event_appended"; event: DomainEvent; index: number }
  | { type: "projection_updated"; projection: Projection }
  | { type: "invalid_command"; command: CommandType; reason: string }
  | { type: "replay_started"; eventCount: number }
  | { type: "replay_progress"; index: number; event: DomainEvent; projection: Projection }
  | { type: "replay_completed"; projection: Projection }
  | { type: "done"; eventLog: DomainEvent[]; projection: Projection };

type AggregateReport = {
  status: "done";
  aggregateId: string;
  eventLog: DomainEvent[];
  projection: Projection;
};

// Demo: simulated processing latency so the UI can show progress
const COMMAND_DELAY_MS = 300;
const REPLAY_STEP_DELAY_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emptyProjection(orderId: string): Projection {
  return {
    orderId,
    status: "none",
    paymentAuthorized: false,
    inventoryReserved: false,
    trackingId: null,
  };
}

export function applyDomainEvent(projection: Projection, event: DomainEvent): Projection {
  switch (event.kind) {
    case "OrderCreated":
      return { ...projection, status: "created" };
    case "PaymentAuthorized":
      return { ...projection, status: "authorized", paymentAuthorized: true };
    case "InventoryReserved":
      return { ...projection, status: "reserved", inventoryReserved: true };
    case "OrderShipped":
      return { ...projection, status: "shipped", trackingId: event.trackingId };
    case "OrderCancelled":
      return { ...projection, status: "cancelled" };
    default:
      return projection;
  }
}

export function validateCommand(
  command: CommandType,
  projection: Projection
): { valid: true } | { valid: false; reason: string } {
  switch (command) {
    case "CreateOrder":
      if (projection.status !== "none")
        return { valid: false, reason: "Order already exists" };
      return { valid: true };
    case "AuthorizePayment":
      if (projection.status !== "created")
        return { valid: false, reason: "Order must be created first" };
      return { valid: true };
    case "ReserveInventory":
      if (projection.status !== "authorized")
        return { valid: false, reason: "Payment must be authorized first" };
      return { valid: true };
    case "ShipOrder":
      if (projection.status !== "reserved")
        return { valid: false, reason: "Inventory must be reserved first" };
      return { valid: true };
    case "CancelOrder":
      if (projection.status === "none")
        return { valid: false, reason: "No order to cancel" };
      if (projection.status === "shipped")
        return { valid: false, reason: "Cannot cancel a shipped order" };
      if (projection.status === "cancelled")
        return { valid: false, reason: "Order already cancelled" };
      return { valid: true };
    default:
      return { valid: false, reason: `Unknown command: ${command}` };
  }
}

function commandToEvent(command: CommandType, orderId: string): DomainEvent {
  const timestamp = Date.now();
  switch (command) {
    case "CreateOrder":
      return { kind: "OrderCreated", orderId, timestamp };
    case "AuthorizePayment":
      return { kind: "PaymentAuthorized", orderId, amount: 99.99, timestamp };
    case "ReserveInventory":
      return { kind: "InventoryReserved", orderId, sku: "SKU-001", timestamp };
    case "ShipOrder":
      return { kind: "OrderShipped", orderId, trackingId: `TRK-${Date.now()}`, timestamp };
    case "CancelOrder":
      return { kind: "OrderCancelled", orderId, reason: "Customer requested", timestamp };
  }
}

// The workflow accepts a sequence of commands and processes them against
// an append-only event log with projection rebuild.
export async function eventSourcing(
  aggregateId: string,
  commands: CommandType[]
): Promise<AggregateReport> {
  "use workflow";

  const eventLog: DomainEvent[] = [];
  let projection = emptyProjection(aggregateId);

  // Process each command against the current projection
  const processResult = await processCommands(
    aggregateId,
    commands,
    eventLog,
    projection
  );
  projection = processResult.projection;

  // Replay: rebuild projection from the event log to verify consistency
  const replayResult = await replayEventLog(aggregateId, processResult.eventLog);

  return finalizeAggregate(aggregateId, processResult.eventLog, replayResult.projection);
}

async function processCommands(
  aggregateId: string,
  commands: CommandType[],
  eventLog: DomainEvent[],
  projection: Projection
): Promise<{ eventLog: DomainEvent[]; projection: Projection }> {
  "use step";

  const writer = getWritable<ESEvent>().getWriter();

  try {
    await writer.write({ type: "command_endpoint_ready", aggregateId });

    for (const command of commands) {
      await writer.write({ type: "command_received", command, aggregateId });
      await delay(COMMAND_DELAY_MS);

      const validation = validateCommand(command, projection);

      if (!validation.valid) {
        await writer.write({
          type: "invalid_command",
          command,
          reason: validation.reason,
        });
        continue;
      }

      const domainEvent = commandToEvent(command, aggregateId);
      eventLog.push(domainEvent);

      await writer.write({
        type: "event_appended",
        event: domainEvent,
        index: eventLog.length - 1,
      });

      projection = applyDomainEvent(projection, domainEvent);

      await writer.write({
        type: "projection_updated",
        projection,
      });
    }

    return { eventLog: [...eventLog], projection };
  } finally {
    writer.releaseLock();
  }
}

async function replayEventLog(
  aggregateId: string,
  eventLog: DomainEvent[]
): Promise<{ projection: Projection }> {
  "use step";

  const writer = getWritable<ESEvent>().getWriter();

  try {
    await writer.write({
      type: "replay_started",
      eventCount: eventLog.length,
    });

    let projection = emptyProjection(aggregateId);

    for (let i = 0; i < eventLog.length; i++) {
      await delay(REPLAY_STEP_DELAY_MS);
      projection = applyDomainEvent(projection, eventLog[i]);
      await writer.write({
        type: "replay_progress",
        index: i,
        event: eventLog[i],
        projection,
      });
    }

    await writer.write({
      type: "replay_completed",
      projection,
    });

    return { projection };
  } finally {
    writer.releaseLock();
  }
}

async function finalizeAggregate(
  aggregateId: string,
  eventLog: DomainEvent[],
  projection: Projection
): Promise<AggregateReport> {
  "use step";

  const writer = getWritable<ESEvent>().getWriter();

  try {
    await delay(200);
    await writer.write({ type: "done", eventLog, projection });
    return { status: "done", aggregateId, eventLog, projection };
  } finally {
    writer.releaseLock();
  }
}
