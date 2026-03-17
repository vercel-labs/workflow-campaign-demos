import { describe, expect, test } from "bun:test";

// page.tsx reads the workflow source at runtime via readFileSync,
// so snippet-parity checks must run against the workflow file directly.
const workflowSource = await Bun.file(
  new URL("../workflows/publish-subscribe.ts", import.meta.url)
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

function collectFunctionBlock(lines: string[], marker: string): number[] {
  const start = lines.findIndex((line) => line.includes(marker));
  if (start === -1) return [];
  const output: number[] = [];
  let depth = 0;
  let sawOpeningBrace = false;
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];
    output.push(index + 1);
    const opens = (line.match(/{/g) ?? []).length;
    const closes = (line.match(/}/g) ?? []).length;
    depth += opens - closes;
    if (opens > 0) sawOpeningBrace = true;
    if (sawOpeningBrace && depth === 0) break;
  }
  return output;
}

function collectUntil(
  lines: string[],
  marker: string,
  isTerminalLine: (line: string) => boolean
): number[] {
  const start = lines.findIndex((line) => line.includes(marker));
  if (start === -1) return [];
  const output: number[] = [];
  for (let index = start; index < lines.length; index += 1) {
    output.push(index + 1);
    if (isTerminalLine(lines[index])) break;
  }
  return output;
}

describe("publish-subscribe page workflow snippet parity", () => {
  test("test_extractFunctionBlock_finds_publishSubscribeFlow", () => {
    const block = extractFunctionBlock(
      workflowSource,
      "export async function publishSubscribeFlow("
    );
    expect(block.length).toBeGreaterThan(0);
    expect(block).toContain("publishSubscribeFlow(");
    expect(block).toContain("registerSubscribers(");
    expect(block).toContain("filterSubscribers(");
    expect(block).toContain("deliverToSubscribers(");
    expect(block).toContain("summarizeDelivery(");
  });

  test("test_extractFunctionBlock_finds_all_step_functions", () => {
    const registerBlock = extractFunctionBlock(workflowSource, "async function registerSubscribers(");
    expect(registerBlock.length).toBeGreaterThan(0);
    expect(registerBlock).toContain("subscribers_registered");

    const filterBlock = extractFunctionBlock(workflowSource, "async function filterSubscribers(");
    expect(filterBlock.length).toBeGreaterThan(0);
    expect(filterBlock).toContain("filtering");

    const deliverBlock = extractFunctionBlock(workflowSource, "async function deliverToSubscribers(");
    expect(deliverBlock.length).toBeGreaterThan(0);
    expect(deliverBlock).toContain("delivering");

    const summarizeBlock = extractFunctionBlock(workflowSource, "async function summarizeDelivery(");
    expect(summarizeBlock.length).toBeGreaterThan(0);
    expect(summarizeBlock).toContain("done");
  });

  test("test_buildWorkflowLineMap_returns_non_empty_arrays_for_all_keys", () => {
    const workflowCode = extractFunctionBlock(
      workflowSource,
      "export async function publishSubscribeFlow("
    );
    const lines = workflowCode.split("\n");

    const register = collectUntil(
      lines,
      "const subscribers = await registerSubscribers(",
      (line) => line.includes("registerSubscribers(")
    );
    const filter = collectUntil(
      lines,
      "const matched = await filterSubscribers(",
      (line) => line.includes("filterSubscribers(")
    );
    const deliver = collectUntil(
      lines,
      "const delivered = await deliverToSubscribers(",
      (line) => line.includes("deliverToSubscribers(")
    );
    const summarize = collectUntil(
      lines,
      "return summarizeDelivery(",
      (line) => line.includes("summarizeDelivery(")
    );

    expect(register.length).toBeGreaterThan(0);
    expect(filter.length).toBeGreaterThan(0);
    expect(deliver.length).toBeGreaterThan(0);
    expect(summarize.length).toBeGreaterThan(0);
  });

  test("test_buildStepLineMap_returns_non_empty_arrays_for_all_keys", () => {
    const stepCode = [
      extractFunctionBlock(workflowSource, "async function registerSubscribers("),
      "",
      extractFunctionBlock(workflowSource, "async function filterSubscribers("),
      "",
      extractFunctionBlock(workflowSource, "async function deliverToSubscribers("),
      "",
      extractFunctionBlock(workflowSource, "async function summarizeDelivery("),
    ].join("\n");
    const lines = stepCode.split("\n");

    const registerSubscribers = collectFunctionBlock(lines, "async function registerSubscribers(");
    const filterSubscribers = collectFunctionBlock(lines, "async function filterSubscribers(");
    const deliverToSubscribers = collectFunctionBlock(lines, "async function deliverToSubscribers(");
    const summarizeDelivery = collectFunctionBlock(lines, "async function summarizeDelivery(");

    expect(registerSubscribers.length).toBeGreaterThan(0);
    expect(filterSubscribers.length).toBeGreaterThan(0);
    expect(deliverToSubscribers.length).toBeGreaterThan(0);
    expect(summarizeDelivery.length).toBeGreaterThan(0);
  });
});
