import { describe, expect, test } from "bun:test";

// page.tsx reads the workflow source at runtime via readFileSync,
// so snippet-parity checks must run against the workflow file directly.
const workflowSource = await Bun.file(
  new URL("../workflows/recipient-list.ts", import.meta.url)
).text();

describe("recipient-list page workflow snippet parity", () => {
  test("extractFunctionBlock finds recipientList marker", () => {
    expect(workflowSource).toContain(
      "export async function recipientList("
    );
  });

  test("extractFunctionBlock finds deliverToRecipient marker", () => {
    expect(workflowSource).toContain(
      "async function deliverToRecipient("
    );
  });

  test("extractFunctionBlock finds aggregateResults marker", () => {
    expect(workflowSource).toContain(
      "async function aggregateResults("
    );
  });

  test("workflow source contains key constructs used in code panes", () => {
    expect(workflowSource).toContain("RULES.filter(");
    expect(workflowSource).toContain("Promise.allSettled(");
    expect(workflowSource).toContain("getWritable<RecipientEvent>");
    expect(workflowSource).toContain('"use workflow"');
    expect(workflowSource).toContain('"use step"');
  });

  test("workflow source contains CHANNEL_ERROR_MESSAGES and errorMessage helper", () => {
    expect(workflowSource).toContain("CHANNEL_ERROR_MESSAGES");
    expect(workflowSource).toContain("function errorMessage(");
  });
});
