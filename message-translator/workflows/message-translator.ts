import { getWritable, sleep } from "workflow";

export type SourceFormat = "xml" | "csv" | "legacy-json";

export type TranslatorEvent =
  | { type: "message_received"; messageId: string; sourceFormat: SourceFormat }
  | { type: "detecting_format"; messageId: string }
  | { type: "format_detected"; messageId: string; sourceFormat: SourceFormat; confidence: number }
  | { type: "translating"; messageId: string; sourceFormat: SourceFormat; step: string }
  | { type: "field_mapped"; messageId: string; sourceField: string; canonicalField: string; value: string }
  | { type: "validating"; messageId: string }
  | { type: "validation_passed"; messageId: string; fieldCount: number }
  | { type: "delivering"; messageId: string; destination: string }
  | { type: "done"; messageId: string; sourceFormat: SourceFormat; fieldsTranslated: number };

export interface MessageTranslatorResult {
  messageId: string;
  sourceFormat: SourceFormat;
  fieldsTranslated: number;
}

// Simulated raw messages from three legacy systems
const SAMPLE_MESSAGES: Record<SourceFormat, string> = {
  xml: `<order><id>ORD-5501</id><cust>ACME Corp</cust><amt>2499.00</amt><curr>USD</curr><date>2026-03-14</date></order>`,
  csv: `order_id,customer_name,total_amount,currency,order_date\nORD-5502,Globex Inc,1875.50,EUR,2026-03-14`,
  "legacy-json": `{"oid":"ORD-5503","c_name":"Initech LLC","total":"3200.00","cur":"GBP","dt":"20260314"}`,
};

// Field mappings per source format → canonical fields
const FIELD_MAPS: Record<SourceFormat, Array<{ source: string; canonical: string }>> = {
  xml: [
    { source: "id", canonical: "orderId" },
    { source: "cust", canonical: "customerName" },
    { source: "amt", canonical: "amount" },
    { source: "curr", canonical: "currency" },
    { source: "date", canonical: "orderDate" },
  ],
  csv: [
    { source: "order_id", canonical: "orderId" },
    { source: "customer_name", canonical: "customerName" },
    { source: "total_amount", canonical: "amount" },
    { source: "currency", canonical: "currency" },
    { source: "order_date", canonical: "orderDate" },
  ],
  "legacy-json": [
    { source: "oid", canonical: "orderId" },
    { source: "c_name", canonical: "customerName" },
    { source: "total", canonical: "amount" },
    { source: "cur", canonical: "currency" },
    { source: "dt", canonical: "orderDate" },
  ],
};

// Simulated values extracted from each format
const EXTRACTED_VALUES: Record<SourceFormat, string[]> = {
  xml: ["ORD-5501", "ACME Corp", "2499.00", "USD", "2026-03-14"],
  csv: ["ORD-5502", "Globex Inc", "1875.50", "EUR", "2026-03-14"],
  "legacy-json": ["ORD-5503", "Initech LLC", "3200.00", "GBP", "2026-03-14"],
};

// Demo timing
const DETECT_DELAY_MS = 600;
const FIELD_MAP_DELAY_MS = 400;
const VALIDATE_DELAY_MS = 500;
const DELIVER_DELAY_MS = 600;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function detectFormat(rawMessage: string): { sourceFormat: SourceFormat; confidence: number } {
  if (rawMessage.trimStart().startsWith("<")) return { sourceFormat: "xml", confidence: 0.97 };
  if (rawMessage.includes(",") && rawMessage.includes("\n")) return { sourceFormat: "csv", confidence: 0.94 };
  if (rawMessage.trimStart().startsWith("{") && rawMessage.includes("oid")) return { sourceFormat: "legacy-json", confidence: 0.92 };
  return { sourceFormat: "csv", confidence: 0.5 };
}

export async function messageTranslatorFlow(
  messageId: string,
  sourceFormat: SourceFormat = "xml"
): Promise<MessageTranslatorResult> {
  "use workflow";

  const rawMessage = SAMPLE_MESSAGES[sourceFormat];

  // Step 1: Receive message
  await emitEvent({ type: "message_received", messageId, sourceFormat });

  // Step 2: Detect format
  const detected = await detectSourceFormat(messageId, rawMessage);

  // Step 3: Translate fields
  const fieldsTranslated = await translateFields(messageId, detected.sourceFormat);

  // Step 4: Validate canonical output
  await validateOutput(messageId, fieldsTranslated);

  // Step 5: Deliver to target system
  await deliverMessage(messageId);

  // Step 6: Done
  await emitEvent({ type: "done", messageId, sourceFormat: detected.sourceFormat, fieldsTranslated });

  return { messageId, sourceFormat: detected.sourceFormat, fieldsTranslated };
}

async function detectSourceFormat(
  messageId: string,
  rawMessage: string
): Promise<{ sourceFormat: SourceFormat; confidence: number }> {
  "use step";

  const writer = getWritable<TranslatorEvent>().getWriter();
  try {
    await writer.write({ type: "detecting_format", messageId });
    await delay(DETECT_DELAY_MS);

    const result = detectFormat(rawMessage);
    await writer.write({
      type: "format_detected",
      messageId,
      sourceFormat: result.sourceFormat,
      confidence: result.confidence,
    });

    return result;
  } finally {
    writer.releaseLock();
  }
}

async function translateFields(
  messageId: string,
  sourceFormat: SourceFormat
): Promise<number> {
  "use step";

  const writer = getWritable<TranslatorEvent>().getWriter();
  const fieldMap = FIELD_MAPS[sourceFormat];
  const values = EXTRACTED_VALUES[sourceFormat];

  try {
    await writer.write({ type: "translating", messageId, sourceFormat, step: "Parsing raw message" });
    await delay(FIELD_MAP_DELAY_MS);

    for (let i = 0; i < fieldMap.length; i++) {
      const mapping = fieldMap[i];
      await writer.write({
        type: "field_mapped",
        messageId,
        sourceField: mapping.source,
        canonicalField: mapping.canonical,
        value: values[i],
      });
      await delay(FIELD_MAP_DELAY_MS);
    }

    return fieldMap.length;
  } finally {
    writer.releaseLock();
  }
}

async function validateOutput(
  messageId: string,
  fieldCount: number
): Promise<void> {
  "use step";

  const writer = getWritable<TranslatorEvent>().getWriter();
  try {
    await writer.write({ type: "validating", messageId });
    await delay(VALIDATE_DELAY_MS);

    await writer.write({ type: "validation_passed", messageId, fieldCount });
  } finally {
    writer.releaseLock();
  }
}

async function deliverMessage(
  messageId: string
): Promise<void> {
  "use step";

  const writer = getWritable<TranslatorEvent>().getWriter();
  try {
    await writer.write({ type: "delivering", messageId, destination: "canonical-orders-api" });
    await delay(DELIVER_DELAY_MS);
  } finally {
    writer.releaseLock();
  }
}

async function emitEvent(event: TranslatorEvent): Promise<void> {
  "use step";
  const writer = getWritable<TranslatorEvent>().getWriter();
  try {
    await writer.write(event);
  } finally {
    writer.releaseLock();
  }
}
