import { describe, expect, test } from "bun:test";

// page.tsx reads the workflow source at runtime via readFileSync,
// so snippet-parity checks must run against the workflow file directly.
const workflowSource = await Bun.file(
  new URL("../workflows/order-splitter.ts", import.meta.url)
).text();

describe("splitter page workflow snippet parity", () => {
  test("test_workflowSnippet_includes_orderSplitter_and_processLineItem_function_markers", () => {
    expect(workflowSource).toContain("export async function orderSplitter(");
    expect(workflowSource).toContain("async function processLineItem(");
  });

  test("test_workflowSnippet_includes_event_type_markers_used_by_line_map_extraction", () => {
    // These markers are used by page.tsx buildWorkflowLineMap / buildStepLineMap
    expect(workflowSource).toContain('type: "splitting"');
    expect(workflowSource).toContain("for (let i = 0;");
    expect(workflowSource).toContain('type: "aggregating"');
    expect(workflowSource).toContain('type: "done"');
    expect(workflowSource).toContain('type: "item_processing"');
    expect(workflowSource).toContain('type: "item_validated"');
    expect(workflowSource).toContain("if (shouldFail)");
    expect(workflowSource).toContain('type: "item_reserved"');
    expect(workflowSource).toContain('type: "item_fulfilled"');
  });

  test("test_workflowSnippet_includes_delay_constants_used_as_terminal_line_markers", () => {
    expect(workflowSource).toContain("ITEM_DELAY_MS");
    expect(workflowSource).toContain("AGGREGATE_DELAY_MS");
  });

  test("test_workflowSnippet_uses_FatalError_and_getWritable_for_workflow_parity", () => {
    expect(workflowSource).toContain("throw new FatalError(");
    expect(workflowSource).toContain("getWritable<SplitterEvent>().getWriter()");
    expect(workflowSource).toContain("writer.releaseLock()");
  });
});
