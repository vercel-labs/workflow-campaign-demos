import { describe, test, expect, mock } from "bun:test";

// Mock the workflow SDK imports before importing the module
mock.module("workflow", () => {
  let attemptCount = 0;
  return {
    getWritable: () => ({
      getWriter: () => ({
        write: async () => {},
        releaseLock: () => {},
      }),
    }),
    getStepMetadata: () => {
      attemptCount++;
      return { attempt: attemptCount };
    },
  };
});

// Dynamic import after mocking
const { guaranteedDelivery } = await import("./guaranteed-delivery");

describe("guaranteedDelivery workflow", () => {
  test("exports a guaranteedDelivery function", () => {
    expect(typeof guaranteedDelivery).toBe("function");
  });

  test("returns a DeliveryReport with correct structure for successful messages", async () => {
    const result = await guaranteedDelivery(["msg-001", "msg-002"], []);

    expect(result).toHaveProperty("status", "done");
    expect(result).toHaveProperty("results");
    expect(result).toHaveProperty("summary");
    expect(Array.isArray(result.results)).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.summary.delivered).toBe(2);
    expect(result.summary.failed).toBe(0);

    for (const r of result.results) {
      expect(r.status).toBe("delivered");
      expect(r.attempts).toBeGreaterThan(0);
    }
  });

  test("marks failed messages correctly after max attempts", async () => {
    // Reset the mock attempt counter by re-mocking
    let callCount = 0;
    mock.module("workflow", () => {
      return {
        getWritable: () => ({
          getWriter: () => ({
            write: async () => {},
            releaseLock: () => {},
          }),
        }),
        getStepMetadata: () => {
          callCount++;
          // Return attempt 3 (max) so the failure path triggers immediately
          return { attempt: 3 };
        },
      };
    });

    const mod = await import("./guaranteed-delivery");
    const result = await mod.guaranteedDelivery(
      ["msg-001", "msg-002"],
      ["msg-002"]
    );

    expect(result.status).toBe("done");
    expect(result.summary.delivered).toBe(1);
    expect(result.summary.failed).toBe(1);

    const failedMsg = result.results.find((r) => r.messageId === "msg-002");
    expect(failedMsg).toBeDefined();
    expect(failedMsg!.status).toBe("failed");
    expect(failedMsg!.error).toContain("Delivery failed");
  });

  test("GDEvent type union covers all expected event types", async () => {
    const events: string[] = [];
    mock.module("workflow", () => {
      return {
        getWritable: () => ({
          getWriter: () => ({
            write: async (event: { type: string }) => {
              events.push(event.type);
            },
            releaseLock: () => {},
          }),
        }),
        getStepMetadata: () => ({ attempt: 1 }),
      };
    });

    const mod = await import("./guaranteed-delivery");
    await mod.guaranteedDelivery(["msg-001"], []);

    expect(events).toContain("persist");
    expect(events).toContain("send");
    expect(events).toContain("ack");
    expect(events).toContain("confirm");
    expect(events).toContain("done");
  });
});
