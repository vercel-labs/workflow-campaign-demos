#!/usr/bin/env bun
// Generator: native gallery route shims for all workflow demos.
//
// Reads lib/demos.generated.json, parses each demo's workflow files to extract
// exported workflow functions, then generates:
//   - app/api/{slug}/route.ts          (start route per demo)
//   - app/api/readable/[runId]/route.ts (shared SSE handler)
//   - app/components/demos/{slug}-native.tsx (wrapper component per demo)
//   - lib/native-demos.generated.ts     (registry of all demos)
//
// Usage: bun .scripts/generate-native-gallery.ts

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
    // Look ahead into the function body for the "use workflow" directive
    const afterMatch = source.slice(match.index);
    const braceIdx = afterMatch.indexOf("{");
    if (braceIdx === -1) continue;

    // The directive is always near the top of the function body
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

    supported.push({
      slug: entry.slug,
      title: entry.title,
      workflows,
      extraRoutes: entry.extraRoutes,
    });
  }

  return { supported, unsupported };
}

// ---------------------------------------------------------------------------
// Code generators
// ---------------------------------------------------------------------------

function generateStartRoute(demo: SupportedDemo): string {
  // Import all workflow functions so the builder registers each one.
  // Call start() with the primary (first) workflow.
  const imports = demo.workflows
    .map((w) => `import { ${w.functionName} } from "${w.importPath}";`)
    .join("\n");

  const primary = demo.workflows[0];
  const secondary = demo.workflows.slice(1);

  // For demos with multiple workflow files, add void references to prevent
  // tree-shaking of secondary imports. The builder needs to see all imports
  // to register every workflow in the manifest.
  const voidRefs =
    secondary.length > 0
      ? [
          ``,
          `// Preserve secondary workflow imports for manifest registration`,
          ...secondary.map((w) => `void ${w.functionName};`),
        ]
      : [];

  return [
    HEADER.trimEnd(),
    `import { NextResponse } from "next/server";`,
    `import { start } from "workflow/api";`,
    imports,
    ...voidRefs,
    ``,
    `export async function POST(request: Request) {`,
    `  let body: Record<string, unknown>;`,
    ``,
    `  try {`,
    `    body = (await request.json()) as Record<string, unknown>;`,
    `  } catch {`,
    `    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });`,
    `  }`,
    ``,
    `  // eslint-disable-next-line @typescript-eslint/no-explicit-any`,
    `  const run = await start(${primary.functionName} as any, [body] as any);`,
    ``,
    `  return NextResponse.json({`,
    `    runId: run.runId,`,
    `    slug: ${JSON.stringify(demo.slug)},`,
    `    status: "started",`,
    `  });`,
    `}`,
    ``,
  ].join("\n");
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

function generateWrapper(demo: SupportedDemo): string {
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

function generateRegistry(demos: SupportedDemo[]): string {
  const entries = demos
    .map((demo) => {
      const primary = demo.workflows[0];
      const apiRoutes = [
        `      { route: "/api/${demo.slug}", kind: "start" as const }`,
        `      { route: "/api/readable/[runId]", kind: "readable" as const }`,
      ];
      // Include extra routes in metadata
      for (const extra of demo.extraRoutes) {
        // Extract the route segment from the original path
        // e.g. "aggregator/app/api/signal/route.ts" → "/api/signal"
        const match = extra.match(/app\/(api\/.+)\/route\.ts$/);
        if (match) {
          apiRoutes.push(
            `      { route: "/${match[1]}", kind: "extra" as const }`,
          );
        }
      }

      return [
        `  ${JSON.stringify(demo.slug)}: {`,
        `    title: ${JSON.stringify(demo.title)},`,
        `    workflowId: ${JSON.stringify(primary.filePath)},`,
        `    uiReady: false,`,
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
  const catalog = loadCatalog();
  const { supported, unsupported } = analyzeCatalog(catalog);

  // Emit diagnostics for unsupported demos
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

  // Generate shared readable route (one file)
  write("app/api/readable/[runId]/route.ts", generateReadableRoute());

  // Generate per-demo files
  let filesWritten = 1; // readable route already counted
  for (const demo of supported) {
    write(`app/api/${demo.slug}/route.ts`, generateStartRoute(demo));
    write(
      `app/components/demos/${demo.slug}-native.tsx`,
      generateWrapper(demo),
    );
    filesWritten += 2;
  }

  // Generate registry
  write("lib/native-demos.generated.ts", generateRegistry(supported));
  filesWritten += 1;

  console.log(
    JSON.stringify({
      level: "info",
      action: "native_gallery_generated",
      supported: supported.length,
      unsupported: unsupported.length,
      slugs: supported.map((d) => d.slug),
      filesWritten,
    }),
  );
}

main();
