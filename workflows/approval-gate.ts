import { defineHook, getWritable, sleep } from "workflow";
import type { StringValue } from "ms";

// Define the approval payload type
export interface ApprovalPayload {
  approved: boolean;
  comment?: string;
  approvedBy?: string;
}

// Define the hook for type-safe approval handling
export const orderApprovalHook = defineHook<ApprovalPayload>();

// Result type for the workflow
export interface ApprovalResult {
  orderId: string;
  status: "approved" | "rejected" | "timeout";
  comment?: string;
  approvedBy?: string;
}

// Typed events streamed to the UI via getWritable()
export type ApprovalEvent =
  | { type: "request_sent"; orderId: string }
  | { type: "waiting"; orderId: string; token: string; timeoutMs: number }
  | { type: "approved"; orderId: string; approvedBy?: string; comment?: string }
  | { type: "rejected"; orderId: string; approvedBy?: string; comment?: string }
  | { type: "timeout"; orderId: string }
  | { type: "fulfilling"; orderId: string }
  | { type: "fulfilled"; orderId: string }
  | { type: "cancelling"; orderId: string; reason: string }
  | { type: "cancelled"; orderId: string; reason: string }
  | { type: "done"; orderId: string; status: "approved" | "rejected" | "timeout" };

const TIMEOUT_MS: Record<string, number> = {
  "10s": 10_000,
  "30s": 30_000,
  "1m": 60_000,
  "5m": 300_000,
  "24h": 86_400_000,
};

/**
 * Approval Gate Workflow
 *
 * Demonstrates the "Signal + timer" pattern:
 * - Creates a deterministic hook token for external systems to resume
 * - Uses Promise.race to implement timeout behavior
 * - Waits for human approval or times out after specified duration
 */
export async function approvalGate(
  orderId: string,
  timeout: StringValue = "24h"
): Promise<ApprovalResult> {
  "use workflow";

  // Request approval (e.g., send email, create ticket, notify Slack)
  await requestApproval(orderId);
  await emit<ApprovalEvent>({ type: "request_sent", orderId });

  // Create hook with deterministic token based on orderId
  const hook = orderApprovalHook.create({
    token: `order_approval:${orderId}`,
  });

  const timeoutMs = TIMEOUT_MS[timeout] ?? 30_000;
  await emit<ApprovalEvent>({
    type: "waiting",
    orderId,
    token: hook.token,
    timeoutMs,
  });

  // Race between approval hook and timeout
  const result = await Promise.race([
    hook.then((payload) => ({
      type: "approval" as const,
      payload,
    })),
    sleep(timeout).then(() => ({
      type: "timeout" as const,
      payload: null,
    })),
  ]);

  if (result.type === "timeout") {
    await emit<ApprovalEvent>({ type: "timeout", orderId });
    await emit<ApprovalEvent>({ type: "cancelling", orderId, reason: "Approval timed out" });
    await cancelOrder(orderId, "Approval timed out");
    await emit<ApprovalEvent>({ type: "cancelled", orderId, reason: "Approval timed out" });
    await emit<ApprovalEvent>({ type: "done", orderId, status: "timeout" });
    return { orderId, status: "timeout" };
  }

  const { approved, comment, approvedBy } = result.payload!;

  if (approved) {
    await emit<ApprovalEvent>({ type: "approved", orderId, approvedBy, comment });
    await emit<ApprovalEvent>({ type: "fulfilling", orderId });
    await fulfillOrder(orderId);
    await emit<ApprovalEvent>({ type: "fulfilled", orderId });
    await emit<ApprovalEvent>({ type: "done", orderId, status: "approved" });
    return { orderId, status: "approved", comment, approvedBy };
  } else {
    await emit<ApprovalEvent>({ type: "rejected", orderId, approvedBy, comment });
    await emit<ApprovalEvent>({ type: "cancelling", orderId, reason: comment || "Rejected by approver" });
    await cancelOrder(orderId, comment || "Rejected by approver");
    await emit<ApprovalEvent>({ type: "cancelled", orderId, reason: comment || "Rejected by approver" });
    await emit<ApprovalEvent>({ type: "done", orderId, status: "rejected" });
    return { orderId, status: "rejected", comment, approvedBy };
  }
}

/**
 * Step: Emit a single event to the UI stream.
 * Re-acquires the writer inside the step so it survives durable suspension.
 */
async function emit<T>(event: T): Promise<void> {
  "use step";
  const writer = getWritable<T>().getWriter();
  try {
    await writer.write(event);
  } finally {
    writer.releaseLock();
  }
}

/**
 * Step: Request approval from external system
 */
async function requestApproval(orderId: string): Promise<void> {
  "use step";
  // Simulate sending approval request (email, ticket, Slack notification)
  await delay(500);
  console.log(`[Order ${orderId}] Approval request sent`);
}

/**
 * Step: Fulfill the order after approval
 */
async function fulfillOrder(orderId: string): Promise<void> {
  "use step";
  await delay(600);
  console.log(`[Order ${orderId}] Order fulfilled successfully`);
}

/**
 * Step: Cancel the order (on rejection or timeout)
 */
async function cancelOrder(orderId: string, reason: string): Promise<void> {
  "use step";
  await delay(500);
  console.log(`[Order ${orderId}] Order cancelled: ${reason}`);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
