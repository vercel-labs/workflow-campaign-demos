import { describe, expect, test } from "bun:test";

import {
  FAN_OUT_DEMO_DEFAULTS,
  applyChannelEvent,
  createAccumulator,
  parseChannelEvent,
  cycleFailureMode,
} from "./demo";

describe("fan-out compact demo controls", () => {
  test("test_FAN_OUT_DEMO_DEFAULTS_starts_with_implicit_alert_values", () => {
    expect(FAN_OUT_DEMO_DEFAULTS.incidentId).toBe("INC-2041");
    expect(FAN_OUT_DEMO_DEFAULTS.message.length).toBeGreaterThan(0);
  });

  test("test_cycleFailureMode_cycles_channel_from_none_to_transient", () => {
    const initial = { slack: "none" as const, email: "none" as const, sms: "none" as const, pagerduty: "none" as const };
    const result = cycleFailureMode(initial, "email");
    expect(result.email).toBe("transient");
  });

  test("test_cycleFailureMode_cycles_channel_from_transient_to_permanent", () => {
    const initial = { slack: "none" as const, email: "transient" as const, sms: "none" as const, pagerduty: "none" as const };
    const result = cycleFailureMode(initial, "email");
    expect(result.email).toBe("permanent");
  });

  test("test_cycleFailureMode_cycles_channel_from_permanent_to_none", () => {
    const initial = { slack: "none" as const, email: "permanent" as const, sms: "none" as const, pagerduty: "none" as const };
    const result = cycleFailureMode(initial, "email");
    expect(result.email).toBe("none");
  });

  test("test_parseChannelEvent_parses_done_event_summary_from_sse_chunk", () => {
    const event = parseChannelEvent(
      'data: {"type":"done","summary":{"ok":3,"failed":1}}\n\n'
    );

    expect(event).toEqual({
      type: "done",
      summary: { ok: 3, failed: 1 },
    });
  });

  test("test_applyChannelEvent_updates_channel_status_and_summary_for_streamed_events", () => {
    const start = {
      runId: "run-1",
      incidentId: "INC-77",
      message: "Latency spike",
      failures: { transient: [], permanent: [] },
      status: "fan_out" as const,
    };

    const afterSending = applyChannelEvent(createAccumulator(start), {
      type: "channel_sending",
      channel: "slack",
    });
    const afterSent = applyChannelEvent(afterSending, {
      type: "channel_sent",
      channel: "slack",
      providerId: "slack_provider_1",
    });
    const completed = applyChannelEvent(afterSent, {
      type: "done",
      summary: { ok: 1, failed: 0 },
    });

    expect(afterSending.channels.slack.status).toBe("sending");
    expect(afterSent.channels.slack.status).toBe("sent");
    expect(completed.status).toBe("done");
    expect(completed.summary).toEqual({ ok: 1, failed: 0 });
  });
});
