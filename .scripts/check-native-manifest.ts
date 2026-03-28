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

type DemoCheckResult = {
  slug: string;
  status: "registered" | "partial" | "missing";
  registeredWorkflowFiles: string[];
  missingWorkflowFiles: string[];
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
const results: CheckResult[] = [];
const demoSummaries: DemoCheckResult[] = [];

for (const entry of catalog) {
  if (entry.workflowFiles.length === 0) continue;

  const registeredWorkflowFiles: string[] = [];
  const missingWorkflowFiles: string[] = [];

  for (const wfFile of entry.workflowFiles) {
    const registered = findWorkflowInManifest(manifest, wfFile);
    results.push({ workflowFile: wfFile, slug: entry.slug, registered });

    if (registered) {
      registeredWorkflowFiles.push(wfFile);
      console.log(
        JSON.stringify({
          level: "info",
          action: "workflow_registered",
          slug: entry.slug,
          workflowFile: wfFile,
        }),
      );
    } else {
      missingWorkflowFiles.push(wfFile);
    }
  }

  const status =
    registeredWorkflowFiles.length === 0
      ? "missing"
      : missingWorkflowFiles.length === 0
        ? "registered"
        : "partial";

  for (const wfFile of missingWorkflowFiles) {
    console.log(
      JSON.stringify({
        level: status === "missing" ? "error" : "warn",
        action:
          status === "missing"
            ? "workflow_not_registered"
            : "workflow_not_in_import_chain",
        slug: entry.slug,
        workflowFile: wfFile,
      }),
    );
  }

  const demoSummary: DemoCheckResult = {
    slug: entry.slug,
    status,
    registeredWorkflowFiles,
    missingWorkflowFiles,
  };
  demoSummaries.push(demoSummary);

  console.log(
    JSON.stringify({
      level:
        status === "missing" ? "error" : status === "partial" ? "warn" : "info",
      action: "demo_manifest_status",
      ...demoSummary,
    }),
  );
}

const summary = {
  demosChecked: demoSummaries.length,
  demosRegistered: demoSummaries.filter((demo) => demo.status === "registered")
    .length,
  demosPartial: demoSummaries.filter((demo) => demo.status === "partial")
    .length,
  demosMissing: demoSummaries.filter((demo) => demo.status === "missing")
    .length,
  workflowFilesRegistered: demoSummaries.reduce(
    (count, demo) => count + demo.registeredWorkflowFiles.length,
    0,
  ),
  workflowFilesMissing: demoSummaries.reduce(
    (count, demo) => count + demo.missingWorkflowFiles.length,
    0,
  ),
};

console.log(
  JSON.stringify({
    level: summary.demosMissing > 0 ? "error" : "info",
    action: "manifest_check_complete",
    ...summary,
  }),
);

if (summary.demosMissing > 0) {
  process.exit(1);
}
