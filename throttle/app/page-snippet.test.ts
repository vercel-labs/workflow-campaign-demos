import { describe, expect, test } from "bun:test";

const workflowSource = await Bun.file(
  new URL("../workflows/throttle.ts", import.meta.url)
).text();

describe("throttle page workflow snippet parity", () => {
  test("test_workflowSnippet_includes_throttleFlow_and_evaluateRequest", () => {
    expect(workflowSource).toContain("export async function throttleFlow(");
    expect(workflowSource).toContain("async function evaluateRequest(");
    expect(workflowSource).toContain('"use workflow"');
    expect(workflowSource).toContain('"use step"');
  });

  test("test_workflowSnippet_uses_token_bucket_events", () => {
    expect(workflowSource).toContain("ThrottleEvent");
    expect(workflowSource).toContain('type: "request_accepted"');
    expect(workflowSource).toContain('type: "request_rejected"');
    expect(workflowSource).toContain('type: "token_check"');
    expect(workflowSource).toContain('type: "token_refilled"');
    expect(workflowSource).toContain(
      "return { accepted, rejected, total: requests.length };"
    );
  });
});
