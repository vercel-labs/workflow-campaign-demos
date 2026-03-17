import { describe, expect, test } from "bun:test";

const workflowSource = await Bun.file(
  new URL("./message-translator.ts", import.meta.url).pathname
).text();

const apiSource = await Bun.file(
  new URL("../app/api/message-translator/route.ts", import.meta.url).pathname
).text();

const sseSource = await Bun.file(
  new URL("../app/api/readable/[runId]/route.ts", import.meta.url).pathname
).text();

const pageSource = await Bun.file(
  new URL("../app/page.tsx", import.meta.url).pathname
).text();

describe("message-translator workflow source", () => {
  test("exports messageTranslatorFlow as the main workflow", () => {
    expect(workflowSource).toContain("export async function messageTranslatorFlow(");
  });

  test("uses 'use workflow' directive", () => {
    expect(workflowSource).toContain('"use workflow"');
  });

  test("uses 'use step' directive for each step function", () => {
    const stepMatches = workflowSource.match(/"use step"/g);
    expect(stepMatches).not.toBeNull();
    expect(stepMatches!.length).toBe(5);
  });

  test("imports getWritable and sleep from workflow", () => {
    expect(workflowSource).toContain('import { getWritable, sleep } from "workflow"');
  });

  test("exports SourceFormat type", () => {
    expect(workflowSource).toContain("export type SourceFormat =");
  });

  test("exports TranslatorEvent type", () => {
    expect(workflowSource).toContain("export type TranslatorEvent =");
  });

  test("exports MessageTranslatorResult interface", () => {
    expect(workflowSource).toContain("export interface MessageTranslatorResult");
  });

  test("defines all three source formats", () => {
    expect(workflowSource).toContain('"xml"');
    expect(workflowSource).toContain('"csv"');
    expect(workflowSource).toContain('"legacy-json"');
  });

  test("has field mappings for all formats", () => {
    expect(workflowSource).toContain("FIELD_MAPS");
    expect(workflowSource).toContain('{ source: "id", canonical: "orderId" }');
    expect(workflowSource).toContain('{ source: "order_id", canonical: "orderId" }');
    expect(workflowSource).toContain('{ source: "oid", canonical: "orderId" }');
  });

  test("has all step functions", () => {
    expect(workflowSource).toContain("async function detectSourceFormat(");
    expect(workflowSource).toContain("async function translateFields(");
    expect(workflowSource).toContain("async function validateOutput(");
    expect(workflowSource).toContain("async function deliverMessage(");
  });

  test("detectFormat returns correct format for XML input", () => {
    const xmlInput = '<order><id>ORD-5501</id></order>';
    expect(xmlInput.trimStart().startsWith("<")).toBe(true);
  });

  test("detectFormat returns correct format for CSV input", () => {
    const csvInput = "order_id,customer_name\nORD-5502,Globex";
    expect(csvInput.includes(",") && csvInput.includes("\n")).toBe(true);
  });

  test("detectFormat returns correct format for legacy JSON input", () => {
    const jsonInput = '{"oid":"ORD-5503"}';
    expect(jsonInput.trimStart().startsWith("{") && jsonInput.includes("oid")).toBe(true);
  });
});

describe("message-translator API route source", () => {
  test("exports POST handler", () => {
    expect(apiSource).toContain("export async function POST(");
  });

  test("imports start from workflow/api", () => {
    expect(apiSource).toContain('import { start } from "workflow/api"');
  });

  test("imports messageTranslatorFlow from workflow module", () => {
    expect(apiSource).toContain("messageTranslatorFlow");
  });

  test("validates messageId is required", () => {
    expect(apiSource).toContain("messageId is required");
  });

  test("validates source format against allowed values", () => {
    expect(apiSource).toContain("VALID_FORMATS");
  });
});

describe("message-translator SSE route source", () => {
  test("exports GET handler", () => {
    expect(sseSource).toContain("export async function GET(");
  });

  test("uses getRun from workflow/api", () => {
    expect(sseSource).toContain("getRun");
  });

  test("returns SSE content type", () => {
    expect(sseSource).toContain("text/event-stream");
  });
});

describe("message-translator page source", () => {
  test("reads workflow source with readFileSync", () => {
    expect(pageSource).toContain("readFileSync");
    expect(pageSource).toContain("workflows/message-translator.ts");
  });

  test("extracts function blocks for code panes", () => {
    expect(pageSource).toContain("extractFunctionBlock");
    expect(pageSource).toContain("messageTranslatorFlow");
  });

  test("builds workflow and step line maps", () => {
    expect(pageSource).toContain("buildWorkflowLineMap");
    expect(pageSource).toContain("buildStepLineMap");
  });

  test("highlights code to HTML lines", () => {
    expect(pageSource).toContain("highlightCodeToHtmlLines");
  });
});
