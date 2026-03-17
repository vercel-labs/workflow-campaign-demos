import { describe, expect, test } from "bun:test";

// page.tsx reads the workflow source at runtime via readFileSync,
// so snippet-parity checks must run against the workflow file directly.
const workflowSource = await Bun.file(
  new URL("../workflows/wire-tap.ts", import.meta.url)
).text();

function extractFunctionBlock(source: string, marker: string): string {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line.includes(marker));
  if (start === -1) return "";
  const output: string[] = [];
  let depth = 0;
  let sawBrace = false;
  for (let i = start; i < lines.length; i++) {
    output.push(lines[i]);
    const opens = (lines[i].match(/{/g) ?? []).length;
    const closes = (lines[i].match(/}/g) ?? []).length;
    depth += opens - closes;
    if (opens > 0) sawBrace = true;
    if (sawBrace && depth === 0) break;
  }
  return output.join("\n");
}

describe("wire-tap page workflow snippet parity", () => {
  test("test_extractFunctionBlock_finds_wireTap_main_workflow", () => {
    const block = extractFunctionBlock(
      workflowSource,
      "export async function wireTap("
    );
    expect(block).toContain("use workflow");
    expect(block).toContain("auditTrail");
    expect(block).toContain("await validateOrder(");
    expect(block).toContain("await enrichOrder(");
    expect(block).toContain("await transformOrder(");
    expect(block).toContain("await deliverOrder(");
    expect(block).toContain("await emitDone(");
  });

  test("test_extractFunctionBlock_finds_validateOrder_step", () => {
    const block = extractFunctionBlock(
      workflowSource,
      "async function validateOrder("
    );
    expect(block.length).toBeGreaterThan(0);
    expect(block).toContain("async function validateOrder(");
    expect(block).toContain("OrderPayload");
  });

  test("test_extractFunctionBlock_finds_enrichOrder_step", () => {
    const block = extractFunctionBlock(
      workflowSource,
      "async function enrichOrder("
    );
    expect(block.length).toBeGreaterThan(0);
    expect(block).toContain("async function enrichOrder(");
    expect(block).toContain("OrderPayload");
  });

  test("test_extractFunctionBlock_finds_transformOrder_step", () => {
    const block = extractFunctionBlock(
      workflowSource,
      "async function transformOrder("
    );
    expect(block.length).toBeGreaterThan(0);
    expect(block).toContain("async function transformOrder(");
  });

  test("test_extractFunctionBlock_finds_deliverOrder_step", () => {
    const block = extractFunctionBlock(
      workflowSource,
      "async function deliverOrder("
    );
    expect(block.length).toBeGreaterThan(0);
    expect(block).toContain("async function deliverOrder(");
  });

  test("test_extractFunctionBlock_finds_emitDone_step", () => {
    const block = extractFunctionBlock(
      workflowSource,
      "async function emitDone("
    );
    expect(block).toContain("use step");
    expect(block).toContain('type: "done"');
  });

  test("test_extractFunctionBlock_returns_empty_for_missing_marker", () => {
    const block = extractFunctionBlock(
      workflowSource,
      "async function nonExistent("
    );
    expect(block).toBe("");
  });

  test("test_workflowSource_contains_FatalError_for_invalid_quantity", () => {
    expect(workflowSource).toContain("quantity <= 0");
    expect(workflowSource).toContain("FatalError");
    expect(workflowSource).toContain("Invalid quantity: must be greater than 0");
  });
});
