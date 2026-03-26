import { describe, test, expect } from "bun:test";
import { getAdapter } from "./index";

describe("approval-chain adapter", () => {
  test("resolves from the registry", () => {
    const adapter = getAdapter("approval-chain");
    expect(adapter).toBeDefined();
    expect(adapter!.slug).toBe("approval-chain");
    expect(adapter!.title).toBe("Approval Chain");
  });

  test("getCodeBundle returns workflow, page, component, support, and api files", async () => {
    const adapter = getAdapter("approval-chain")!;
    const files = await adapter.getCodeBundle();

    expect(files.length).toBe(7);

    const roles = files.map((f) => f.role);
    expect(roles).toContain("workflow");
    expect(roles).toContain("page");
    expect(roles).toContain("component");
    expect(roles).toContain("support");
    expect(roles).toContain("api");

    const workflowFile = files.find((f) => f.role === "workflow")!;
    expect(workflowFile.path).toContain("workflows/approval-chain.ts");
    expect(workflowFile.contents).toContain("use workflow");

    const pageFile = files.find((f) => f.role === "page")!;
    expect(pageFile.path).toContain("app/page.tsx");
    expect(pageFile.contents.length).toBeGreaterThan(0);

    const componentFile = files.find((f) => f.role === "component")!;
    expect(componentFile.path).toContain("app/components/demo.tsx");
    expect(componentFile.contents).toContain("use client");

    const supportFile = files.find((f) => f.role === "support")!;
    expect(supportFile.path).toContain("approval-chain-code-workbench.tsx");
    expect(supportFile.contents.length).toBeGreaterThan(0);

    const apiFiles = files.filter((f) => f.role === "api");
    expect(apiFiles.length).toBe(3);
  });

  test("apiRoutes includes start, readable, and extra approve route", () => {
    const adapter = getAdapter("approval-chain")!;

    expect(adapter.apiRoutes.length).toBe(3);

    const kinds = adapter.apiRoutes.map((r) => r.kind);
    expect(kinds).toContain("start");
    expect(kinds).toContain("readable");
    expect(kinds).toContain("extra");

    const startRoute = adapter.apiRoutes.find((r) => r.kind === "start")!;
    expect(startRoute.route).toBe("/api/approval-chain");
    expect(typeof startRoute.load).toBe("function");

    const extraRoute = adapter.apiRoutes.find((r) => r.kind === "extra")!;
    expect(extraRoute.route).toBe("/api/approve");
    expect(typeof extraRoute.load).toBe("function");
  });

  test("renderDemo returns a React element (not a pre/code fallback)", async () => {
    const adapter = getAdapter("approval-chain")!;
    const element = await adapter.renderDemo();

    expect(element).toBeDefined();
    expect(element.type).not.toBe("section");
    expect(element.type).not.toBe("pre");
  });

  test("route loaders export at least one HTTP handler", async () => {
    const adapter = getAdapter("approval-chain")!;

    for (const route of adapter.apiRoutes) {
      const mod = await route.load();
      const hasHandler = ["GET", "POST", "PUT", "PATCH", "DELETE"].some(
        (method) =>
          typeof (mod as Record<string, unknown>)[method] === "function",
      );

      expect(hasHandler).toBe(true);
    }
  });
});
