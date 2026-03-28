#!/usr/bin/env bun
// Generator: native gallery route shims for all workflow demos.
//
// Reads lib/demos.generated.json, then for each demo:
//   - Reads the original route.ts source files
//   - Rewrites `@/` imports to `@/{slug}/` so they resolve in the gallery root
//   - Emits faithful copies of the original handler logic
//
// Generated files:
//   - app/api/{slug}/route.ts          (start route per demo — full parity)
//   - app/api/{extra}/route.ts         (extra routes per demo — full parity)
//   - app/api/readable/[runId]/route.ts (shared SSE handler)
//   - app/components/demos/{slug}-native.tsx (wrapper component per demo)
//   - lib/native-demos.generated.ts     (registry of all demos)
//
// Usage: bun .scripts/generate-native-gallery.ts

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DemoCatalogEntry = {
  slug: string;
  title: string;
  description: string;
  whenToUse: string;
  reviewedBy: string;
  tags: string[];
  sourceMode: string;
  workflowFiles: string[];
  apiRoutes: string[];
  extraRoutes: string[];
};

type WorkflowInfo = {
  /** Relative path from repo root, e.g. "fan-out/workflows/incident-fanout.ts" */
  filePath: string;
  /** Exported function name, e.g. "incidentFanOut" */
  functionName: string;
  /** Gallery-root import path, e.g. "@/fan-out/workflows/incident-fanout" */
  importPath: string;
};

type SupportedDemo = {
  slug: string;
  title: string;
  workflows: WorkflowInfo[];
  extraRoutes: string[];
  /** Whether the client component is self-contained (no code-pane props) */
  selfContained: boolean;
  /** The exported component name from the demo's app/components/demo.tsx */
  componentExportName: string | null;
};

type UnsupportedDemo = {
  slug: string;
  reason: string;
  workflowFiles: string[];
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROOT = join(import.meta.dir, "..");
const HEADER =
  "// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts\n";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Removes previously generated route files under app/api/ (excluding demos/ code API),
 * generated wrapper components, and the registry. Ensures no stale files from previous runs.
 */
function cleanGeneratedFiles(): void {
  const apiDir = join(ROOT, "app/api");
  if (existsSync(apiDir)) {
    for (const entry of readdirSync(apiDir)) {
      // Preserve the demos/ directory (contains code API and other non-generated routes)
      if (entry === "demos") continue;
      const entryPath = join(apiDir, entry);
      // Check if this is a generated file/directory by checking for GENERATED header
      const routeFile = join(entryPath, "route.ts");
      if (existsSync(routeFile)) {
        const content = readFileSync(routeFile, "utf8");
        if (content.startsWith("// GENERATED")) {
          rmSync(entryPath, { recursive: true, force: true });
          continue;
        }
      }
      // For directories, check recursively for generated route.ts files
      try {
        const stat = require("node:fs").statSync(entryPath);
        if (stat.isDirectory()) {
          cleanGeneratedDir(entryPath);
        }
      } catch {
        // ignore
      }
    }
  }

  // Clean generated wrapper components
  const wrapperDir = join(ROOT, "app/components/demos");
  if (existsSync(wrapperDir)) {
    for (const entry of readdirSync(wrapperDir)) {
      if (entry.endsWith("-native.tsx")) {
        const filePath = join(wrapperDir, entry);
        const content = readFileSync(filePath, "utf8");
        if (content.startsWith("// GENERATED")) {
          rmSync(filePath, { force: true });
        }
      }
    }
  }

  // Clean generated registry
  const registryPath = join(ROOT, "lib/native-demos.generated.ts");
  if (existsSync(registryPath)) {
    rmSync(registryPath, { force: true });
  }

  console.log(
    JSON.stringify({ level: "info", action: "clean_generated_files" }),
  );
}

function cleanGeneratedDir(dirPath: string): void {
  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isFile() && entry.name === "route.ts") {
      const content = readFileSync(fullPath, "utf8");
      if (content.startsWith("// GENERATED")) {
        // Remove the parent directory tree up to the nearest non-empty parent
        rmSync(dirPath, { recursive: true, force: true });
        return;
      }
    } else if (entry.isDirectory()) {
      cleanGeneratedDir(fullPath);
    }
  }
  // If directory is now empty, remove it
  try {
    const remaining = readdirSync(dirPath);
    if (remaining.length === 0) {
      rmSync(dirPath, { recursive: true, force: true });
    }
  } catch {
    // already removed
  }
}

