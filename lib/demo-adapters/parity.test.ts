import { describe, test, expect } from "bun:test";
import { getAdapter, getRegisteredSlugs } from "./index";
import { existsSync } from "fs";
import { join } from "path";

/**
 * Adapter-to-route parity test.
 *
 * Every registered adapter declares apiRoutes with lazy load() targets that
 * point at root gallery API modules (e.g. "@/app/api/fan-out/route").
 *
 * This suite verifies two things:
 *   1. The physical file exists on disk at the expected path.
 *   2. The dynamic import resolves and exports at least one HTTP method handler.
 *
 * If either check fails, the adapter references a route that doesn't exist
 * and the gallery will 500 at runtime.
 */

const ROOT = join(import.meta.dir, "../..");

function routeToFilePath(route: string): string {
  // Adapter routes use paths like "/api/fan-out" which map to "app/api/fan-out/route.ts"
  const stripped = route.startsWith("/") ? route.slice(1) : route;
  return join(ROOT, "app", stripped, "route.ts");
}

describe("adapter-to-route parity", () => {
  const slugs = getRegisteredSlugs();

  test("at least one adapter is registered", () => {
    expect(slugs.length).toBeGreaterThan(0);
  });

  for (const slug of slugs) {
    describe(slug, () => {
      const adapter = getAdapter(slug)!;

      test("adapter resolves", () => {
        expect(adapter).toBeDefined();
        expect(adapter.slug).toBe(slug);
      });

      for (const apiRoute of adapter.apiRoutes) {
        describe(`route ${apiRoute.route} (${apiRoute.kind})`, () => {
          test("physical file exists on disk", () => {
            const filePath = routeToFilePath(apiRoute.route);
            const exists = existsSync(filePath);
            expect(exists).toBe(true);
          });

          test("load() resolves to a module with at least one HTTP handler", async () => {
            const mod = await apiRoute.load();
            const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
            const hasHandler = methods.some(
              (m) => typeof (mod as Record<string, unknown>)[m] === "function",
            );
            expect(hasHandler).toBe(true);
          });
        });
      }
    });
  }
});
