import { describe, test, expect } from "bun:test";
import { getAdapter, getRegisteredSlugs } from "./index";

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

  test("getRegisteredSlugs returns all mounted slugs", () => {
    const slugs = getRegisteredSlugs();
    expect(slugs).toContain("fan-out");
    expect(slugs).toContain("approval-chain");
    expect(slugs.length).toBe(2);
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

  test("apiRoutes includes start and readable", () => {
    const adapter = getAdapter("fan-out")!;
    const kinds = adapter.apiRoutes.map((r) => r.kind);
    expect(kinds).toContain("start");
    expect(kinds).toContain("readable");
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

  test("apiRoutes includes extra approve route", () => {
    const adapter = getAdapter("approval-chain")!;
    const extraRoutes = adapter.apiRoutes.filter((r) => r.kind === "extra");
    expect(extraRoutes.length).toBe(1);
    expect(extraRoutes[0].route).toContain("approve");
  });

  test("code bundle includes the extra approve route file", async () => {
    const adapter = getAdapter("approval-chain")!;
    const files = await adapter.getCodeBundle();
    const approveFile = files.find((f) => f.path.includes("approve/route.ts"));
    expect(approveFile).toBeDefined();
    expect(approveFile!.role).toBe("api");
  });
});