function loadCatalog(): DemoCatalogEntry[] {
  return JSON.parse(
    readFileSync(join(ROOT, "lib/demos.generated.json"), "utf8"),
  ) as DemoCatalogEntry[];
}

function write(relativePath: string, contents: string) {
  const absolutePath = join(ROOT, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  const normalized = contents.endsWith("\n") ? contents : `${contents}\n`;
  writeFileSync(absolutePath, normalized, "utf8");
  console.log(
    JSON.stringify({ level: "info", action: "write", path: relativePath }),
  );
}

/**
 * Extracts the exported workflow function name from a workflow file.
 * Looks for `export async function NAME(` where the function body
 * contains a `"use workflow"` directive.
 */
function extractWorkflowFunctionName(
  relativeFilePath: string,
): string | null {
  const abs = join(ROOT, relativeFilePath);
  if (!existsSync(abs)) return null;

  const source = readFileSync(abs, "utf8");
  const regex = /export\s+async\s+function\s+(\w+)\s*\(/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(source)) !== null) {
    const afterMatch = source.slice(match.index);
    const braceIdx = afterMatch.indexOf("{");
    if (braceIdx === -1) continue;

    const bodySnippet = afterMatch.slice(braceIdx, braceIdx + 300);
    if (
      bodySnippet.includes('"use workflow"') ||
      bodySnippet.includes("'use workflow'")
    ) {
      return match[1];
    }
  }

  return null;
}

/**
 * Converts a workflow file path to a gallery-root import path.
 * "fan-out/workflows/incident-fanout.ts" → "@/fan-out/workflows/incident-fanout"
 */
function toImportPath(filePath: string): string {
  return "@/" + filePath.replace(/\.ts$/, "");
}

/**
 * Rewrites `@/...` imports in a route source to `@/{slug}/...`.
 * Handles both `from "@/..."` and `from '@/...'` patterns.
 * Does NOT rewrite imports from packages (e.g., `workflow/api`, `next/server`).
 */
function rewriteAliasImports(source: string, slug: string): string {
  return source.replace(
    /(from\s+["'])@\/((?!node_modules)[^"']+)(["'])/g,
    `$1@/${slug}/$2$3`,
  );
}

/**
 * Rewrites relative imports (../foo, ./foo) to @/{slug}/... absolute paths.
 * Uses the original file's directory to resolve relative paths.
 *
 * e.g. in normalizer/app/api/normalizer/route.ts:
 *   import { normalizer } from "../../../workflows/normalizer"
 *   → import { normalizer } from "@/normalizer/workflows/normalizer"
 */
function rewriteRelativeImports(source: string, originalPath: string, slug: string): string {
  // Directory of the original file within the demo, relative to demo root
  // e.g. "normalizer/app/api/normalizer/route.ts" → dir is "normalizer/app/api/normalizer"
  const originalDir = dirname(originalPath);

  return source.replace(
    /(from\s+["'])(\.\.?\/[^"']+)(["'])/g,
    (_match, prefix, relPath, suffix) => {
      // Resolve the relative path against the original file's directory
      const resolved = join(originalDir, relPath);
      // Normalize: remove leading ./ and resolve ..
      const normalized = resolved.split("/").reduce((acc: string[], part) => {
        if (part === "..") acc.pop();
        else if (part !== ".") acc.push(part);
        return acc;
      }, []).join("/");
      return `${prefix}@/${normalized}${suffix}`;
    },
  );
}

/**
 * Reads an original route.ts file, rewrites its imports, and prepends the GENERATED header.
 * Handles both @/ alias imports and relative imports.
 * Returns null if the source file doesn't exist.
 */
