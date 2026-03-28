// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import { start } from "workflow/api";
import { approvalChain } from "@/approval-chain/workflows/approval-chain";

function createError(status: number, error: string, code: string) {
  return Response.json(
    {
      ok: false,
      error: {
        code,
        message: error,
      },
    },
    {
      status,
      headers: { "cache-control": "no-store" },
    }
  );
}

function createExpenseId() {
  return `exp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return createError(400, "Invalid JSON body", "INVALID_JSON");
  }

  const amount = body.amount;
  const expenseId = body.expenseId;

  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return createError(400, "amount must be a positive number", "INVALID_AMOUNT");
  }

  if (
    expenseId !== undefined &&
    (typeof expenseId !== "string" || expenseId.trim().length === 0)
  ) {
    return createError(400, "expenseId must be a non-empty string", "INVALID_EXPENSE_ID");
  }

  const normalizedExpenseId =
    typeof expenseId === "string" ? expenseId.trim() : createExpenseId();

  try {
    const run = await start(approvalChain, [normalizedExpenseId, amount]);

    return Response.json({
      ok: true,
      runId: run.runId,
      expenseId: normalizedExpenseId,
      amount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    return createError(500, message, "WORKFLOW_START_FAILED");
  }
}
