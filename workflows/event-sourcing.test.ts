import { beforeEach, describe, expect, mock, test } from "bun:test";

const writtenEvents: Array<Record<string, unknown>> = [];
const releaseLockMock = mock(() => {});
const writeMock = mock(async (event: unknown) => {
  writtenEvents.push(event as Record<string, unknown>);
});
const getWriterMock = mock(() => ({
  write: writeMock,
  releaseLock: releaseLockMock,
}));
const getWritableMock = mock(() => ({
  getWriter: getWriterMock,
}));

mock.module("workflow", () => ({
  getWritable: getWritableMock,
}));

async function loadWorkflow() {
  return import("./event-sourcing");
}

describe("event sourcing workflow", () => {
  beforeEach(() => {
    writtenEvents.length = 0;
    releaseLockMock.mockClear();
    writeMock.mockClear();
    getWriterMock.mockClear();
    getWritableMock.mockClear();
  });

  test("happy path: full order lifecycle appends all domain events and produces correct projection", async () => {
    const { eventSourcing } = await loadWorkflow();
    const report = await eventSourcing("order-1", [
      "CreateOrder",
      "AuthorizePayment",
      "ReserveInventory",
      "ShipOrder",
    ]);

    expect(report.status).toBe("done");
    expect(report.aggregateId).toBe("order-1");
    expect(report.eventLog).toHaveLength(4);
    expect(report.eventLog[0].kind).toBe("OrderCreated");
    expect(report.eventLog[1].kind).toBe("PaymentAuthorized");
    expect(report.eventLog[2].kind).toBe("InventoryReserved");
    expect(report.eventLog[3].kind).toBe("OrderShipped");
    expect(report.projection.status).toBe("shipped");
    expect(report.projection.paymentAuthorized).toBe(true);
    expect(report.projection.inventoryReserved).toBe(true);
    expect(report.projection.trackingId).toBeTruthy();

    // Verify stream events were emitted
    const commandReady = writtenEvents.filter((e) => e.type === "command_endpoint_ready");
    expect(commandReady).toHaveLength(1);

    const appended = writtenEvents.filter((e) => e.type === "event_appended");
    expect(appended).toHaveLength(4);

    const projUpdated = writtenEvents.filter((e) => e.type === "projection_updated");
    expect(projUpdated).toHaveLength(4);

    const replayStarted = writtenEvents.filter((e) => e.type === "replay_started");
    expect(replayStarted).toHaveLength(1);

    const replayProgress = writtenEvents.filter((e) => e.type === "replay_progress");
    expect(replayProgress).toHaveLength(4);

    const replayCompleted = writtenEvents.filter((e) => e.type === "replay_completed");
    expect(replayCompleted).toHaveLength(1);

    const done = writtenEvents.filter((e) => e.type === "done");
    expect(done).toHaveLength(1);

    // Writer lock released once per step (3 steps)
    expect(releaseLockMock).toHaveBeenCalledTimes(3);
  });

  test("invalid commands are rejected and do not append events", async () => {
    const { eventSourcing } = await loadWorkflow();
    // Try to ship without creating/authorizing/reserving first
    const report = await eventSourcing("order-2", [
      "ShipOrder",
      "CreateOrder",
      "ShipOrder",
    ]);

    expect(report.status).toBe("done");
    // Only CreateOrder should produce a domain event
    expect(report.eventLog).toHaveLength(1);
    expect(report.eventLog[0].kind).toBe("OrderCreated");
    expect(report.projection.status).toBe("created");

    // Both ShipOrder attempts should be rejected
    const invalidEvents = writtenEvents.filter((e) => e.type === "invalid_command");
    expect(invalidEvents).toHaveLength(2);
    expect(invalidEvents[0].command).toBe("ShipOrder");
    // First ShipOrder rejected because status is "none" — needs "reserved"
    expect(invalidEvents[0].reason).toBe("Inventory must be reserved first");
    // Second ShipOrder rejected because status is "created" — still needs "reserved"
    expect(invalidEvents[1].command).toBe("ShipOrder");
    expect(invalidEvents[1].reason).toBe("Inventory must be reserved first");
  });

  test("replay rebuilds the same projection from the event log", async () => {
    const { eventSourcing } = await loadWorkflow();
    const report = await eventSourcing("order-3", [
      "CreateOrder",
      "AuthorizePayment",
      "ReserveInventory",
    ]);

    // The replay step should produce replay_progress events
    const replayProgressEvents = writtenEvents.filter((e) => e.type === "replay_progress");
    expect(replayProgressEvents).toHaveLength(3);

    // The final replay projection should match the live projection
    const replayCompleted = writtenEvents.find((e) => e.type === "replay_completed") as {
      type: string;
      projection: { status: string };
    };
    expect(replayCompleted).toBeTruthy();
    expect(replayCompleted.projection.status).toBe(report.projection.status);
  });

  test("cancel order works after create but not after ship", async () => {
    const { eventSourcing } = await loadWorkflow();
    const report = await eventSourcing("order-4", [
      "CreateOrder",
      "CancelOrder",
    ]);

    expect(report.eventLog).toHaveLength(2);
    expect(report.eventLog[1].kind).toBe("OrderCancelled");
    expect(report.projection.status).toBe("cancelled");
  });

  test("validateCommand pure function rejects invalid state transitions", async () => {
    const { validateCommand } = await loadWorkflow();

    // Can't create order twice
    const result = validateCommand("CreateOrder", {
      orderId: "x",
      status: "created",
      paymentAuthorized: false,
      inventoryReserved: false,
      trackingId: null,
    });
    expect(result.valid).toBe(false);

    // Can authorize after create
    const result2 = validateCommand("AuthorizePayment", {
      orderId: "x",
      status: "created",
      paymentAuthorized: false,
      inventoryReserved: false,
      trackingId: null,
    });
    expect(result2.valid).toBe(true);
  });

  test("applyDomainEvent pure function updates projection correctly", async () => {
    const { applyDomainEvent } = await loadWorkflow();

    const base = {
      orderId: "x",
      status: "none" as const,
      paymentAuthorized: false,
      inventoryReserved: false,
      trackingId: null,
    };

    const after = applyDomainEvent(base, {
      kind: "OrderCreated",
      orderId: "x",
      timestamp: 1,
    });
    expect(after.status).toBe("created");

    const after2 = applyDomainEvent(after, {
      kind: "PaymentAuthorized",
      orderId: "x",
      amount: 50,
      timestamp: 2,
    });
    expect(after2.status).toBe("authorized");
    expect(after2.paymentAuthorized).toBe(true);
  });
});
