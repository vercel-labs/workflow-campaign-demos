import { beforeEach, describe, expect, mock, test } from "bun:test";

const writtenEvents: Array<Record<string, unknown>> = [];
const releaseLockMock = mock(() => {});
const writeMock = mock(async (event: unknown) => {
  writtenEvents.push(event as Record<string, unknown>);
});
const getWriterMock = mock(() => ({
  write: writeMock,
  releaseLock: releaseLockMock,
}));
const getWritableMock = mock(() => ({
  getWriter: getWriterMock,
}));

let attemptQueue: number[] = [];
const getStepMetadataMock = mock(() => ({
  attempt: attemptQueue.shift() ?? 1,
}));

mock.module("workflow", () => ({
  getWritable: getWritableMock,
  getStepMetadata: getStepMetadataMock,
}));

async function loadWorkflow() {
  return import("./incident-fanout");
}

describe("incident fan-out workflow", () => {
  beforeEach(() => {
    writtenEvents.length = 0;
    releaseLockMock.mockClear();
    writeMock.mockClear();
    getWriterMock.mockClear();
    getWritableMock.mockClear();
    getStepMetadataMock.mockClear();
    attemptQueue = [1, 1, 1, 1];
  });

  test("test_incidentFanOut_writes_stream_events_and_summary_when_all_channels_succeed", async () => {
    const { incidentFanOut } = await loadWorkflow();
    const report = await incidentFanOut("INC-2041", "DB alert");

    expect(report.status).toBe("done");
    expect(report.deliveries).toHaveLength(4);
    expect(report.summary).toEqual({ ok: 4, failed: 0 });
    expect("results" in (report as Record<string, unknown>)).toBe(false);

    const sendingEvents = writtenEvents.filter(
      (event) => event.type === "channel_sending"
    );
    const sentEvents = writtenEvents.filter((event) => event.type === "channel_sent");
    expect(sendingEvents).toHaveLength(4);
    expect(sentEvents).toHaveLength(4);
    expect(writtenEvents.some((event) => event.type === "aggregating")).toBe(true);
    expect(writtenEvents.some((event) => event.type === "done")).toBe(true);
    expect(releaseLockMock).toHaveBeenCalledTimes(5);
  });

  test("test_incidentFanOut_writes_failure_event_when_channel_errors", async () => {
    const { incidentFanOut } = await loadWorkflow();
    const report = await incidentFanOut("INC-2041", "DB alert", {
      transient: [],
      permanent: ["pagerduty"],
    });

    const pagerDutyDelivery = report.deliveries.find(
      (delivery) => delivery.channel === "pagerduty"
    );

    expect(pagerDutyDelivery?.status).toBe("failed");
    expect(pagerDutyDelivery?.error).toBe(
      "pagerduty: PagerDuty integration is not configured"
    );
    expect(report.summary).toEqual({ ok: 3, failed: 1 });

    // Permanent failures emit channel_failed immediately (FatalError prevents retry).
    const pagerDutyFailureOnAttempt1 = writtenEvents.find(
      (event) =>
        event.type === "channel_failed" &&
        event.channel === "pagerduty" &&
        event.attempt === 1
    );
    expect(pagerDutyFailureOnAttempt1).toBeTruthy();
  });

  test("test_incidentFanOut_writes_retrying_event_when_step_attempt_is_greater_than_one", async () => {
    attemptQueue = [1, 2, 1, 1];
    const { incidentFanOut } = await loadWorkflow();

    await incidentFanOut("INC-2041", "DB alert");

    expect(
      writtenEvents.some(
        (event) =>
          event.type === "channel_retrying" &&
          event.channel === "email" &&
          event.attempt === 2
      )
    ).toBe(true);
  });
});
