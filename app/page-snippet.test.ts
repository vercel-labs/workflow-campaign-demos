import { describe, expect, test } from "bun:test";

const workflowSource = await Bun.file(
  new URL("../workflows/order-filter.ts", import.meta.url)
).text();

describe("message-filter page workflow snippet parity", () => {
  test("test_workflowSource_contains_orderFilter_entry_point_marker", () => {
    expect(workflowSource).toContain("export async function orderFilter(");
  });

  test("test_workflowSource_contains_applyFraudCheck_step_marker", () => {
    expect(workflowSource).toContain("async function applyFraudCheck(");
  });

  test("test_workflowSource_contains_applyAmountThreshold_step_marker", () => {
    expect(workflowSource).toContain("async function applyAmountThreshold(");
  });

  test("test_workflowSource_contains_applyRegionFilter_step_marker", () => {
    expect(workflowSource).toContain("async function applyRegionFilter(");
  });

  test("test_workflowSource_contains_emitResults_step_marker", () => {
    expect(workflowSource).toContain("async function emitResults(");
  });

  test("test_workflowSource_contains_use_step_directives_for_each_filter_stage", () => {
    const stepDirectives = workflowSource.match(/"use step"/g) ?? [];
    expect(stepDirectives.length).toBeGreaterThanOrEqual(4);
  });

  test("test_workflowSource_contains_sample_orders_and_default_config", () => {
    expect(workflowSource).toContain("SAMPLE_ORDERS");
    expect(workflowSource).toContain("DEFAULT_CONFIG");
    expect(workflowSource).toContain("fraudThreshold: 70");
    expect(workflowSource).toContain("minAmount: 10");
    expect(workflowSource).toContain('allowedRegions: ["US", "EU", "CA"]');
  });
});
