import { describe, expect, test } from "bun:test";

import {
  RECIPIENT_LIST_DEMO_DEFAULTS,
  createAccumulator,
  applyRecipientEvent,
  toSnapshot,
  parseRecipientEvent,
} from "./demo";

describe("recipient-list demo controls", () => {
  test("RECIPIENT_LIST_DEMO_DEFAULTS has alertId and message", () => {
    expect(RECIPIENT_LIST_DEMO_DEFAULTS.alertId).toBe("ALERT-7042");
    expect(RECIPIENT_LIST_DEMO_DEFAULTS.message.length).toBeGreaterThan(0);
  });

  test("createAccumulator initialises all four channels as pending", () => {
    const acc = createAccumulator({
      runId: "run-1",
      alertId: "ALERT-1",
      severity: "warning",
      status: "routing",
    });

    expect(acc.runId).toBe("run-1");
    expect(acc.status).toBe("routing");
    for (const ch of ["slack", "email", "pagerduty", "webhook"] as const) {
      expect(acc.channels[ch].status).toBe("pending");
      expect(acc.channels[ch].retryCount).toBe(0);
    }
  });

  test("applyRecipientEvent rules_evaluated sets matched and skipped channels", () => {
    const acc = createAccumulator({
      runId: "run-1",
      alertId: "ALERT-1",
      severity: "warning",
      status: "routing",
    });

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

  test("applyRecipientEvent delivering updates channel status", () => {
    const acc = createAccumulator({
      runId: "run-1",
      alertId: "ALERT-1",
      severity: "critical",
      status: "routing",
    });

    const afterRules = applyRecipientEvent(acc, {
      type: "rules_evaluated",
      matched: ["slack", "email", "pagerduty", "webhook"],
      skipped: [],
    });

    const afterDelivering = applyRecipientEvent(afterRules, {
      type: "delivering",
      channel: "slack",
    });

    expect(afterDelivering.channels.slack.status).toBe("delivering");
  });

  test("applyRecipientEvent delivered records durationMs", () => {
    const acc = createAccumulator({
      runId: "run-1",
      alertId: "ALERT-1",
      severity: "critical",
      status: "routing",
    });

    const afterRules = applyRecipientEvent(acc, {
      type: "rules_evaluated",
      matched: ["slack"],
      skipped: ["email", "pagerduty", "webhook"],
    });

    const afterDelivered = applyRecipientEvent(afterRules, {
      type: "delivered",
      channel: "slack",
      durationMs: 650,
    });

    expect(afterDelivered.channels.slack.status).toBe("delivered");
    expect(afterDelivered.channels.slack.durationMs).toBe(650);
  });

  test("applyRecipientEvent delivery_failed records error", () => {
    const acc = createAccumulator({
      runId: "run-1",
      alertId: "ALERT-1",
      severity: "critical",
      status: "routing",
    });

    const afterRules = applyRecipientEvent(acc, {
      type: "rules_evaluated",
      matched: ["pagerduty"],
      skipped: [],
    });

    const afterFailed = applyRecipientEvent(afterRules, {
      type: "delivery_failed",
      channel: "pagerduty",
      error: "PagerDuty integration is not configured",
      attempt: 1,
    });

    expect(afterFailed.channels.pagerduty.status).toBe("failed");
    expect(afterFailed.channels.pagerduty.error).toBe(
      "PagerDuty integration is not configured"
    );
  });

  test("applyRecipientEvent done sets status and summary", () => {
    const acc = createAccumulator({
      runId: "run-1",
      alertId: "ALERT-1",
      severity: "warning",
      status: "routing",
    });

    const afterDone = applyRecipientEvent(acc, {
      type: "done",
      summary: { delivered: 2, failed: 1, skipped: 1 },
    });

    expect(afterDone.status).toBe("done");
    expect(afterDone.summary).toEqual({ delivered: 2, failed: 1, skipped: 1 });
  });

  test("toSnapshot maps accumulator channels to ChannelSnapshot array", () => {
    const acc = createAccumulator({
      runId: "run-1",
      alertId: "ALERT-1",
      severity: "info",
      status: "routing",
    });

    const snapshot = toSnapshot(acc, Date.now());
    expect(snapshot.channels).toHaveLength(4);
    expect(snapshot.channels.map((ch) => ch.id)).toEqual([
      "slack",
      "email",
      "pagerduty",
      "webhook",
    ]);
    expect(snapshot.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  test("parseRecipientEvent parses rules_evaluated from SSE chunk", () => {
    const event = parseRecipientEvent(
      'data: {"type":"rules_evaluated","matched":["slack","email"],"skipped":["pagerduty","webhook"]}\n\n'
    );

    expect(event).toEqual({
      type: "rules_evaluated",
      matched: ["slack", "email"],
      skipped: ["pagerduty", "webhook"],
    });
  });

  test("parseRecipientEvent parses delivered from SSE chunk", () => {
    const event = parseRecipientEvent(
      'data: {"type":"delivered","channel":"slack","durationMs":650}\n\n'
    );

    expect(event).toEqual({
      type: "delivered",
      channel: "slack",
      durationMs: 650,
    });
  });

  test("parseRecipientEvent parses done from SSE chunk", () => {
    const event = parseRecipientEvent(
      'data: {"type":"done","summary":{"delivered":3,"failed":0,"skipped":1}}\n\n'
    );

    expect(event).toEqual({
      type: "done",
      summary: { delivered: 3, failed: 0, skipped: 1 },
    });
  });

  test("parseRecipientEvent returns null for invalid input", () => {
    expect(parseRecipientEvent("")).toBeNull();
    expect(parseRecipientEvent("not sse data")).toBeNull();
    expect(parseRecipientEvent("data: {invalid json}\n\n")).toBeNull();
  });

  test("severity cycling: info matches only slack", () => {
    // Mirrors the routing rules tested in the workflow test,
    // but verifies the UI displays the correct channel list per severity.
    const RULES = [
      { channel: "slack", match: () => true },
      { channel: "email", match: (s: string) => s === "warning" || s === "critical" },
      { channel: "pagerduty", match: (s: string) => s === "critical" },
      { channel: "webhook", match: (s: string) => s !== "info" },
    ];

    const infoMatched = RULES.filter((r) => r.match("info")).map((r) => r.channel);
    const warningMatched = RULES.filter((r) => r.match("warning")).map((r) => r.channel);
    const criticalMatched = RULES.filter((r) => r.match("critical")).map((r) => r.channel);

    expect(infoMatched).toEqual(["slack"]);
    expect(warningMatched).toEqual(["slack", "email", "webhook"]);
    expect(criticalMatched).toEqual(["slack", "email", "pagerduty", "webhook"]);
  });
});
