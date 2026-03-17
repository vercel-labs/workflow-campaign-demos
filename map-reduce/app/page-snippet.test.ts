import { describe, expect, test } from "bun:test";

// page.tsx reads the workflow source at runtime via readFileSync,
// so snippet-parity checks must run against the workflow file directly.
const workflowSource = await Bun.file(
  new URL("../workflows/map-reduce.ts", import.meta.url)
).text();

describe("map-reduce page workflow snippet parity", () => {
  test("test_workflowSnippet_includes_partitionInput_and_mapReduce_function_markers", () => {
    expect(workflowSource).toContain("export function partitionInput(");
    expect(workflowSource).toContain("export async function mapReduce(");
    expect(workflowSource).toContain("async function mapPartition(");
    expect(workflowSource).toContain("async function reduceResults(");
  });

  test("test_workflowSnippet_uses_Promise_all_for_parallel_mapping", () => {
    expect(workflowSource).toContain("const partitionResults = await Promise.all(");
    expect(workflowSource).toContain("return reduceResults(jobId, partitionResults);");
  });
});
