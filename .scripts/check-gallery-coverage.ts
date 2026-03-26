/**
 * Gallery adapter coverage gate.
 *
 * Prints JSON to stdout with total, mounted, missing, and invalid keys.
 * Exits non-zero when any catalog demo lacks a conforming adapter.
 *
 * Usage: bun .scripts/check-gallery-coverage.ts
 */

import { demos } from "../lib/demos";
import { getAdapter } from "../lib/demo-adapters";

type CoverageRow = {
  slug: string;
  hasAdapter: boolean;
  hasWorkflow: boolean;
  hasStartRoute: boolean;
};

async function main() {
  const rows: CoverageRow[] = [];

  for (const demo of demos) {
    const adapter = getAdapter(demo.slug);

    if (!adapter) {
      rows.push({
        slug: demo.slug,
        hasAdapter: false,
        hasWorkflow: false,
        hasStartRoute: false,
      });
      continue;
    }

    const files = await adapter.getCodeBundle();

    rows.push({
      slug: demo.slug,
      hasAdapter: true,
      hasWorkflow: files.some((file) => file.role === "workflow"),
      hasStartRoute: adapter.apiRoutes.some((route) => route.kind === "start"),
    });
  }

  const missing = rows.filter((row) => !row.hasAdapter).map((row) => row.slug);
  const invalid = rows
    .filter((row) => row.hasAdapter && (!row.hasWorkflow || !row.hasStartRoute))
    .map((row) => ({
      slug: row.slug,
      hasWorkflow: row.hasWorkflow,
      hasStartRoute: row.hasStartRoute,
    }));

  const report = {
    total: rows.length,
    mounted: rows.length - missing.length,
    missing,
    invalid,
  };

  console.log(JSON.stringify(report, null, 2));

  const exitCode = missing.length === 0 && invalid.length === 0 ? 0 : 1;
  process.exit(exitCode);
}

void main();