function readAndRewriteRoute(originalPath: string, slug: string): { contents: string; rewriteCount: number } | null {
  const abs = join(ROOT, originalPath);
  if (!existsSync(abs)) {
    console.log(
      JSON.stringify({
        level: "warn",
        action: "route_source_missing",
        path: originalPath,
        slug,
      }),
    );
    return null;
  }

  const source = readFileSync(abs, "utf8");
  let rewriteCount = 0;
  let rewritten = source.replace(
    /(from\s+["'])@\/((?!node_modules)[^"']+)(["'])/g,
    (_m, p1, p2, p3) => { rewriteCount++; return `${p1}@/${slug}/${p2}${p3}`; },
  );
  rewritten = rewritten.replace(
    /(from\s+["'])(\.\.?\/[^"']+)(["'])/g,
    (_match, prefix, relPath, suffix) => {
      const originalDir = dirname(originalPath);
      const resolved = join(originalDir, relPath);
      const normalized = resolved.split("/").reduce((acc: string[], part) => {
        if (part === "..") acc.pop();
        else if (part !== ".") acc.push(part);
        return acc;
      }, []).join("/");
      rewriteCount++;
      return `${prefix}@/${normalized}${suffix}`;
    },
  );
  return { contents: HEADER + rewritten, rewriteCount };
}

/**
 * Detects if a demo's client component is self-contained (no props).
 * Looks for `export function XxxDemo()` with empty parens.
 */
function detectSelfContained(slug: string): boolean {
  const demoPath = join(ROOT, slug, "app/components/demo.tsx");
  if (!existsSync(demoPath)) return false;
  const source = readFileSync(demoPath, "utf8");
  // Match export function XxxDemo() — no params
  return /export\s+function\s+\w+Demo\s*\(\s*\)/.test(source);
}

/**
 * Extracts the primary exported component name from a demo's client component.
 * Returns null if the file doesn't exist or no matching export is found.
 */
