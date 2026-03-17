import { describe, expect, test } from "bun:test";

const workflowSource = await Bun.file(
  new URL("./correlation-identifier.ts", import.meta.url).pathname
).text();

const apiSource = await Bun.file(
  new URL("../app/api/correlation-identifier/route.ts", import.meta.url).pathname
).text();

const sseSource = await Bun.file(
  new URL("../app/api/readable/[runId]/route.ts", import.meta.url).pathname
).text();

describe("correlation-identifier workflow source", () => {
  test("exports correlationIdentifierFlow as the main workflow", () => {
    expect(workflowSource).toContain("export async function correlationIdentifierFlow(");
  });

  test("uses 'use workflow' directive", () => {
    expect(workflowSource).toContain('"use workflow"');
  });

  test("uses 'use step' directive for each step function", () => {
    const stepMatches = workflowSource.match(/"use step"/g);
    expect(stepMatches).not.toBeNull();
    // generateCorrelationId, sendRequest, awaitResponse, matchAndDeliver, emitEvent
    expect(stepMatches!.length).toBe(5);
  });

  test("imports getWritable and sleep from workflow", () => {
    expect(workflowSource).toContain('import { getWritable, sleep } from "workflow"');
  });

  test("exports CorrelationEvent type", () => {
    expect(workflowSource).toContain("export type CorrelationEvent =");
  });

  test("exports CorrelationIdentifierResult interface", () => {
    expect(workflowSource).toContain("export interface CorrelationIdentifierResult");
  });

  test("exports RequestStatus type", () => {
    expect(workflowSource).toContain("export type RequestStatus =");
  });

  test("exports ServiceName type", () => {
    expect(workflowSource).toContain("export type ServiceName =");
  });

  test("has all four durable step functions", () => {
    expect(workflowSource).toContain("async function generateCorrelationId(");
    expect(workflowSource).toContain("async function sendRequest(");
    expect(workflowSource).toContain("async function awaitResponse(");
    expect(workflowSource).toContain("async function matchAndDeliver(");
  });

  test("emits correlation_id_generated event", () => {
    expect(workflowSource).toContain('"correlation_id_generated"');
  });

  test("emits request_sent event", () => {
    expect(workflowSource).toContain('"request_sent"');
  });

  test("emits awaiting_response event", () => {
    expect(workflowSource).toContain('"awaiting_response"');
  });

  test("emits response_received event", () => {
    expect(workflowSource).toContain('"response_received"');
  });

  test("emits correlation_matched event", () => {
    expect(workflowSource).toContain('"correlation_matched"');
  });

  test("emits delivery_complete event", () => {
    expect(workflowSource).toContain('"delivery_complete"');
  });

  test("emits done event with status and totalSteps", () => {
    expect(workflowSource).toContain('"done"');
    expect(workflowSource).toContain("status:");
    expect(workflowSource).toContain("totalSteps:");
  });

  test("uses sleep() for durable timeout on response awaiting", () => {
    expect(workflowSource).toContain("sleep(");
  });

  test("defines all four service names", () => {
    expect(workflowSource).toContain('"payment-api"');
    expect(workflowSource).toContain('"inventory-api"');
    expect(workflowSource).toContain('"shipping-api"');
    expect(workflowSource).toContain('"notification-api"');
  });

  test("handles timeout case", () => {
    expect(workflowSource).toContain('"timeout"');
  });

  test("handles delivered case", () => {
    expect(workflowSource).toContain('"delivered"');
  });

  test("generates correlation ID with unique format", () => {
    expect(workflowSource).toContain("generateId()");
    expect(workflowSource).toContain("corr-");
  });

  test("hashes payloads for correlation matching", () => {
    expect(workflowSource).toContain("hashPayload(");
    expect(workflowSource).toContain("requestPayloadHash");
    expect(workflowSource).toContain("responsePayloadHash");
  });
});

describe("correlation-identifier API route source", () => {
  test("exports POST handler", () => {
    expect(apiSource).toContain("export async function POST(");
  });

  test("imports start from workflow/api", () => {
    expect(apiSource).toContain('import { start } from "workflow/api"');
  });

  test("imports correlationIdentifierFlow from workflow module", () => {
    expect(apiSource).toContain("correlationIdentifierFlow");
  });

  test("validates requestId is required", () => {
    expect(apiSource).toContain("requestId is required");
  });

  test("validates payload is required", () => {
    expect(apiSource).toContain("payload is required");
  });

  test("validates service against allowed values", () => {
    expect(apiSource).toContain("VALID_SERVICES");
  });
});

describe("correlation-identifier SSE route source", () => {
  test("exports GET handler", () => {
    expect(sseSource).toContain("export async function GET(");
  });

  test("uses getRun from workflow/api", () => {
    expect(sseSource).toContain("getRun");
  });

  test("returns SSE content type", () => {
    expect(sseSource).toContain("text/event-stream");
  });
});
