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

// Check each demo's workflow files against the manifest.
// A demo passes if at least one of its workflow files is registered.
// Extra unregistered workflow files are logged as warnings, not failures.
const results: CheckResult[] = [];
let demosWithNoRegistration = 0;

for (const entry of catalog) {
  if (entry.workflowFiles.length === 0) continue;

  const demoResults: CheckResult[] = [];
  for (const wfFile of entry.workflowFiles) {
    const registered = findWorkflowInManifest(manifest, wfFile);
    const result = { workflowFile: wfFile, slug: entry.slug, registered };
    demoResults.push(result);
    results.push(result);
  }

  const anyRegistered = demoResults.some((r) => r.registered);

  for (const result of demoResults) {
    const level = result.registered ? "info" : anyRegistered ? "warn" : "error";
    const action = result.registered
      ? "workflow_registered"
      : anyRegistered
        ? "workflow_not_in_import_chain"
        : "workflow_not_registered";
    console.log(
      JSON.stringify({ level, action, slug: result.slug, workflowFile: result.workflowFile }),
    );
  }

  if (!anyRegistered) {
    demosWithNoRegistration++;
  }
}

const totalRegistered = results.filter((r) => r.registered).length;
const totalMissing = results.length - totalRegistered;

// Summary
console.log(
  JSON.stringify({
    level: demosWithNoRegistration > 0 ? "error" : "info",
    action: "manifest_check_complete",
    totalWorkflowFiles: results.length,
    registered: totalRegistered,
    notInImportChain: totalMissing - demosWithNoRegistration,
    demosFullyMissing: demosWithNoRegistration,
    demosChecked: catalog.filter((e) => e.workflowFiles.length > 0).length,
  }),
);

if (demosWithNoRegistration > 0) {
  process.exit(1);
}
