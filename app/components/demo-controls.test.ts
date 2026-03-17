import { describe, expect, test } from "bun:test";

import {
  SAMPLE_REQUESTS,
  applyCorrelationEvent,
  createAccumulator,
  parseCorrelationEvent,
  cycleSelectedRequest,
} from "./demo";

describe("correlation-identifier compact demo controls", () => {
  test("test_SAMPLE_REQUESTS_starts_with_payment_api_request", () => {
    expect(SAMPLE_REQUESTS[0].id).toBe("REQ-4001");
    expect(SAMPLE_REQUESTS[0].service).toBe("payment-api");
    expect(SAMPLE_REQUESTS[0].payload.length).toBeGreaterThan(0);
  });

  test("test_cycleSelectedRequest_wraps_around_to_zero", () => {
    expect(cycleSelectedRequest(0)).toBe(1);
    expect(cycleSelectedRequest(SAMPLE_REQUESTS.length - 1)).toBe(0);
  });

  test("test_parseCorrelationEvent_parses_correlation_id_generated_from_sse_chunk", () => {
    const event = parseCorrelationEvent(
      'data: {"type":"correlation_id_generated","requestId":"REQ-1","correlationId":"corr-abc123"}\n\n'
    );

    expect(event).toEqual({
      type: "correlation_id_generated",
      requestId: "REQ-1",
      correlationId: "corr-abc123",
    });
  });

  test("test_parseCorrelationEvent_parses_done_event_from_sse_chunk", () => {
    const event = parseCorrelationEvent(
      'data: {"type":"done","requestId":"REQ-1","correlationId":"corr-abc123","status":"delivered","totalSteps":4}\n\n'
    );

    expect(event).toEqual({
      type: "done",
      requestId: "REQ-1",
      correlationId: "corr-abc123",
      status: "delivered",
      totalSteps: 4,
    });
  });

  test("test_parseCorrelationEvent_returns_null_for_invalid_sse", () => {
    expect(parseCorrelationEvent("not sse data")).toBeNull();
    expect(parseCorrelationEvent("data: {invalid json}\n\n")).toBeNull();
  });

  test("test_applyCorrelationEvent_updates_state_through_full_lifecycle", () => {
    const start = {
      runId: "run-1",
      requestId: "REQ-1",
      service: "payment-api" as const,
      payload: "charge $10",
      status: "pending" as const,
    };

    const acc = createAccumulator(start);
    expect(acc.status).toBe("generating");
    expect(acc.correlationId).toBeNull();

    const afterGenerate = applyCorrelationEvent(acc, {
      type: "correlation_id_generated",
      requestId: "REQ-1",
      correlationId: "corr-xyz",
    });
    expect(afterGenerate.status).toBe("sending");
    expect(afterGenerate.correlationId).toBe("corr-xyz");

    const afterSent = applyCorrelationEvent(afterGenerate, {
      type: "request_sent",
      requestId: "REQ-1",
      correlationId: "corr-xyz",
      service: "payment-api",
    });
    expect(afterSent.status).toBe("awaiting");

    const afterResponse = applyCorrelationEvent(afterSent, {
      type: "response_received",
      requestId: "REQ-1",
      correlationId: "corr-xyz",
      responseService: "payment-api",
      latencyMs: 750,
    });
    expect(afterResponse.status).toBe("matching");
    expect(afterResponse.latencyMs).toBe(750);

    const afterMatch = applyCorrelationEvent(afterResponse, {
      type: "correlation_matched",
      requestId: "REQ-1",
      correlationId: "corr-xyz",
      requestPayloadHash: "aabbccdd",
      responsePayloadHash: "11223344",
    });
    expect(afterMatch.requestHash).toBe("aabbccdd");
    expect(afterMatch.responseHash).toBe("11223344");

    const afterDeliver = applyCorrelationEvent(afterMatch, {
      type: "delivery_complete",
      requestId: "REQ-1",
      correlationId: "corr-xyz",
      destination: "payment-api-callback",
    });
    expect(afterDeliver.destination).toBe("payment-api-callback");

    const completed = applyCorrelationEvent(afterDeliver, {
      type: "done",
      requestId: "REQ-1",
      correlationId: "corr-xyz",
      status: "delivered",
      totalSteps: 4,
    });
    expect(completed.status).toBe("done");
    expect(completed.finalStatus).toBe("delivered");
    expect(completed.totalSteps).toBe(4);
  });

  test("test_applyCorrelationEvent_handles_timeout_path", () => {
    const start = {
      runId: "run-2",
      requestId: "REQ-2",
      service: "inventory-api" as const,
      payload: "check stock",
      status: "pending" as const,
    };

    const acc = createAccumulator(start);
    const afterTimeout = applyCorrelationEvent(acc, {
      type: "timeout_expired",
      requestId: "REQ-2",
      correlationId: "corr-timeout",
    });
    expect(afterTimeout.status).toBe("done");
    expect(afterTimeout.finalStatus).toBe("timeout");
  });
});
