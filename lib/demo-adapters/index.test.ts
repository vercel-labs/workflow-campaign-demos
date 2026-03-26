import { describe, test, expect } from "bun:test";
import { getAdapter, getRegisteredSlugs } from "./index";
import { demos } from "../demos";

describe("demo adapter registry", () => {
  test("known slug 'fan-out' resolves to an adapter", () => {
    const adapter = getAdapter("fan-out");
    expect(adapter).toBeDefined();
    expect(adapter!.slug).toBe("fan-out");
    expect(adapter!.title).toBe("Fan-Out Notifications");
  });

  test("known slug 'approval-chain' resolves to an adapter", () => {
    const adapter = getAdapter("approval-chain");
    expect(adapter).toBeDefined();
    expect(adapter!.slug).toBe("approval-chain");
    expect(adapter!.title).toBe("Approval Chain");
  });

  test("unknown slug returns undefined", () => {
    const adapter = getAdapter("nonexistent-demo");
    expect(adapter).toBeUndefined();
  });

  test("every registered slug exists in the catalog", () => {
    const slugs = getRegisteredSlugs();
    const catalogSlugs = new Set(demos.map((demo) => demo.slug));
    for (const slug of slugs) {
      expect(catalogSlugs.has(slug)).toBe(true);
    }
  });
});

describe("fan-out adapter", () => {
  test("getCodeBundle returns files with at least one workflow", async () => {
    const adapter = getAdapter("fan-out")!;
    const files = await adapter.getCodeBundle();

    expect(files.length).toBeGreaterThanOrEqual(1);

    const workflowFiles = files.filter((f) => f.role === "workflow");
    expect(workflowFiles.length).toBeGreaterThanOrEqual(1);
    expect(workflowFiles[0].path).toContain("workflows/");
    expect(workflowFiles[0].contents.length).toBeGreaterThan(0);
  });

  test("apiRoutes includes start and readable with load functions", () => {
    const adapter = getAdapter("fan-out")!;
    const kinds = adapter.apiRoutes.map((r) => r.kind);
    expect(kinds).toContain("start");
    expect(kinds).toContain("readable");

    for (const route of adapter.apiRoutes) {
      expect(typeof route.load).toBe("function");
    }
  });

  test("renderPage returns a React element", async () => {
    const adapter = getAdapter("fan-out")!;
    const element = await adapter.renderPage();
    expect(element).toBeDefined();
    expect(element.type).toBe("main");
  });
});

describe("approval-chain adapter", () => {
  test("getCodeBundle returns files with at least one workflow", async () => {
    const adapter = getAdapter("approval-chain")!;
    const files = await adapter.getCodeBundle();

    expect(files.length).toBeGreaterThanOrEqual(1);

    const workflowFiles = files.filter((f) => f.role === "workflow");
    expect(workflowFiles.length).toBeGreaterThanOrEqual(1);
    expect(workflowFiles[0].contents).toContain("use workflow");
  });

  test("apiRoutes includes extra approve route with load function", () => {
    const adapter = getAdapter("approval-chain")!;
    const extraRoutes = adapter.apiRoutes.filter((r) => r.kind === "extra");
    expect(extraRoutes.length).toBe(1);
    expect(extraRoutes[0].route).toContain("approve");
    expect(typeof extraRoutes[0].load).toBe("function");
  });

  test("code bundle includes the extra approve route file", async () => {
    const adapter = getAdapter("approval-chain")!;
    const files = await adapter.getCodeBundle();
    const approveFile = files.find((f) => f.path.includes("approve/route.ts"));
    expect(approveFile).toBeDefined();
    expect(approveFile!.role).toBe("api");
  });

  test("renderPage returns a React element", async () => {
    const adapter = getAdapter("approval-chain")!;
    const element = await adapter.renderPage();
    expect(element).toBeDefined();
    expect(element.type).toBe("main");
  });
});
