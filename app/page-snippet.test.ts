import { describe, expect, test } from "bun:test";

// page.tsx reads the workflow source at runtime via readFileSync,
// so snippet-parity checks must run against the workflow file directly.
const workflowSource = await Bun.file(
  new URL("../workflows/correlation-identifier.ts", import.meta.url)
).text();

describe("correlation-identifier page workflow snippet parity", () => {
  test("test_workflowSnippet_includes_generateCorrelationId_and_generateId_helpers", () => {
    expect(workflowSource).toContain("async function generateCorrelationId(");
    expect(workflowSource).toContain("function generateId()");
    expect(workflowSource).toContain('type: "correlation_id_generated"');
  });

  test("test_workflowSnippet_uses_all_four_step_functions", () => {
    expect(workflowSource).toContain("async function generateCorrelationId(");
    expect(workflowSource).toContain("async function sendRequest(");
    expect(workflowSource).toContain("async function awaitResponse(");
    expect(workflowSource).toContain("async function matchAndDeliver(");
    expect(workflowSource).toContain(
      "return { requestId, correlationId, status:"
    );
  });
});
