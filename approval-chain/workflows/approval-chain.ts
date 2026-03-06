import { defineHook, getWritable, sleep } from "workflow";

export type ApprovalRole = "manager" | "director" | "vp";

export type ApprovalSignal = {
  approved: boolean;
  comment?: string;
  decidedBy?: string;
};

export type ChainEvent =
  | { type: "submitted"; expenseId: string; amount: number; levels: ApprovalRole[] }
  | { type: "level_waiting"; role: ApprovalRole; token: string; timeout: string }
  | { type: "level_approved"; role: ApprovalRole; comment?: string }
  | { type: "level_rejected"; role: ApprovalRole; comment?: string }
  | { type: "level_timeout"; role: ApprovalRole }
  | { type: "approved"; decidedBy: ApprovalRole; comment?: string }
  | { type: "rejected"; decidedBy: ApprovalRole; comment?: string }
  | { type: "expired" }
  | { type: "done"; status: "approved" | "rejected" | "expired" };

type ApprovalLevel = {
  role: ApprovalRole;
  timeout: "10s" | "8s" | "6s";
};

const LEVEL_CHAIN: readonly ApprovalLevel[] = [
  { role: "manager", timeout: "10s" },
  { role: "director", timeout: "8s" },
  { role: "vp", timeout: "6s" },
] as const;

export function getApprovalLevelsForAmount(amount: number): ApprovalLevel[] {
  if (amount < 500) return [LEVEL_CHAIN[0]];
  if (amount < 5000) return [LEVEL_CHAIN[0], LEVEL_CHAIN[1]];
  return [...LEVEL_CHAIN];
}

export async function approvalChain(expenseId: string, amount: number) {
  "use workflow";

  const levels = getApprovalLevelsForAmount(amount);

  await submitExpense(expenseId, amount, levels.map((level) => level.role));

  for (const level of levels) {
    await notifyLevel(expenseId, level.role, level.timeout);

    const levelHook = defineHook<ApprovalSignal>();
    const hook = levelHook.create({
      token: `approval:${expenseId}:${level.role}`,
    });

    const result = await Promise.race([
      hook.then((payload) => ({ type: "decision" as const, payload })),
      sleep(level.timeout).then(() => ({ type: "timeout" as const })),
    ]);

    if (result.type === "timeout") {
      await recordTimeout(expenseId, level.role);
      continue;
    }

    if (!result.payload.approved) {
      await rejectExpense(expenseId, level.role, result.payload.comment);
      await emitDone("rejected");
      return {
        expenseId,
        amount,
        status: "rejected" as const,
        decidedBy: level.role,
        comment: result.payload.comment,
      };
    }

    await approveExpense(expenseId, level.role, result.payload.comment);
    await emitDone("approved");
    return {
      expenseId,
      amount,
      status: "approved" as const,
      decidedBy: level.role,
      comment: result.payload.comment,
    };
  }

  await expireExpense(expenseId);
  await emitDone("expired");
  return {
    expenseId,
    amount,
    status: "timed_out" as const,
  };
}

async function submitExpense(expenseId: string, amount: number, levels: ApprovalRole[]) {
  "use step";

  const writer = getWritable<ChainEvent>().getWriter();
  try {
    await writer.write({ type: "submitted", expenseId, amount, levels });
  } finally {
    writer.releaseLock();
  }
}

async function notifyLevel(expenseId: string, role: ApprovalRole, timeout: string) {
  "use step";

  const writer = getWritable<ChainEvent>().getWriter();
  try {
    const token = `approval:${expenseId}:${role}`;
    await writer.write({ type: "level_waiting", role, token, timeout });
  } finally {
    writer.releaseLock();
  }
}

async function recordTimeout(expenseId: string, role: ApprovalRole) {
  "use step";

  const writer = getWritable<ChainEvent>().getWriter();
  try {
    await writer.write({ type: "level_timeout", role });
  } finally {
    writer.releaseLock();
  }
  console.info("[approval-chain] level_timeout", { expenseId, role });
}

async function approveExpense(expenseId: string, role: ApprovalRole, comment?: string) {
  "use step";

  const writer = getWritable<ChainEvent>().getWriter();
  try {
    await writer.write({ type: "level_approved", role, comment });
    await writer.write({ type: "approved", decidedBy: role, comment });
  } finally {
    writer.releaseLock();
  }
}

async function rejectExpense(expenseId: string, role: ApprovalRole, comment?: string) {
  "use step";

  const writer = getWritable<ChainEvent>().getWriter();
  try {
    await writer.write({ type: "level_rejected", role, comment });
    await writer.write({ type: "rejected", decidedBy: role, comment });
  } finally {
    writer.releaseLock();
  }
}

async function emitDone(status: "approved" | "rejected" | "expired") {
  "use step";

  const writer = getWritable<ChainEvent>().getWriter();
  try {
    await writer.write({ type: "done", status });
  } finally {
    writer.releaseLock();
  }
}

async function expireExpense(expenseId: string) {
  "use step";

  const writer = getWritable<ChainEvent>().getWriter();
  try {
    await writer.write({ type: "expired" });
  } finally {
    writer.releaseLock();
  }
  console.info("[approval-chain] expense_timed_out", { expenseId });
}
