import { describe, expect, test } from "bun:test";

// page.tsx reads the workflow source at runtime via readFileSync,
// so snippet-parity checks must run against the workflow file directly.
const workflowSource = await Bun.file(
  new URL("../workflows/detour.ts", import.meta.url)
).text();

describe("detour page workflow snippet parity", () => {
  test("test_workflowSnippet_includes_qaMode_conditional_and_detour_flow_function", () => {
    expect(workflowSource).toContain("export async function detourFlow(");
    expect(workflowSource).toContain("qaMode: boolean");
    expect(workflowSource).toContain("if (qaMode)");
  });

  test("test_workflowSnippet_uses_step_function_names_matching_page_extractFunctionBlock_markers", () => {
    expect(workflowSource).toContain("async function runBuild(");
    expect(workflowSource).toContain("async function runLint(");
    expect(workflowSource).toContain("async function runQaDetour(");
    expect(workflowSource).toContain("async function runDeploy(");
  });

  test("test_workflowSnippet_includes_detour_enter_and_exit_events", () => {
    expect(workflowSource).toContain('type: "detour_entered"');
    expect(workflowSource).toContain('type: "detour_exited"');
  });

  test("test_workflowSnippet_includes_step_running_and_step_complete_events", () => {
    expect(workflowSource).toContain('type: "step_running"');
    expect(workflowSource).toContain('type: "step_complete"');
  });
});
