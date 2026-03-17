import { describe, test, expect } from "bun:test";
import {
  createAccumulator,
  applyRecipientEvent,
  toSnapshot,
  parseRecipientEvent,
} from "./demo";

describe("recipient-list demo state", () => {
  const startResponse = {
    runId: "run-1",
    alertId: "ALERT-1",
    severity: "warning" as const,
    status: "routing" as const,
  };

  test("createAccumulator initializes with routing status", () => {
    const acc = createAccumulator(startResponse);
    expect(acc.status).toBe("routing");
    expect(acc.channels.slack.status).toBe("pending");
    expect(acc.channels.email.status).toBe("pending");
    expect(acc.channels.pagerduty.status).toBe("pending");
    expect(acc.channels.webhook.status).toBe("pending");
  });

  test("rules_evaluated sets matched/skipped channels", () => {
    const acc = createAccumulator(startResponse);
    const next = applyRecipientEvent(acc, {
      type: "rules_evaluated",
      matched: ["slack", "email", "webhook"],
      skipped: ["pagerduty"],
    });

    expect(next.status).toBe("delivering");
    expect(next.channels.slack.status).toBe("matched");
    expect(next.channels.email.status).toBe("matched");
    expect(next.channels.webhook.status).toBe("matched");
    expect(next.channels.pagerduty.status).toBe("skipped");
  });

  test("delivering event transitions channel to delivering", () => {
    let acc = createAccumulator(startResponse);
    acc = applyRecipientEvent(acc, {
      type: "rules_evaluated",
      matched: ["slack"],
      skipped: ["email", "pagerduty", "webhook"],
    });
    acc = applyRecipientEvent(acc, { type: "delivering", channel: "slack" });
    expect(acc.channels.slack.status).toBe("delivering");
  });

  test("delivered event transitions channel", () => {
    let acc = createAccumulator(startResponse);
    acc = applyRecipientEvent(acc, {
      type: "rules_evaluated",
      matched: ["slack"],
      skipped: [],
    });
    acc = applyRecipientEvent(acc, { type: "delivered", channel: "slack", durationMs: 650 });
    expect(acc.channels.slack.status).toBe("delivered");
    expect(acc.channels.slack.durationMs).toBe(650);
  });

  test("done event sets summary", () => {
    let acc = createAccumulator(startResponse);
    acc = applyRecipientEvent(acc, {
      type: "done",
      summary: { delivered: 3, failed: 0, skipped: 1 },
    });
    expect(acc.status).toBe("done");
    expect(acc.summary).toEqual({ delivered: 3, failed: 0, skipped: 1 });
  });

  test("toSnapshot computes elapsedMs", () => {
    const acc = createAccumulator(startResponse);
    const now = Date.now();
    const snap = toSnapshot(acc, now - 1000);
    expect(snap.elapsedMs).toBeGreaterThanOrEqual(900);
  });
});

describe("parseRecipientEvent", () => {
  test("parses rules_evaluated event", () => {
    const raw = 'data: {"type":"rules_evaluated","matched":["slack","email"],"skipped":["pagerduty"]}';
    const event = parseRecipientEvent(raw);
    expect(event).toEqual({
      type: "rules_evaluated",
      matched: ["slack", "email"],
      skipped: ["pagerduty"],
    });
  });

  test("parses delivering event", () => {
    const raw = 'data: {"type":"delivering","channel":"slack"}';
    const event = parseRecipientEvent(raw);
    expect(event).toEqual({ type: "delivering", channel: "slack" });
  });

  test("parses delivered event", () => {
    const raw = 'data: {"type":"delivered","channel":"slack","durationMs":650}';
    const event = parseRecipientEvent(raw);
    expect(event).toEqual({ type: "delivered", channel: "slack", durationMs: 650 });
  });

  test("parses done event", () => {
    const raw = 'data: {"type":"done","summary":{"delivered":3,"failed":0,"skipped":1}}';
    const event = parseRecipientEvent(raw);
    expect(event).toEqual({
      type: "done",
      summary: { delivered: 3, failed: 0, skipped: 1 },
    });
  });

  test("returns null for invalid data", () => {
    expect(parseRecipientEvent("not sse")).toBeNull();
    expect(parseRecipientEvent("data: not json")).toBeNull();
  });
});
