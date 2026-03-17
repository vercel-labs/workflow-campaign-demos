import { describe, expect, test } from "bun:test";

// page.tsx reads the workflow source at runtime via readFileSync,
// so snippet-parity checks must run against the workflow file directly.
const workflowSource = await Bun.file(
  new URL("../workflows/content-based-router.ts", import.meta.url)
).text();

describe("content-based-router page workflow snippet parity", () => {
  test("test_workflowSnippet_includes_classifyTicket_and_classifyContent_helpers", () => {
    expect(workflowSource).toContain("async function classifyTicket(");
    expect(workflowSource).toContain("function classifyContent(subject: string)");
    expect(workflowSource).toContain('type: "classifying"');
    expect(workflowSource).toContain('type: "classified"');
  });

  test("test_workflowSnippet_uses_all_four_handler_branches_for_routing", () => {
    expect(workflowSource).toContain("async function handleBilling(");
    expect(workflowSource).toContain("async function handleTechnical(");
    expect(workflowSource).toContain("async function handleAccount(");
    expect(workflowSource).toContain("async function handleFeedback(");
    expect(workflowSource).toContain('if (ticketType === "billing")');
    expect(workflowSource).toContain(
      "return { ticketId, routedTo: ticketType, totalSteps };"
    );
  });
});
