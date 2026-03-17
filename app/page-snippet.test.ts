import { describe, expect, test } from "bun:test";

// page.tsx reads the workflow source at runtime via readFileSync,
// so snippet-parity checks must run against the workflow file directly.
const workflowSource = await Bun.file(
  new URL("../workflows/request-reply.ts", import.meta.url)
).text();

describe("request-reply page workflow snippet parity", () => {
  test("test_workflowSnippet_includes_sendRequest_step_and_event_types", () => {
    expect(workflowSource).toContain("async function sendRequest(");
    expect(workflowSource).toContain('type: "request_sent"');
    expect(workflowSource).toContain('type: "waiting_for_reply"');
    expect(workflowSource).toContain('type: "reply_received"');
    expect(workflowSource).toContain('type: "timeout"');
    expect(workflowSource).toContain('type: "retrying"');
  });

  test("test_workflowSnippet_uses_sequential_service_loop_with_timeout_and_retry", () => {
    expect(workflowSource).toContain("export async function requestReplyFlow(");
    expect(workflowSource).toContain("for (const service of services)");
    expect(workflowSource).toContain("for (let attempt = 1; attempt <= maxAttempts; attempt++)");
    expect(workflowSource).toContain('type: "all_replies_collected"');
    expect(workflowSource).toContain(
      "return { requestId, results };"
    );
  });
});
