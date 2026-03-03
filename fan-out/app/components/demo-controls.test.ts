import { describe, expect, test } from "bun:test";

import {
  FAN_OUT_DEMO_DEFAULTS,
  applyChannelEvent,
  createAccumulator,
  parseChannelEvent,
  toggleFailChannel,
} from "./demo";

describe("fan-out compact demo controls", () => {
  test("test_FAN_OUT_DEMO_DEFAULTS_starts_with_implicit_alert_values_and_no_failures", () => {
    expect(FAN_OUT_DEMO_DEFAULTS.incidentId).toBe("INC-2041");
    expect(FAN_OUT_DEMO_DEFAULTS.message.length).toBeGreaterThan(0);
    expect(FAN_OUT_DEMO_DEFAULTS.failChannels).toEqual([]);
  });

  test("test_toggleFailChannel_adds_channel_when_checkbox_is_checked", () => {
    expect(toggleFailChannel([], "email", true)).toEqual(["email"]);
  });

  test("test_toggleFailChannel_preserves_existing_selection_when_checkbox_is_rechecked", () => {
    expect(toggleFailChannel(["sms"], "sms", true)).toEqual(["sms"]);
  });

  test("test_toggleFailChannel_removes_channel_when_checkbox_is_cleared", () => {
    expect(toggleFailChannel(["slack", "pagerduty"], "slack", false)).toEqual([
      "pagerduty",
    ]);
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
      failChannels: [],
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
