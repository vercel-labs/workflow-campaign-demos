// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import {
  findBlockLineNumbers,
  findLineNumbers,
  highlightCodeToHtmlLines,
} from "@/lib/code-workbench.server";

const wf = `"use ${"workflow"}"`;
const st = `"use ${"step"}"`;

type IdempotentReceiverOrchestratorLineMap = {
  checkKey: number[];
  duplicateBranch: number[];
  processBranch: number[];
  returnResult: number[];
};

type IdempotentReceiverStepLineMap = {
  checkKey: number[];
  processPayment: number[];
  storeResult: number[];
  emitDuplicate: number[];
};

export type IdempotentReceiverCodeProps = {
  orchestratorHtmlLines: string[];
  orchestratorLineMap: IdempotentReceiverOrchestratorLineMap;
  stepHtmlLines: string[];
  stepLineMap: IdempotentReceiverStepLineMap;
};

const orchestratorCode = `import { getWritable } from "workflow";

export async function idempotentReceiver(
  idempotencyKey: string,
  amount: number,
  currency: string,
  description: string
) {
  ${wf};

  const cached = await checkIdempotencyKey(idempotencyKey);

  if (cached) {
    await emitDuplicateDetected(idempotencyKey, cached);
    return { idempotencyKey, deduplicated: true, result: cached };
  }

  const result = await processPayment(
    idempotencyKey, amount, currency, description
  );

  await emitCompletion(idempotencyKey);

  return { idempotencyKey, deduplicated: false, result };
}`;

const stepCode = `async function checkIdempotencyKey(idempotencyKey: string) {
  ${st};
  const writer = getWritable().getWriter();

  try {
    await writer.write({ type: "checking_key", idempotencyKey });
    const cached = processedKeys.get(idempotencyKey) ?? null;
    return cached;
  } finally {
    writer.releaseLock();
  }
}

async function processPayment(
  idempotencyKey: string,
  amount: number,
  currency: string,
  description: string
) {
  ${st};
  const writer = getWritable().getWriter();

  try {
    await writer.write({ type: "processing_payment", idempotencyKey, amount });

    const result = {
      transactionId: \`txn_\${idempotencyKey}_\${Date.now()}\`,
      amount,
      currency,
      status: "succeeded",
      processedAt: new Date().toISOString(),
    };

    // Store result for future deduplication
    processedKeys.set(idempotencyKey, result);

    await writer.write({ type: "payment_processed", idempotencyKey, result });
    return result;
  } finally {
    writer.releaseLock();
  }
}`;

function buildOrchestratorLineMap(
  code: string,
): IdempotentReceiverOrchestratorLineMap {
  const lines = code.split("\n");

  const checkKey = findLineNumbers(code, "checkIdempotencyKey(");
  const duplicateBranch = findBlockLineNumbers(code, "if (cached)");

  // processBranch: processPayment call + emitCompletion + return
  const processBranch: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (
      lines[i].includes("const result = await processPayment(") ||
      lines[i].includes("idempotencyKey, amount, currency, description") ||
      lines[i].includes("await emitCompletion(") ||
      lines[i].includes("return { idempotencyKey, deduplicated: false")
    ) {
      processBranch.push(i + 1);
    }
    // Capture closing paren of processPayment call
    if (lines[i].trim() === ");" && processBranch.length > 0 && processBranch.length < 3) {
      processBranch.push(i + 1);
    }
  }

  const returnResult = findLineNumbers(
    code,
    "return { idempotencyKey, deduplicated: false",
  );

  return { checkKey, duplicateBranch, processBranch, returnResult };
}

function buildStepLineMap(code: string): IdempotentReceiverStepLineMap {
  const checkKey = findBlockLineNumbers(
    code,
    "async function checkIdempotencyKey(",
  );
  const processPayment = findBlockLineNumbers(
    code,
    "async function processPayment(",
  );
  const storeResult = [
    ...findLineNumbers(code, "processedKeys.set("),
    ...findLineNumbers(code, "payment_processed"),
  ];

  return {
    checkKey,
    processPayment,
    storeResult,
    emitDuplicate: checkKey, // duplicate detection reuses the checkKey block
  };
}

export function getIdempotentReceiverCodeProps(): IdempotentReceiverCodeProps {
  return {
    orchestratorHtmlLines: highlightCodeToHtmlLines(orchestratorCode),
    orchestratorLineMap: buildOrchestratorLineMap(orchestratorCode),
    stepHtmlLines: highlightCodeToHtmlLines(stepCode),
    stepLineMap: buildStepLineMap(stepCode),
  };
}
