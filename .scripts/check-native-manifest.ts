#!/usr/bin/env bun
// Asserts that generated native gallery routes caused the workflow plugin
// to register expected workflow files in the unified manifest.
//
// Usage: bun .scripts/check-native-manifest.ts
// Runs after `npx next build`. Exits 0 if all expected workflows are present.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DemoCatalogEntry = {
  slug: string;
  workflowFiles: string[];
};

type CheckResult = {
  workflowFile: string;
  slug: string;
  registered: boolean;
};

// ---------------------------------------------------------------------------
// Manifest discovery
// ---------------------------------------------------------------------------

const ROOT = process.cwd();

const MANIFEST_CANDIDATES = [
  "app/.well-known/workflow/v1/manifest.json",
  ".next/server/app/.well-known/workflow/v1/manifest.json",
  ".next/static/workflow/manifest.json",
];

function findManifest(): string | null {
  for (const candidate of MANIFEST_CANDIDATES) {
    const fullPath = join(ROOT, candidate);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Deep search for a workflow file key in the manifest
// ---------------------------------------------------------------------------

function findWorkflowInManifest(obj: unknown, target: string): boolean {
  if (!obj || typeof obj !== "object") return false;

  const record = obj as Record<string, unknown>;

  // Direct key match
  if (target in record) return true;

  // Key contains target
  for (const key of Object.keys(record)) {
    if (key.includes(target)) return true;
  }

  // Recurse into object values
  for (const value of Object.values(record)) {
    if (typeof value === "object" && value !== null) {
      if (findWorkflowInManifest(value, target)) return true;
    }
    if (typeof value === "string" && value.includes(target)) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const manifestPath = findManifest();

if (!manifestPath) {
  console.error(
    JSON.stringify({
      level: "error",
      action: "manifest_missing",
      searchedPaths: MANIFEST_CANDIDATES,
    }),
  );
  process.exit(1);
}

console.log(
  JSON.stringify({
    level: "info",
    action: "manifest_found",
    path: manifestPath,
  }),
);

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

// Load catalog to get the full list of expected workflow files
const catalogPath = join(ROOT, "lib/demos.generated.json");
if (!existsSync(catalogPath)) {
  console.error(
    JSON.stringify({
      level: "error",
      action: "catalog_missing",
      path: catalogPath,
    }),
  );
  process.exit(1);
}

const catalog = JSON.parse(
  readFileSync(catalogPath, "utf8"),
) as DemoCatalogEntry[];

// Check each demo's workflow files against the manifest
const results: CheckResult[] = [];
let missingCount = 0;

for (const entry of catalog) {
  for (const wfFile of entry.workflowFiles) {
    const registered = findWorkflowInManifest(manifest, wfFile);
    results.push({ workflowFile: wfFile, slug: entry.slug, registered });
    if (!registered) {
      missingCount++;
    }
  }
}

// Emit per-workflow results
for (const result of results) {
  console.log(
    JSON.stringify({
      level: result.registered ? "info" : "error",
      action: result.registered
        ? "workflow_registered"
        : "workflow_not_registered",
      slug: result.slug,
      workflowFile: result.workflowFile,
    }),
  );
}

// Summary
console.log(
  JSON.stringify({
    level: missingCount > 0 ? "error" : "info",
    action: "manifest_check_complete",
    total: results.length,
    registered: results.length - missingCount,
    missing: missingCount,
  }),
);

if (missingCount > 0) {
  process.exit(1);
}