function extractComponentExportName(slug: string): string | null {
  const demoPath = join(ROOT, slug, "app/components/demo.tsx");
  if (!existsSync(demoPath)) return null;
  const source = readFileSync(demoPath, "utf8");
  const match = source.match(/export\s+function\s+(\w+Demo)\s*[({]/);
  return match ? match[1] : null;
}

/**
 * Converts a slug to PascalCase for component names.
 * "fan-out" → "FanOut", "dead-letter-queue" → "DeadLetterQueue"
 */
function toPascalCase(slug: string): string {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

// ---------------------------------------------------------------------------
// Catalog analysis
// ---------------------------------------------------------------------------

function analyzeCatalog(
  catalog: DemoCatalogEntry[],
): { supported: SupportedDemo[]; unsupported: UnsupportedDemo[] } {
  const supported: SupportedDemo[] = [];
  const unsupported: UnsupportedDemo[] = [];

  for (const entry of catalog) {
    if (entry.workflowFiles.length === 0) {
      unsupported.push({
        slug: entry.slug,
        reason: "no_workflow_files",
        workflowFiles: [],
      });
      continue;
    }

    const workflows: WorkflowInfo[] = [];
    let allResolved = true;

    for (const wfFile of entry.workflowFiles) {
      const functionName = extractWorkflowFunctionName(wfFile);
      if (!functionName) {
        allResolved = false;
        break;
      }
      workflows.push({
        filePath: wfFile,
        functionName,
        importPath: toImportPath(wfFile),
      });
    }

    if (!allResolved || workflows.length === 0) {
      unsupported.push({
        slug: entry.slug,
        reason: "workflow_function_not_found",
        workflowFiles: entry.workflowFiles,
      });
      continue;
    }

    const selfContained = detectSelfContained(entry.slug);
    const componentExportName = extractComponentExportName(entry.slug);

    supported.push({
      slug: entry.slug,
      title: entry.title,
      workflows,
      extraRoutes: entry.extraRoutes,
      selfContained,
      componentExportName,
    });

    console.log(
      JSON.stringify({
        level: "info",
        action: "parsed_demo",
        slug: entry.slug,
        workflowCount: workflows.length,
        extraRouteCount: entry.extraRoutes.length,
        selfContained,
        componentExportName,
      }),
    );
  }

  return { supported, unsupported };
}

// ---------------------------------------------------------------------------
// Code generators
// ---------------------------------------------------------------------------

/**
 * Generates a start route by reading the original and rewriting imports.
 * Falls back to a generic shim if the original can't be read.
 */
function generateStartRoute(demo: SupportedDemo, catalogEntry: DemoCatalogEntry): string | null {
  // Find the start route: {slug}/app/api/{slug}/route.ts
  // The catalog apiRoutes array order is not guaranteed, so match by path pattern.
  const startRoutePattern = `${demo.slug}/app/api/${demo.slug}/route.ts`;
  const mainApiRoute = catalogEntry.apiRoutes.find((r) => r === startRoutePattern)
    ?? catalogEntry.apiRoutes.find((r) => !r.includes("readable") && !r.includes("[runId]"));
  if (!mainApiRoute) return null;

  const result = readAndRewriteRoute(mainApiRoute, demo.slug);
  if (result) {
    console.log(
      JSON.stringify({
        level: "info",
        action: "start_route_parity",
        slug: demo.slug,
        source: mainApiRoute,
        mode: "rewrite",
        rewriteCount: result.rewriteCount,
      }),
    );
    return result.contents;
  }

  // Fallback: should not happen if catalog is correct
  console.log(
    JSON.stringify({
      level: "warn",
      action: "start_route_fallback",
      slug: demo.slug,
      source: mainApiRoute,
    }),
  );
  return null;
}

/**
 * Generates extra route shims by reading originals and rewriting imports.
 * Extra routes are namespaced under the demo slug to avoid conflicts between
 * demos that share the same route names (e.g. multiple demos with /api/approve).
 *
 * Original: {slug}/app/api/approve/route.ts → Gallery: app/api/{slug}/approve/route.ts
 * Original: {slug}/app/api/run/[runId]/route.ts → Gallery: app/api/{slug}/run/[runId]/route.ts
 *
 * Returns an array of { outputPath, contents, galleryRoute } tuples.
 */
function generateExtraRoutes(
  demo: SupportedDemo,
): Array<{ outputPath: string; contents: string; galleryRoute: string }> {
  const results: Array<{ outputPath: string; contents: string; galleryRoute: string }> = [];

  for (const extraRoutePath of demo.extraRoutes) {
    // Extract the route segment after app/api/
    // e.g. "approval-gate/app/api/approve/route.ts" → "approve/route.ts"
    const match = extraRoutePath.match(
      new RegExp(`^${escapeRegExp(demo.slug)}/app/api/(.+)$`),
    );
    if (!match) {
      console.error(
        JSON.stringify({
          level: "error",
          action: "extra_route_path_mismatch",
          slug: demo.slug,
          path: extraRoutePath,
        }),
      );
      process.exit(1);
    }

    const routeSegment = match[1]; // e.g. "approve/route.ts" or "claim-check/upload/route.ts"

    // If the route segment already starts with the slug (e.g. claim-check/upload/route.ts
    // from claim-check/app/api/claim-check/upload/route.ts), output as-is under app/api/.
    // Otherwise, namespace under the demo slug to avoid cross-demo conflicts.
    const alreadyNamespaced = routeSegment.startsWith(demo.slug + "/");
    const outputPath = alreadyNamespaced
      ? `app/api/${routeSegment}`
      : `app/api/${demo.slug}/${routeSegment}`;
    const routeWithoutFile = routeSegment.replace(/\/route\.ts$/, "");
    const galleryRoute = alreadyNamespaced
      ? `/api/${routeWithoutFile}`
      : `/api/${demo.slug}/${routeWithoutFile}`;

    const result = readAndRewriteRoute(extraRoutePath, demo.slug);
    if (!result) {
      console.error(
        JSON.stringify({
          level: "error",
          action: "extra_route_source_missing",
          slug: demo.slug,
          source: extraRoutePath,
          output: outputPath,
        }),
      );
      process.exit(1);
    }
    results.push({ outputPath, contents: result.contents, galleryRoute });
    console.log(
      JSON.stringify({
        level: "info",
        action: "extra_route_parity",
        slug: demo.slug,
        source: extraRoutePath,
        output: outputPath,
        galleryRoute,
        mode: "rewrite",
        rewriteCount: result.rewriteCount,
      }),
    );
  }

  return results;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function generateReadableRoute(): string {
  return [
    HEADER.trimEnd(),
    `import { NextRequest } from "next/server";`,
    `import { getRun } from "workflow/api";`,
    ``,
    `type ReadableRouteContext = {`,
    `  params: Promise<{ runId: string }>;`,
    `};`,
    ``,
    `export async function GET(`,
    `  _request: NextRequest,`,
    `  { params }: ReadableRouteContext,`,
    `) {`,
    `  const { runId } = await params;`,
    ``,
    `  const run = getRun(runId);`,
    `  const readable = run.getReadable();`,
    ``,
    `  const encoder = new TextEncoder();`,
    `  const sseStream = (readable as ReadableStream).pipeThrough(`,
    `    new TransformStream({`,
    `      transform(chunk, controller) {`,
    `        const data =`,
    `          typeof chunk === "string" ? chunk : JSON.stringify(chunk);`,
    "        controller.enqueue(encoder.encode(`data: ${data}\\n\\n`));",
    `      },`,
    `    }),`,
    `  );`,
    ``,
    `  return new Response(sseStream, {`,
    `    headers: {`,
    `      "Content-Type": "text/event-stream; charset=utf-8",`,
    `      "Cache-Control": "no-cache, no-transform",`,
    `      Connection: "keep-alive",`,
    `      "X-Accel-Buffering": "no",`,
    `    },`,
    `  });`,
    `}`,
    ``,
  ].join("\n");
}

/**
 * Generates a wrapper component for a demo.
 * Self-contained demos get a direct re-export.
 * Demos with code-pane props get a placeholder.
 */
function generateWrapper(demo: SupportedDemo): string {
  if (demo.selfContained && demo.componentExportName) {
    return [
      HEADER.trimEnd(),
      `"use client";`,
      ``,
      `export { ${demo.componentExportName} as default } from "@/${demo.slug}/app/components/demo";`,
      ``,
    ].join("\n");
  }

  const componentName = `${toPascalCase(demo.slug)}NativePlaceholder`;
  return [
    HEADER.trimEnd(),
    `"use client";`,
    ``,
    `export default function ${componentName}() {`,
    `  return (`,
    `    <div`,
    `      data-demo={${JSON.stringify(demo.slug)}}`,
    `      style={{`,
    `        display: "flex",`,
    `        alignItems: "center",`,
    `        justifyContent: "center",`,
    `        minHeight: "50vh",`,
    `        color: "#888",`,
    `        fontFamily: "var(--font-geist-mono), monospace",`,
    `      }}`,
    `    >`,
    `      ${JSON.stringify(demo.title)} — native UI adapter pending`,
    `    </div>`,
    `  );`,
    `}`,
    ``,
  ].join("\n");
}

function generateRegistry(
  demos: SupportedDemo[],
  extraRoutesBySlug: Map<string, string[]>,
): string {
  const entries = demos
    .map((demo) => {
      const primary = demo.workflows[0];
      const apiRoutes = [
        `      { route: "/api/${demo.slug}", kind: "start" as const }`,
        `      { route: "/api/readable/[runId]", kind: "readable" as const }`,
      ];
      const extras = extraRoutesBySlug.get(demo.slug) ?? [];
      for (const galleryRoute of extras) {
        apiRoutes.push(
          `      { route: ${JSON.stringify(galleryRoute)}, kind: "extra" as const }`,
        );
      }

      return [
        `  ${JSON.stringify(demo.slug)}: {`,
        `    title: ${JSON.stringify(demo.title)},`,
        `    workflowId: ${JSON.stringify(primary.filePath)},`,
        `    uiReady: ${demo.selfContained},`,
        `    apiRoutes: [`,
        apiRoutes.join(",\n") + ",",
        `    ],`,
        `    component: () => import("@/app/components/demos/${demo.slug}-native"),`,
        `  }`,
      ].join("\n");
    })
    .join(",\n");

  return [
    HEADER.trimEnd(),
    `import type { ComponentType } from "react";`,
    ``,
    `export type NativeDemoRouteKind = "start" | "readable" | "extra";`,
    ``,
    `export type NativeDemo = {`,
    `  title: string;`,
    `  workflowId: string;`,
    `  uiReady: boolean;`,
    `  apiRoutes: Array<{ route: string; kind: NativeDemoRouteKind }>;`,
    `  // eslint-disable-next-line @typescript-eslint/no-explicit-any`,
    `  component: () => Promise<{ default: ComponentType<any> }>;`,
    `};`,
    ``,
    `export const nativeDemos = {`,
    entries,
    `} satisfies Record<string, NativeDemo>;`,
    ``,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  // Clean stale generated files before writing new ones
  cleanGeneratedFiles();

  const catalog = loadCatalog();
  const { supported, unsupported } = analyzeCatalog(catalog);

  for (const entry of unsupported) {
    console.log(
      JSON.stringify({
        level: "warn",
        action: "unsupported_demo",
        slug: entry.slug,
        reason: entry.reason,
        workflowFiles: entry.workflowFiles,
      }),
    );
  }

  if (supported.length === 0) {
    console.error(
      JSON.stringify({
        level: "error",
        action: "no_supported_demos",
        catalogSize: catalog.length,
        unsupportedCount: unsupported.length,
      }),
    );
    process.exit(1);
  }

  // Build a lookup from slug → catalog entry for source paths
  const catalogBySlug = new Map(catalog.map((e) => [e.slug, e]));

  // Generate shared readable route (one file)
  write("app/api/readable/[runId]/route.ts", generateReadableRoute());

  let filesWritten = 1; // readable route already counted
  let startRoutesGenerated = 0;
  let extraRoutesGenerated = 0;
  const extraRoutesBySlug = new Map<string, string[]>();

  for (const demo of supported) {
    const catalogEntry = catalogBySlug.get(demo.slug)!;

    // Generate start route with full parity
    const startRoute = generateStartRoute(demo, catalogEntry);
    if (startRoute) {
      write(`app/api/${demo.slug}/route.ts`, startRoute);
      startRoutesGenerated++;
      filesWritten++;
    }

    // Generate extra routes with full parity (namespaced under /api/{slug}/...)
    const extraRoutes = generateExtraRoutes(demo);
    const galleryRoutes: string[] = [];
    for (const { outputPath, contents, galleryRoute } of extraRoutes) {
      write(outputPath, contents);
      galleryRoutes.push(galleryRoute);
      extraRoutesGenerated++;
      filesWritten++;
    }
    if (galleryRoutes.length > 0) {
      extraRoutesBySlug.set(demo.slug, galleryRoutes);
    }

    // Generate wrapper component
    write(
      `app/components/demos/${demo.slug}-native.tsx`,
      generateWrapper(demo),
    );
    filesWritten++;
  }

  // Generate registry
  write("lib/native-demos.generated.ts", generateRegistry(supported, extraRoutesBySlug));
  filesWritten++;

  const uiReadyCount = supported.filter((d) => d.selfContained).length;

  console.log(
    JSON.stringify({
      level: "info",
      action: "native_gallery_generated",
      supported: supported.length,
      unsupported: unsupported.length,
      startRoutesGenerated,
      extraRoutesGenerated,
      uiReadyCount,
      slugs: supported.map((d) => d.slug),
      uiReadySlugs: supported.filter((d) => d.selfContained).map((d) => d.slug),
      filesWritten,
    }),
  );
}

main();
