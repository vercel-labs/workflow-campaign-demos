import { beforeEach, describe, expect, mock, test } from "bun:test";

const writtenEvents: Array<Record<string, unknown>> = [];
const closeMock = mock(() => {});
const writeMock = mock(async (event: unknown) => {
  writtenEvents.push(event as Record<string, unknown>);
});
const getWriterMock = mock(() => ({
  write: writeMock,
  close: closeMock,
}));
const getWritableMock = mock(() => ({
  getWriter: getWriterMock,
}));

mock.module("workflow", () => ({
  getWritable: getWritableMock,
  FatalError: class FatalError extends Error {},
}));

async function loadWorkflow() {
  return import("./normalizer");
}

describe("normalizer workflow", () => {
  beforeEach(() => {
    writtenEvents.length = 0;
    closeMock.mockClear();
    writeMock.mockClear();
    getWriterMock.mockClear();
    getWritableMock.mockClear();
  });

  test("test_detectFormats_emits_detect_event_for_each_message", async () => {
    const { detectFormats } = await loadWorkflow();
    const messages = [
      {
        id: "MSG-001",
        format: "xml" as const,
        payload:
          '<order id="X-101"><customer>A</customer><amount>1</amount><currency>USD</currency></order>',
      },
      { id: "MSG-002", format: "csv" as const, payload: "C-202,B,2,EUR" },
    ];

    const result = await detectFormats(messages);

    expect(result).toHaveLength(2);
    expect(result[0].detectedFormat).toBe("xml");
    expect(result[1].detectedFormat).toBe("csv");

    const detectEvents = writtenEvents.filter(
      (e) => e.type === "normalize_detect"
    );
    expect(detectEvents).toHaveLength(2);
  });

  test("test_parseToCanonical_parses_xml_format", async () => {
    const { parseToCanonical } = await loadWorkflow();
    const messages = [
      {
        id: "MSG-001",
        format: "xml" as const,
        detectedFormat: "xml" as const,
        payload:
          '<order id="X-101"><customer>Alice</customer><amount>250.00</amount><currency>USD</currency></order>',
      },
    ];

    const result = await parseToCanonical(messages);

    expect(result.successful).toHaveLength(1);
    expect(result.failed).toHaveLength(0);
    expect(result.successful[0].orderId).toBe("X-101");
    expect(result.successful[0].customer).toBe("Alice");
    expect(result.successful[0].amount).toBe(250);
    expect(result.successful[0].currency).toBe("USD");
    expect(result.successful[0].sourceFormat).toBe("xml");
  });

  test("test_parseToCanonical_parses_csv_format", async () => {
    const { parseToCanonical } = await loadWorkflow();
    const messages = [
      {
        id: "MSG-002",
        format: "csv" as const,
        detectedFormat: "csv" as const,
        payload: "C-202,Bob,89.50,EUR",
      },
    ];

    const result = await parseToCanonical(messages);

    expect(result.successful).toHaveLength(1);
    expect(result.successful[0].orderId).toBe("C-202");
    expect(result.successful[0].customer).toBe("Bob");
    expect(result.successful[0].amount).toBe(89.5);
    expect(result.successful[0].currency).toBe("EUR");
    expect(result.successful[0].sourceFormat).toBe("csv");
  });

  test("test_parseToCanonical_parses_legacy_json_format", async () => {
    const { parseToCanonical } = await loadWorkflow();
    const messages = [
      {
        id: "MSG-003",
        format: "legacy-json" as const,
        detectedFormat: "legacy-json" as const,
        payload: JSON.stringify({
          order_num: "L-303",
          cust_name: "Charlie",
          total: 1200,
          cur: "GBP",
        }),
      },
    ];

    const result = await parseToCanonical(messages);

    expect(result.successful).toHaveLength(1);
    expect(result.successful[0].orderId).toBe("L-303");
    expect(result.successful[0].customer).toBe("Charlie");
    expect(result.successful[0].amount).toBe(1200);
    expect(result.successful[0].currency).toBe("GBP");
    expect(result.successful[0].sourceFormat).toBe("legacy-json");
  });

  test("test_emitNormalized_writes_done_event_with_summary", async () => {
    const { emitNormalized } = await loadWorkflow();
    const successful = [
      {
        orderId: "X-101",
        customer: "Alice",
        amount: 250,
        currency: "USD",
        sourceFormat: "xml" as const,
      },
    ];
    const failed: { messageId: string; error: string }[] = [];

    await emitNormalized(successful, failed, false);

    const doneEvent = writtenEvents.find((e) => e.type === "normalize_done");
    expect(doneEvent).toBeTruthy();
    expect(doneEvent!.messageId).toBe("summary");
    expect(
      (doneEvent!.results as { successful: unknown[] }).successful
    ).toEqual(successful);
  });

  test("test_emitNormalized_strict_mode_throws_on_failures", async () => {
    const { emitNormalized } = await loadWorkflow();
    const successful = [
      {
        orderId: "X-101",
        customer: "Alice",
        amount: 250,
        currency: "USD",
        sourceFormat: "xml" as const,
      },
    ];
    const failed = [{ messageId: "MSG-BAD", error: "Unknown format" }];

    await expect(emitNormalized(successful, failed, true)).rejects.toThrow(
      "Strict mode: 1 messages failed normalization"
    );
  });

  test(
    "test_full_pipeline_normalizes_all_sample_formats",
    { timeout: 15000 },
    async () => {
      const { detectFormats, parseToCanonical } = await loadWorkflow();
      const messages = [
        {
          id: "MSG-001",
          format: "xml" as const,
          payload:
            '<order id="X-101"><customer>Alice</customer><amount>250.00</amount><currency>USD</currency></order>',
        },
        {
          id: "MSG-002",
          format: "csv" as const,
          payload: "C-202,Bob,89.50,EUR",
        },
        {
          id: "MSG-003",
          format: "legacy-json" as const,
          payload: JSON.stringify({
            order_num: "L-303",
            cust_name: "Charlie",
            total: 1200,
            cur: "GBP",
          }),
        },
      ];

      const detected = await detectFormats(messages);
      expect(detected).toHaveLength(3);

      const parsed = await parseToCanonical(detected);
      expect(parsed.successful).toHaveLength(3);
      expect(parsed.failed).toHaveLength(0);

      for (const order of parsed.successful) {
        expect(order).toHaveProperty("orderId");
        expect(order).toHaveProperty("customer");
        expect(order).toHaveProperty("amount");
        expect(order).toHaveProperty("currency");
        expect(order).toHaveProperty("sourceFormat");
      }
    }
  );

  test("test_writer_close_is_called_after_each_step", async () => {
    const { detectFormats } = await loadWorkflow();
    closeMock.mockClear();
    await detectFormats([
      {
        id: "MSG-001",
        format: "xml" as const,
        payload:
          '<order id="X-101"><customer>A</customer><amount>1</amount><currency>USD</currency></order>',
      },
    ]);

    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
