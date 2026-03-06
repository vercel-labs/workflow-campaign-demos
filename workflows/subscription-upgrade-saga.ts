import { FatalError, getWritable } from "workflow";

type FailAtStep = 1 | 2 | 3 | null;
type CompensationAction =
  | "releaseSeats"
  | "refundInvoice"
  | "deprovisionSeats";
type CompensationHandler = {
  action: CompensationAction;
  undo: () => Promise<void>;
};

export type SagaEvent =
  | { type: "step_running"; step: string; label: string }
  | { type: "step_succeeded"; step: string; label: string }
  | { type: "step_failed"; step: string; label: string; error: string }
  | { type: "step_skipped"; step: string; label: string }
  | { type: "compensation_pushed"; action: CompensationAction; forStep: string }
  | { type: "rolling_back"; failedStep: number }
  | { type: "compensating"; action: CompensationAction }
  | { type: "compensated"; action: CompensationAction }
  | { type: "done"; status: "completed" | "rolled_back" };

export interface SubscriptionUpgradeResult {
  accountId: string;
  seats: number;
  status: "completed" | "rolled_back";
  failedStep: FailAtStep;
  compensationOrder: CompensationAction[];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const STEP_DELAY_MS: Record<string, number> = {
  reserveSeats: 600,
  captureInvoice: 700,
  provisionSeats: 800,
  sendConfirmation: 500,
  releaseSeats: 500,
  refundInvoice: 600,
  deprovisionSeats: 500,
};

export async function subscriptionUpgradeSaga(
  accountId: string,
  seats: number,
  failAtStep: FailAtStep = null
): Promise<SubscriptionUpgradeResult> {
  "use workflow";

  const compensations: CompensationHandler[] = [];

  let reservationId: string | null = null;
  let invoiceId: string | null = null;
  let entitlementId: string | null = null;

  try {
    reservationId = await reserveSeats(accountId, seats, failAtStep === 1);
    {
      const reservationToRelease = reservationId;
      compensations.push({
        action: "releaseSeats",
        undo: () => releaseSeats(accountId, reservationToRelease),
      });
    }

    invoiceId = await captureInvoice(accountId, seats, failAtStep === 2);
    {
      const invoiceToRefund = invoiceId;
      compensations.push({
        action: "refundInvoice",
        undo: () => refundInvoice(accountId, invoiceToRefund),
      });
    }

    entitlementId = await provisionSeats(accountId, seats, failAtStep === 3);
    {
      const entitlementToDeprovision = entitlementId;
      compensations.push({
        action: "deprovisionSeats",
        undo: () => deprovisionSeats(accountId, entitlementToDeprovision),
      });
    }

    await sendConfirmation(accountId, seats, invoiceId, entitlementId);
    await emitDone("completed");

    return {
      accountId,
      seats,
      status: "completed",
      failedStep: null,
      compensationOrder: compensations.map((compensation) => compensation.action),
    };
  } catch (error) {
    if (!(error instanceof FatalError)) {
      throw error;
    }

    const executedCompensations: CompensationAction[] = [];

    while (compensations.length > 0) {
      const compensation = compensations.pop()!;
      executedCompensations.push(compensation.action);
      await compensation.undo();
    }

    await emitDone("rolled_back");

    return {
      accountId,
      seats,
      status: "rolled_back",
      failedStep: failAtStep,
      compensationOrder: executedCompensations,
    };
  }
}

async function reserveSeats(
  accountId: string,
  seats: number,
  shouldFail: boolean
): Promise<string> {
  "use step";

  const writer = getWritable<SagaEvent>().getWriter();
  try {
    await writer.write({ type: "step_running", step: "reserveSeats", label: "Reserve seats" });
    await delay(STEP_DELAY_MS.reserveSeats);

    if (shouldFail) {
      await writer.write({ type: "step_failed", step: "reserveSeats", label: "Reserve seats", error: `reserveSeats failed for account ${accountId}` });
      await writer.write({ type: "step_skipped", step: "captureInvoice", label: "Capture invoice" });
      await writer.write({ type: "step_skipped", step: "provisionSeats", label: "Provision seats" });
      await writer.write({ type: "step_skipped", step: "sendConfirmation", label: "Send confirmation" });
      throw new FatalError(
        `reserveSeats failed for account ${accountId} with ${seats} seats`
      );
    }

    await writer.write({ type: "step_succeeded", step: "reserveSeats", label: "Reserve seats" });
    await writer.write({ type: "compensation_pushed", action: "releaseSeats", forStep: "reserveSeats" });
    return `seat_reservation:${accountId}:${seats}`;
  } finally {
    writer.releaseLock();
  }
}

async function captureInvoice(
  accountId: string,
  seats: number,
  shouldFail: boolean
): Promise<string> {
  "use step";

  const writer = getWritable<SagaEvent>().getWriter();
  try {
    await writer.write({ type: "step_running", step: "captureInvoice", label: "Capture invoice" });
    await delay(STEP_DELAY_MS.captureInvoice);

    if (shouldFail) {
      await writer.write({ type: "step_failed", step: "captureInvoice", label: "Capture invoice", error: `captureInvoice failed for account ${accountId}` });
      await writer.write({ type: "step_skipped", step: "provisionSeats", label: "Provision seats" });
      await writer.write({ type: "step_skipped", step: "sendConfirmation", label: "Send confirmation" });
      throw new FatalError(
        `captureInvoice failed for account ${accountId} with ${seats} seats`
      );
    }

    await writer.write({ type: "step_succeeded", step: "captureInvoice", label: "Capture invoice" });
    await writer.write({ type: "compensation_pushed", action: "refundInvoice", forStep: "captureInvoice" });
    return `invoice:${accountId}:${seats}`;
  } finally {
    writer.releaseLock();
  }
}

async function provisionSeats(
  accountId: string,
  seats: number,
  shouldFail: boolean
): Promise<string> {
  "use step";

  const writer = getWritable<SagaEvent>().getWriter();
  try {
    await writer.write({ type: "step_running", step: "provisionSeats", label: "Provision seats" });
    await delay(STEP_DELAY_MS.provisionSeats);

    if (shouldFail) {
      await writer.write({ type: "step_failed", step: "provisionSeats", label: "Provision seats", error: `provisionSeats failed for account ${accountId}` });
      await writer.write({ type: "step_skipped", step: "sendConfirmation", label: "Send confirmation" });
      throw new FatalError(
        `provisionSeats failed for account ${accountId} with ${seats} seats`
      );
    }

    await writer.write({ type: "step_succeeded", step: "provisionSeats", label: "Provision seats" });
    await writer.write({ type: "compensation_pushed", action: "deprovisionSeats", forStep: "provisionSeats" });
    return `entitlement:${accountId}:${seats}`;
  } finally {
    writer.releaseLock();
  }
}

async function sendConfirmation(
  accountId: string,
  seats: number,
  invoiceId: string,
  entitlementId: string
): Promise<void> {
  "use step";

  const writer = getWritable<SagaEvent>().getWriter();
  try {
    await writer.write({ type: "step_running", step: "sendConfirmation", label: "Send confirmation" });
    await delay(STEP_DELAY_MS.sendConfirmation);
    await writer.write({ type: "step_succeeded", step: "sendConfirmation", label: "Send confirmation" });
  } finally {
    writer.releaseLock();
  }

  console.info("[subscription-upgrade-saga] confirmation_sent", {
    accountId,
    seats,
    invoiceId,
    entitlementId,
  });
}

async function releaseSeats(
  accountId: string,
  reservationId: string | null
): Promise<void> {
  "use step";

  const writer = getWritable<SagaEvent>().getWriter();
  try {
    await writer.write({ type: "compensating", action: "releaseSeats" });
    await delay(STEP_DELAY_MS.releaseSeats);
    await writer.write({ type: "compensated", action: "releaseSeats" });
  } finally {
    writer.releaseLock();
  }

  console.info("[subscription-upgrade-saga] release_seats", {
    accountId,
    reservationId,
  });
}

async function refundInvoice(
  accountId: string,
  invoiceId: string | null
): Promise<void> {
  "use step";

  const writer = getWritable<SagaEvent>().getWriter();
  try {
    await writer.write({ type: "compensating", action: "refundInvoice" });
    await delay(STEP_DELAY_MS.refundInvoice);
    await writer.write({ type: "compensated", action: "refundInvoice" });
  } finally {
    writer.releaseLock();
  }

  console.info("[subscription-upgrade-saga] refund_invoice", {
    accountId,
    invoiceId,
  });
}

async function deprovisionSeats(
  accountId: string,
  entitlementId: string | null
): Promise<void> {
  "use step";

  const writer = getWritable<SagaEvent>().getWriter();
  try {
    await writer.write({ type: "compensating", action: "deprovisionSeats" });
    await delay(STEP_DELAY_MS.deprovisionSeats);
    await writer.write({ type: "compensated", action: "deprovisionSeats" });
  } finally {
    writer.releaseLock();
  }

  console.info("[subscription-upgrade-saga] deprovision_seats", {
    accountId,
    entitlementId,
  });
}

async function emitDone(status: "completed" | "rolled_back"): Promise<void> {
  "use step";

  const writer = getWritable<SagaEvent>().getWriter();
  try {
    await writer.write({ type: "done", status });
  } finally {
    writer.releaseLock();
  }
}
