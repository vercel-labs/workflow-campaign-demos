"use workflow";


// --- Types ---
export type RawFormat = "xml" | "csv" | "legacy-json";

export type RawMessage = {
  id: string;
  format: RawFormat;
  payload: string;
};

export type CanonicalOrder = {
  orderId: string;
  customer: string;
  amount: number;
  currency: string;
  sourceFormat: RawFormat;
};

export type NormalizeEvent = {
  type:
    | "normalize_detect"
    | "normalize_parse"
    | "normalize_result"
    | "normalize_done";
  messageId: string;
  detectedFormat?: RawFormat;
  canonical?: CanonicalOrder;
  error?: string;
  results?: {
    successful: CanonicalOrder[];
    failed: { messageId: string; error: string }[];
  };
};

export type DemoConfig = {
  strictMode: boolean; // if true, fail on unknown formats; if false, skip them
};

const DEFAULT_CONFIG: DemoConfig = {
  strictMode: false,
};

const SAMPLE_MESSAGES: RawMessage[] = [
  {
    id: "MSG-001",
    format: "xml",
    payload:
      '<order id="X-101"><customer>Alice</customer><amount>250.00</amount><currency>USD</currency></order>',
  },
  {
    id: "MSG-002",
    format: "csv",
    payload: "C-202,Bob,89.50,EUR",
  },
  {
    id: "MSG-003",
    format: "legacy-json",
    payload: JSON.stringify({
      order_num: "L-303",
      cust_name: "Charlie",
      total: 1200,
      cur: "GBP",
    }),
  },
  {
    id: "MSG-004",
    format: "xml",
    payload:
      '<order id="X-404"><customer>Diana</customer><amount>430.00</amount><currency>USD</currency></order>',
  },
  {
    id: "MSG-005",
    format: "csv",
    payload: "C-505,Eve,75.25,CAD",
  },
  {
    id: "MSG-006",
    format: "legacy-json",
    payload: JSON.stringify({
      order_num: "L-606",
      cust_name: "Frank",
      total: 610,
      cur: "JPY",
    }),
  },
];

// --- Entry point ---
export async function normalizer(config?: Partial<DemoConfig>) {
  "use workflow";
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const messages = SAMPLE_MESSAGES;

  const detected = await detectFormats(messages);
  const parsed = await parseToCanonical(detected);
  await emitNormalized(parsed.successful, parsed.failed, cfg.strictMode);
}

type DetectedMessage = RawMessage & { detectedFormat: RawFormat };

// --- Step: Detect format ---
export async function detectFormats(
  messages: RawMessage[]
): Promise<DetectedMessage[]> {
  "use step";
  const { getWritable } = await import("workflow");
  const writable = getWritable<NormalizeEvent>();
  const writer = writable.getWriter();
  const results: DetectedMessage[] = [];

  for (const msg of messages) {
    await new Promise((r) => setTimeout(r, 250));

    // In a real system, format detection would inspect the payload
    // Here we trust the declared format but still emit detection events
    const detectedFormat = msg.format;

    await writer.write({
      type: "normalize_detect",
      messageId: msg.id,
      detectedFormat,
    });

    results.push({ ...msg, detectedFormat });
  }

  writer.close();
  return results;
}

type ParseResult = {
  successful: CanonicalOrder[];
  failed: { messageId: string; error: string }[];
};

// --- Step: Parse to canonical ---
export async function parseToCanonical(
  messages: DetectedMessage[]
): Promise<ParseResult> {
  "use step";
  const { getWritable } = await import("workflow");
  const writable = getWritable<NormalizeEvent>();
  const writer = writable.getWriter();
  const successful: CanonicalOrder[] = [];
  const failed: ParseResult["failed"] = [];

  for (const msg of messages) {
    await new Promise((r) => setTimeout(r, 300));

    try {
      const canonical = parseMessage(msg);
      successful.push(canonical);

      await writer.write({
        type: "normalize_parse",
        messageId: msg.id,
        canonical,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      failed.push({ messageId: msg.id, error });

      await writer.write({
        type: "normalize_result",
        messageId: msg.id,
        error,
      });
    }
  }

  writer.close();
  return { successful, failed };
}

// --- Step: Emit normalized results ---
export async function emitNormalized(
  successful: CanonicalOrder[],
  failed: { messageId: string; error: string }[],
  strictMode: boolean
) {
  "use step";
  const { getWritable, FatalError: Fatal } = await import("workflow");
  const writable = getWritable<NormalizeEvent>();
  const writer = writable.getWriter();

  if (strictMode && failed.length > 0) {
    await writer.write({
      type: "normalize_done",
      messageId: "summary",
      error: `Strict mode: ${failed.length} message(s) failed to normalize`,
      results: { successful, failed },
    });
    writer.close();
    throw new Fatal(
      `Strict mode: ${failed.length} messages failed normalization`
    );
  }

  await writer.write({
    type: "normalize_done",
    messageId: "summary",
    results: { successful, failed },
  });

  writer.close();
}

// --- Format parsers ---
function parseMessage(msg: DetectedMessage): CanonicalOrder {
  switch (msg.detectedFormat) {
    case "xml":
      return parseXml(msg);
    case "csv":
      return parseCsv(msg);
    case "legacy-json":
      return parseLegacyJson(msg);
    default:
      throw new Error(`Unknown format: ${msg.detectedFormat}`);
  }
}

function parseXml(msg: DetectedMessage): CanonicalOrder {
  const id = msg.payload.match(/id="([^"]+)"/)?.[1] ?? "unknown";
  const customer =
    msg.payload.match(/<customer>([^<]+)<\/customer>/)?.[1] ?? "unknown";
  const amount = parseFloat(
    msg.payload.match(/<amount>([^<]+)<\/amount>/)?.[1] ?? "0"
  );
  const currency =
    msg.payload.match(/<currency>([^<]+)<\/currency>/)?.[1] ?? "USD";
  return { orderId: id, customer, amount, currency, sourceFormat: "xml" };
}

function parseCsv(msg: DetectedMessage): CanonicalOrder {
  const [orderId, customer, amountStr, currency] = msg.payload.split(",");
  return {
    orderId: orderId ?? "unknown",
    customer: customer ?? "unknown",
    amount: parseFloat(amountStr ?? "0"),
    currency: currency ?? "USD",
    sourceFormat: "csv",
  };
}

function parseLegacyJson(msg: DetectedMessage): CanonicalOrder {
  const data = JSON.parse(msg.payload) as {
    order_num: string;
    cust_name: string;
    total: number;
    cur: string;
  };
  return {
    orderId: data.order_num,
    customer: data.cust_name,
    amount: data.total,
    currency: data.cur,
    sourceFormat: "legacy-json",
  };
}
