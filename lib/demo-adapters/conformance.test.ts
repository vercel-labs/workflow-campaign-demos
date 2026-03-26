import { describe, test, expect } from "bun:test";
import { demos } from "../demos";
import { getAdapter } from "./index";

describe("gallery adapter coverage", () => {
  test("every catalog demo resolves to an adapter", () => {
    const missing = demos
      .map((demo) => demo.slug)
      .filter((slug) => !getAdapter(slug));

    expect(missing).toEqual([]);
  });

  test("every mounted adapter exposes workflow code and a start route", async () => {
    const failures: string[] = [];

    for (const demo of demos) {
      const adapter = getAdapter(demo.slug);

      if (!adapter) {
        failures.push(`${demo.slug}: missing adapter`);
        continue;
      }

      const files = await adapter.getCodeBundle();

      if (!files.some((file) => file.role === "workflow")) {
        failures.push(`${demo.slug}: missing workflow file`);
      }

      if (!adapter.apiRoutes.some((route) => route.kind === "start")) {
        failures.push(`${demo.slug}: missing start route`);
      }
    }

    expect(failures).toEqual([]);
  });

  test("every mounted adapter has renderDemo and lazy route loaders", async () => {
    const failures: string[] = [];

    for (const demo of demos) {
      const adapter = getAdapter(demo.slug);
      if (!adapter) continue;

      if (typeof adapter.renderDemo !== "function") {
        failures.push(`${demo.slug}: missing renderDemo()`);
      }

      for (const route of adapter.apiRoutes) {
        if (typeof route.load !== "function") {
          failures.push(`${demo.slug}: route ${route.route} missing load()`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  test("mounted adapter load() returns at least one HTTP method handler", async () => {
    const httpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
    const failures: string[] = [];

    for (const demo of demos) {
      const adapter = getAdapter(demo.slug);
      if (!adapter) continue;

      for (const route of adapter.apiRoutes) {
        const mod = await route.load();
        const hasHandler = httpMethods.some(
          (m) => typeof (mod as Record<string, unknown>)[m] === "function"
        );
        if (!hasHandler) {
          failures.push(`${demo.slug}: route ${route.route} load() returned no handlers`);
        }
      }
    }

    expect(failures).toEqual([]);
  });
});
