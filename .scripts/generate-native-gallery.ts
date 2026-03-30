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
import * as ts from "typescript";

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

type UiStatus = "native-ready" | "adapter-required" | "placeholder";

type RouteMap = {
  start: { original: string; gallery: string };
  readable: { original: string; gallery: string };
  extras: Record<string, string>;
};

type UiAnalysis = {
  status: UiStatus;
  reasons: string[];
  fetchPaths: string[];
};

type DemoPropValueKind = "string" | "array" | "object";

type DemoComponentProp = {
  name: string;
  valueKind: DemoPropValueKind;
};

type DemoComponentMetadata = {
  exportName: string | null;
  importPath: string | null;
  sourcePath: string | null;
  props: DemoComponentProp[];
  requiresInlineWrapper: boolean;
};

type SupportedDemo = {
  slug: string;
  title: string;
  workflows: WorkflowInfo[];
  extraRoutes: string[];
  /** The exported component name from the demo's app/components/demo.tsx */
  componentExportName: string | null;
  componentImportPath: string | null;
  componentSourcePath: string | null;
  componentProps: DemoComponentProp[];
  componentRequiresInlineWrapper: boolean;
  ui: UiAnalysis;
  routeMap: RouteMap;
};

type UnsupportedDemo = {
  slug: string;
  reason: string;
  workflowFiles: string[];
};

type GenerationError = {
  slug: string;
  kind: "start_route_missing" | "extra_route_missing";
  output: string;
  sourceCandidates?: string[];
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

  // Clean generated code-props modules (only remove GENERATED files, not the directory)
  const codePropsDir = join(ROOT, "lib/generated/demo-code-props");
  if (existsSync(codePropsDir)) {
    for (const file of readdirSync(codePropsDir)) {
      const filePath = join(codePropsDir, file);
      const content = readFileSync(filePath, "utf8");
      if (content.startsWith("// GENERATED")) {
        rmSync(filePath, { force: true });
      }
    }
  }

  // Clean generated code-props dispatcher
  const codeDispatcherPath = join(ROOT, "lib/native-demo-code.generated.ts");
  if (existsSync(codeDispatcherPath)) {
    rmSync(codeDispatcherPath, { force: true });
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

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function isExportedDemoFunction(node: ts.FunctionDeclaration): boolean {
  if (!node.name || !node.modifiers) return false;
  return (
    (node.name.text.endsWith("Demo") || node.name.text.endsWith("DemoClient")) &&
    node.modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
  );
}

function collectLocalTypeDeclarations(sourceFile: ts.SourceFile): Map<string, ts.TypeNode> {
  const declarations = new Map<string, ts.TypeNode>();

  for (const statement of sourceFile.statements) {
    if (ts.isTypeAliasDeclaration(statement)) {
      declarations.set(statement.name.text, statement.type);
      continue;
    }

    if (ts.isInterfaceDeclaration(statement)) {
      declarations.set(statement.name.text, ts.factory.createTypeLiteralNode([...statement.members]));
    }
  }

  return declarations;
}

function inferValueKindFromName(name: string): DemoPropValueKind | null {
  if (
    name.endsWith("Code") ||
    name.endsWith("Directive")
  ) {
    return "string";
  }

  if (
    name.endsWith("LinesHtml") ||
    name.endsWith("HtmlLines") ||
    name.endsWith("Codes") ||
    name.endsWith("Names") ||
    name.endsWith("Content")
  ) {
    return "array";
  }

  if (name === "lineMap" || name.endsWith("LineMap")) {
    return "object";
  }

  return null;
}

function resolveTypeNode(
  typeNode: ts.TypeNode | undefined,
  declarations: Map<string, ts.TypeNode>,
  seen = new Set<string>(),
): ts.TypeNode | undefined {
  if (!typeNode) return undefined;

  if (ts.isParenthesizedTypeNode(typeNode)) {
    return resolveTypeNode(typeNode.type, declarations, seen);
  }

  if (!ts.isTypeReferenceNode(typeNode) || !ts.isIdentifier(typeNode.typeName)) {
    return typeNode;
  }

  const typeName = typeNode.typeName.text;
  if (seen.has(typeName)) return typeNode;

  const declaration = declarations.get(typeName);
  if (!declaration) return typeNode;

  const nextSeen = new Set(seen);
  nextSeen.add(typeName);
  return resolveTypeNode(declaration, declarations, nextSeen) ?? declaration;
}

function inferValueKindFromTypeNode(
  typeNode: ts.TypeNode | undefined,
  declarations: Map<string, ts.TypeNode>,
): DemoPropValueKind {
  const resolved = resolveTypeNode(typeNode, declarations);
  if (!resolved) return "object";

  if (resolved.kind === ts.SyntaxKind.StringKeyword) {
    return "string";
  }

  if (ts.isArrayTypeNode(resolved) || ts.isTupleTypeNode(resolved)) {
    return "array";
  }

  if (ts.isUnionTypeNode(resolved)) {
    const hasString = resolved.types.some((type) => type.kind === ts.SyntaxKind.StringKeyword);
    if (hasString) return "string";
  }

  if (ts.isTypeReferenceNode(resolved) && ts.isIdentifier(resolved.typeName)) {
    const typeName = resolved.typeName.text;
    if (typeName === "Array" || typeName === "ReadonlyArray") {
      return "array";
    }
    if (typeName === "Record" || typeName === "Partial") {
      return "object";
    }
  }

  if (
    ts.isTypeLiteralNode(resolved) ||
    ts.isIntersectionTypeNode(resolved) ||
    ts.isMappedTypeNode(resolved) ||
    ts.isTypeReferenceNode(resolved)
  ) {
    return "object";
  }

  return "object";
}

function collectTypeMembers(
  typeNode: ts.TypeNode | undefined,
  declarations: Map<string, ts.TypeNode>,
): Map<string, ts.TypeNode | undefined> {
  const members = new Map<string, ts.TypeNode | undefined>();
  const resolved = resolveTypeNode(typeNode, declarations);
  if (!resolved) return members;

  if (ts.isTypeLiteralNode(resolved)) {
    for (const member of resolved.members) {
      if (!ts.isPropertySignature(member) || !member.name) continue;
      if (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)) {
        members.set(member.name.text, member.type);
      }
    }
  }

  return members;
}

function moduleExists(relativePath: string): boolean {
  const candidates = [
    relativePath,
    `${relativePath}.ts`,
    `${relativePath}.tsx`,
    join(relativePath, "index.ts"),
    join(relativePath, "index.tsx"),
  ];

  return candidates.some((candidate) => existsSync(join(ROOT, candidate)));
}

function normalizePath(path: string): string {
  return path
    .split("/")
    .reduce((acc: string[], part) => {
      if (!part || part === ".") return acc;
      if (part === "..") {
        acc.pop();
        return acc;
      }
      acc.push(part);
      return acc;
    }, [])
    .join("/");
}

function rewriteComponentImportSpecifier(
  specifier: string,
  importerPath: string,
  slug: string,
): string {
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    return `@/${normalizePath(join(dirname(importerPath), specifier))}`;
  }

  if (specifier.startsWith("@/")) {
    const aliasedPath = specifier.slice(2);

    if (specifier.startsWith("@/components/")) {
      const componentPath = specifier.slice("@/components/".length);
      if (moduleExists(`${slug}/components/${componentPath}`)) {
        return `@/${slug}/components/${componentPath}`;
      }
      if (moduleExists(`${slug}/app/components/${componentPath}`)) {
        return `@/${slug}/app/components/${componentPath}`;
      }
    }

    if (!moduleExists(aliasedPath) && moduleExists(`${slug}/${aliasedPath}`)) {
      return `@/${slug}/${aliasedPath}`;
    }
  }

  return specifier;
}

function componentNeedsInlineWrapper(
  sourceFile: ts.SourceFile,
  importerPath: string,
  slug: string,
): boolean {
  for (const statement of sourceFile.statements) {
    if (
      (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      const specifier = statement.moduleSpecifier.text;
      // Relative imports resolve correctly based on the file's physical
      // location, so they never require inlining the component source.
      if (specifier.startsWith("./") || specifier.startsWith("../")) {
        continue;
      }
      const rewritten = rewriteComponentImportSpecifier(specifier, importerPath, slug);
      if (rewritten !== specifier) {
        return true;
      }
    }
  }

  return false;
}

function rewriteComponentSource(relativePath: string, slug: string): string {
  const source = readFileSync(join(ROOT, relativePath), "utf8");

  return source.replace(
    /((?:import|export)\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["'])([^"']+)(["'])/g,
    (match, prefix, specifier, suffix) => {
      const rewritten = rewriteComponentImportSpecifier(specifier, relativePath, slug);
      if (rewritten === specifier) {
        return match;
      }
      return `${prefix}${rewritten}${suffix}`;
    },
  );
}

function resolveComponentSourcePath(slug: string): string | null {
  const candidates = [
    `${slug}/app/components/demo.tsx`,
    `${slug}/app/components/${slug}-demo.tsx`,
    `${slug}/app/components/${slug}-demo-client.tsx`,
  ];

  for (const relativePath of candidates) {
    if (existsSync(join(ROOT, relativePath))) {
      return relativePath;
    }
  }

  return null;
}

function extractComponentMetadata(slug: string): DemoComponentMetadata {
  const relativePath = resolveComponentSourcePath(slug);
  if (!relativePath) {
    return {
      exportName: null,
      importPath: null,
      sourcePath: null,
      props: [],
      requiresInlineWrapper: false,
    };
  }

  const demoPath = join(ROOT, relativePath);
  const source = readFileSync(demoPath, "utf8");
  const sourceFile = ts.createSourceFile(demoPath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = collectLocalTypeDeclarations(sourceFile);
  const requiresInlineWrapper = componentNeedsInlineWrapper(sourceFile, relativePath, slug);

  for (const statement of sourceFile.statements) {
    if (!ts.isFunctionDeclaration(statement) || !isExportedDemoFunction(statement)) {
      continue;
    }

    const exportName = statement.name?.text ?? null;
    const parameter = statement.parameters[0];
    if (!parameter || !ts.isObjectBindingPattern(parameter.name)) {
      return {
        exportName,
        importPath: "@/" + relativePath.replace(/\.tsx$/, ""),
        sourcePath: relativePath,
        props: [],
        requiresInlineWrapper,
      };
    }

    const typeMembers = collectTypeMembers(parameter.type, declarations);
    const props: DemoComponentProp[] = [];

    for (const element of parameter.name.elements) {
      if (!ts.isBindingElement(element) || element.dotDotDotToken) continue;
      if (!ts.isIdentifier(element.name)) continue;

      const propNameNode = element.propertyName ?? element.name;
      if (!ts.isIdentifier(propNameNode) && !ts.isStringLiteral(propNameNode)) continue;

      const propName = propNameNode.text;
      const nameKind = inferValueKindFromName(propName);
      const typeKind = inferValueKindFromTypeNode(typeMembers.get(propName), declarations);

      props.push({
        name: propName,
        valueKind: nameKind ?? typeKind,
      });
    }

    return {
      exportName,
      importPath: "@/" + relativePath.replace(/\.tsx$/, ""),
      sourcePath: relativePath,
      props,
      requiresInlineWrapper,
    };
  }

  return {
    exportName: null,
    importPath: null,
    sourcePath: relativePath,
    props: [],
    requiresInlineWrapper,
  };
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
// Route mapping & UI analysis
// ---------------------------------------------------------------------------

function findMainApiRoute(entry: DemoCatalogEntry): string | null {
  const exact = `${entry.slug}/app/api/${entry.slug}/route.ts`;
  return (
    entry.apiRoutes.find((route) => route === exact) ??
    entry.apiRoutes.find(
      (route) => !route.includes("readable") && !route.includes("[runId]"),
    ) ??
    null
  );
}

function toApiPathFromRouteFile(
  slug: string,
  routeFile: string,
): string | null {
  const match = routeFile.match(
    new RegExp(`^${escapeRegExp(slug)}/app/(api/.+)/route\\.ts$`),
  );
  return match ? `/${match[1]}` : null;
}

function buildRouteMap(entry: DemoCatalogEntry): RouteMap {
  const startSource = findMainApiRoute(entry);
  const startOriginal =
    (startSource && toApiPathFromRouteFile(entry.slug, startSource)) ??
    `/api/${entry.slug}`;

  const extras: Record<string, string> = {};
  for (const extraRoutePath of entry.extraRoutes) {
    const originalPath = toApiPathFromRouteFile(entry.slug, extraRoutePath);
    if (!originalPath) continue;
    const routeSegment = originalPath.replace(/^\/api\//, "");
    const galleryPath = routeSegment.startsWith(`${entry.slug}/`)
      ? originalPath
      : `/api/${entry.slug}/${routeSegment}`;
    extras[originalPath] = galleryPath;
  }

  return {
    start: {
      original: startOriginal,
      gallery: `/api/${entry.slug}`,
    },
    readable: {
      original: "/api/readable/[runId]",
      gallery: "/api/readable/[runId]",
    },
    extras,
  };
}

function extractClientApiPaths(slug: string): string[] {
  const demoPath = join(ROOT, slug, "app/components/demo.tsx");
  if (!existsSync(demoPath)) return [];
  const source = readFileSync(demoPath, "utf8");
  const paths = new Set<string>();
  for (const regex of [
    /fetch\(\s*["'`](\/api\/[^"'`]+)["'`]/g,
    /postJson(?:<[^>]+>)?\(\s*["'`](\/api\/[^"'`]+)["'`]/g,
  ]) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(source)) !== null) {
      paths.add(match[1]);
    }
  }
  return [...paths].sort();
}

function analyzeUiCompatibility(
  entry: DemoCatalogEntry,
  componentExportName: string | null,
): { ui: UiAnalysis; routeMap: RouteMap } {
  const routeMap = buildRouteMap(entry);
  const fetchPaths = extractClientApiPaths(entry.slug);
  const reasons: string[] = [];

  if (!componentExportName) reasons.push("component_export_missing");

  for (const path of fetchPaths) {
    if (path.startsWith("/api/readable/")) continue;
    if (path === routeMap.start.gallery) continue;
    if (
      path === routeMap.start.original &&
      routeMap.start.original !== routeMap.start.gallery
    ) {
      reasons.push(`hardcoded_start_route:${path}->${routeMap.start.gallery}`);
      continue;
    }
    const rewrittenExtra = routeMap.extras[path];
    if (rewrittenExtra && rewrittenExtra !== path) {
      reasons.push(`hardcoded_extra_route:${path}->${rewrittenExtra}`);
    }
  }

  const status: UiStatus = componentExportName ? "native-ready" : "placeholder";

  console.log(
    JSON.stringify({
      level: "info",
      action: "ui_analysis",
      slug: entry.slug,
      status,
      componentExportName,
      fetchPaths,
      reasons,
      routeMap,
    }),
  );

  return { ui: { status, reasons, fetchPaths }, routeMap };
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

    for (const wfFile of entry.workflowFiles) {
      const functionName = extractWorkflowFunctionName(wfFile);
      if (!functionName) {
        console.log(
          JSON.stringify({
            level: "warn",
            action: "workflow_function_name_unresolved",
            slug: entry.slug,
            workflowFile: wfFile,
          }),
        );
        continue;
      }
      workflows.push({
        filePath: wfFile,
        functionName,
        importPath: toImportPath(wfFile),
      });
    }

    const hasCopyableRoute = findMainApiRoute(entry) !== null;

    if (!hasCopyableRoute) {
      unsupported.push({
        slug: entry.slug,
        reason: "start_route_not_found",
        workflowFiles: entry.workflowFiles,
      });
      continue;
    }

    if (workflows.length === 0) {
      console.log(
        JSON.stringify({
          level: "warn",
          action: "route_copy_only_demo",
          slug: entry.slug,
          reason: "workflow_function_not_found_but_route_copyable",
        }),
      );
    }

    const componentMetadata = extractComponentMetadata(entry.slug);
    const componentExportName = componentMetadata.exportName;

    const { ui, routeMap } = analyzeUiCompatibility(
      entry,
      componentExportName,
    );

    supported.push({
      slug: entry.slug,
      title: entry.title,
      workflows,
      extraRoutes: entry.extraRoutes,
      componentExportName,
      componentImportPath: componentMetadata.importPath,
      componentSourcePath: componentMetadata.sourcePath,
      componentProps: componentMetadata.props,
      componentRequiresInlineWrapper: componentMetadata.requiresInlineWrapper,
      ui,
      routeMap,
    });

    console.log(
      JSON.stringify({
        level: "info",
        action: "parsed_demo",
        slug: entry.slug,
        workflowCount: workflows.length,
        extraRouteCount: entry.extraRoutes.length,
        componentExportName,
        componentImportPath: componentMetadata.importPath,
        componentSourcePath: componentMetadata.sourcePath,
        componentProps: componentMetadata.props,
        componentRequiresInlineWrapper: componentMetadata.requiresInlineWrapper,
        uiStatus: ui.status,
        uiReasons: ui.reasons,
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
 */
function generateStartRoute(demo: SupportedDemo, catalogEntry: DemoCatalogEntry): string | null {
  const mainApiRoute = findMainApiRoute(catalogEntry);
  if (!mainApiRoute) {
    console.error(
      JSON.stringify({
        level: "error",
        action: "start_route_source_unresolved",
        slug: demo.slug,
        expected: `${demo.slug}/app/api/${demo.slug}/route.ts`,
        apiRoutes: catalogEntry.apiRoutes,
      }),
    );
    return null;
  }

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
    `function log(`,
    `  level: "info" | "warn" | "error",`,
    `  action: string,`,
    `  data: Record<string, unknown>,`,
    `) {`,
    `  const entry = {`,
    `    level,`,
    `    route: "/api/readable/[runId]",`,
    `    action,`,
    `    ...data,`,
    `  };`,
    `  if (level === "error") {`,
    `    console.error(JSON.stringify(entry));`,
    `    return;`,
    `  }`,
    `  if (level === "warn") {`,
    `    console.warn(JSON.stringify(entry));`,
    `    return;`,
    `  }`,
    `  console.log(JSON.stringify(entry));`,
    `}`,
    ``,
    `function jsonError(`,
    `  status: number,`,
    `  code: string,`,
    `  message: string,`,
    `  runId: string,`,
    `) {`,
    `  return Response.json(`,
    `    { ok: false, error: { code, message }, runId },`,
    `    { status, headers: { "Cache-Control": "no-store" } },`,
    `  );`,
    `}`,
    ``,
    `export async function GET(`,
    `  _request: NextRequest,`,
    `  { params }: ReadableRouteContext,`,
    `) {`,
    `  const { runId } = await params;`,
    `  log("info", "readable_open", { runId });`,
    ``,
    `  let run;`,
    `  try {`,
    `    run = getRun(runId);`,
    `  } catch (error) {`,
    `    const message =`,
    `      error instanceof Error ? error.message : "Run not found";`,
    `    log("warn", "readable_run_not_found", { runId, message });`,
    `    return jsonError(404, "RUN_NOT_FOUND", message, runId);`,
    `  }`,
    ``,
    `  const readable = run.getReadable();`,
    `  const encoder = new TextEncoder();`,
    `  const sseStream = (readable as ReadableStream).pipeThrough(`,
    `    new TransformStream({`,
    `      transform(chunk, controller) {`,
    `        const data =`,
    `          typeof chunk === "string" ? chunk : JSON.stringify(chunk);`,
    "        controller.enqueue(encoder.encode(`data: ${data}\\n\\n`));",
    `      },`,
    `      flush() {`,
    `        log("info", "readable_closed", { runId });`,
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
 * Demos with a component export get a thin prop pass-through wrapper.
 * Code-pane props are injected by the server-side detail page, not embedded here.
 * Demos without a component export get a metadata placeholder.
 */
function generateWrapper(demo: SupportedDemo): string {
  if (demo.componentExportName) {
    const componentName = `${toPascalCase(demo.slug)}NativeDemo`;

    if (demo.componentRequiresInlineWrapper && demo.componentSourcePath) {
      if (demo.componentProps.length === 0) {
        return [
          HEADER.trimEnd(),
          rewriteComponentSource(demo.componentSourcePath, demo.slug).trimEnd(),
          ``,
          `export default function ${componentName}() {`,
          `  return <${demo.componentExportName} />;`,
          `}`,
          ``,
        ].join("\n");
      }
      return [
        HEADER.trimEnd(),
        rewriteComponentSource(demo.componentSourcePath, demo.slug).trimEnd(),
        ``,
        `export type ${componentName}Props = Parameters<typeof ${demo.componentExportName}>[0];`,
        ``,
        `export default function ${componentName}(props: ${componentName}Props) {`,
        `  return <${demo.componentExportName} {...props} />;`,
        `}`,
        ``,
      ].join("\n");
    }

    if (demo.componentProps.length === 0) {
      return [
        HEADER.trimEnd(),
        `"use client";`,
        ``,
        `import { ${demo.componentExportName} } from ${JSON.stringify(demo.componentImportPath ?? `@/${demo.slug}/app/components/demo`)};`,
        ``,
        `export default function ${componentName}() {`,
        `  return <${demo.componentExportName} />;`,
        `}`,
        ``,
      ].join("\n");
    }

    return [
      HEADER.trimEnd(),
      `"use client";`,
      ``,
      `import { ${demo.componentExportName} } from ${JSON.stringify(demo.componentImportPath ?? `@/${demo.slug}/app/components/demo`)};`,
      ``,
      `export type ${componentName}Props = Parameters<typeof ${demo.componentExportName}>[0];`,
      ``,
      `export default function ${componentName}(props: ${componentName}Props) {`,
      `  return <${demo.componentExportName} {...props} />;`,
      `}`,
      ``,
    ].join("\n");
  }

  const componentName = `${toPascalCase(demo.slug)}NativePlaceholder`;
  const meta = {
    slug: demo.slug,
    uiStatus: demo.ui.status,
    uiReasons: demo.ui.reasons,
    routeMap: demo.routeMap,
  };

  return [
    HEADER.trimEnd(),
    `"use client";`,
    ``,
    `const meta = ${JSON.stringify(meta, null, 2)} as const;`,
    ``,
    `export default function ${componentName}() {`,
    `  return (`,
    `    <pre`,
    `      data-native-demo-meta={JSON.stringify(meta)}`,
    `      className="overflow-x-auto rounded-lg border border-gray-300 bg-background-200 p-4 text-xs text-gray-900"`,
    `    >`,
    `      {JSON.stringify(meta, null, 2)}`,
    `    </pre>`,
    `  );`,
    `}`,
    ``,
  ].join("\n");
}

function indentBlock(value: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => (line.length === 0 ? line : `${pad}${line}`))
    .join("\n");
}

function generateRegistry(
  demos: SupportedDemo[],
  extraRoutesBySlug: Map<string, string[]>,
): string {
  const entries = demos
    .map((demo) => {
      const primary = demo.workflows[0];
      const apiRoutes = [
        { route: demo.routeMap.start.gallery, kind: "start" as const },
        { route: demo.routeMap.readable.gallery, kind: "readable" as const },
        ...(extraRoutesBySlug.get(demo.slug) ?? []).map((route) => ({
          route,
          kind: "extra" as const,
        })),
      ];

      return [
        `  ${JSON.stringify(demo.slug)}: {`,
        `    title: ${JSON.stringify(demo.title)},`,
        `    workflowId: ${JSON.stringify(primary?.filePath ?? `${demo.slug}/workflows/unknown`)},`,
        `    uiStatus: ${JSON.stringify(demo.ui.status)},`,
        `    uiReasons: ${JSON.stringify(demo.ui.reasons)},`,
        `    routeMap: ${indentBlock(JSON.stringify(demo.routeMap, null, 2), 4).trimStart()},`,
        `    apiRoutes: ${indentBlock(JSON.stringify(apiRoutes, null, 2), 4).trimStart()},`,
        `    component: () => import("@/app/components/demos/${demo.slug}-native"),`,
        `  }`,
      ].join("\n");
    })
    .join(",\n");

  return [
    HEADER.trimEnd(),
    `import type { ComponentType } from "react";`,
    ``,
    `export type NativeDemoUiStatus = "native-ready" | "adapter-required" | "placeholder";`,
    `export type NativeDemoRouteKind = "start" | "readable" | "extra";`,
    ``,
    `export type NativeDemo = {`,
    `  title: string;`,
    `  workflowId: string;`,
    `  uiStatus: NativeDemoUiStatus;`,
    `  uiReasons: string[];`,
    `  routeMap: {`,
    `    start: { original: string; gallery: string };`,
    `    readable: { original: string; gallery: string };`,
    `    extras: Record<string, string>;`,
    `  };`,
    `  apiRoutes: Array<{ route: string; kind: NativeDemoRouteKind }>;`,
    `  // eslint-disable-next-line @typescript-eslint/no-explicit-any`,
    `  component: () => Promise<{ default: ComponentType<any> }>;`,
    `};`,
    ``,
    `export const nativeDemos: Record<string, NativeDemo> = {`,
    entries,
    `};`,
    ``,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Code-props generation (server-side code workbench pipeline)
// ---------------------------------------------------------------------------

/**
 * Generates the fan-out code-props module that reads the workflow source
 * from the monorepo root and produces real highlighted code + line maps.
 */
function generateFanOutCodePropsModule(): string {
  return [
    HEADER.trimEnd(),
    `import { readFileSync } from "node:fs";`,
    `import { join } from "node:path";`,
    `import {`,
    `  collectFunctionBlock,`,
    `  collectUntil,`,
    `  extractFunctionBlock,`,
    `  highlightCodeToHtmlLines,`,
    `} from "@/lib/code-workbench.server";`,
    ``,
    `type ChannelId = "slack" | "email" | "sms" | "pagerduty";`,
    ``,
    `type WorkflowLineMap = {`,
    `  allSettled: number[];`,
    `  deliveries: number[];`,
    `  summary: number[];`,
    `  returnResult: number[];`,
    `};`,
    ``,
    `type StepLineMap = Record<ChannelId, number[]>;`,
    `type StepErrorLineMap = Record<ChannelId, number[]>;`,
    `type StepRetryLineMap = Record<ChannelId, number[]>;`,
    `type StepSuccessLineMap = Record<ChannelId, number[]>;`,
    ``,
    `export type FanOutCodeProps = {`,
    `  workflowCode: string;`,
    `  workflowLinesHtml: string[];`,
    `  stepCode: string;`,
    `  stepLinesHtml: string[];`,
    `  workflowLineMap: WorkflowLineMap;`,
    `  stepLineMap: StepLineMap;`,
    `  stepErrorLineMap: StepErrorLineMap;`,
    `  stepRetryLineMap: StepRetryLineMap;`,
    `  stepSuccessLineMap: StepSuccessLineMap;`,
    `};`,
    ``,
    `function buildWorkflowLineMap(code: string): WorkflowLineMap {`,
    `  const lines = code.split("\\n");`,
    `  return {`,
    `    allSettled: collectUntil(`,
    `      lines,`,
    `      "const settled = await Promise.allSettled(",`,
    `      (line) => line.trim() === ");"`,
    `    ),`,
    `    deliveries: collectUntil(`,
    `      lines,`,
    `      "const deliveries: ChannelResult[]",`,
    `      (line) => line.trim() === "});"`,
    `    ),`,
    `    summary: collectUntil(`,
    `      lines,`,
    `      "return aggregateResults(",`,
    `      (line) => line.includes("return aggregateResults(")`,
    `    ),`,
    `    returnResult: collectUntil(`,
    `      lines,`,
    `      "return aggregateResults(",`,
    `      (line) => line.includes("return aggregateResults(")`,
    `    ),`,
    `  };`,
    `}`,
    ``,
    `function buildStepLineMap(code: string): StepLineMap {`,
    `  const lines = code.split("\\n");`,
    `  return {`,
    `    slack: collectFunctionBlock(lines, "async function sendSlackAlert("),`,
    `    email: collectFunctionBlock(lines, "async function sendEmailAlert("),`,
    `    sms: collectFunctionBlock(lines, "async function sendSmsAlert("),`,
    `    pagerduty: collectFunctionBlock(lines, "async function sendPagerDutyAlert("),`,
    `  };`,
    `}`,
    ``,
    `function findErrorLine(lines: string[], marker: string): number[] {`,
    `  const index = lines.findIndex((line) => line.includes(marker));`,
    `  return index === -1 ? [] : [index + 1];`,
    `}`,
    ``,
    `function buildStepErrorLineMap(code: string): StepErrorLineMap {`,
    `  const lines = code.split("\\n");`,
    `  const errorLine = findErrorLine(lines, "throw new FatalError(");`,
    `  return {`,
    `    slack: errorLine,`,
    `    email: errorLine,`,
    `    sms: errorLine,`,
    `    pagerduty: errorLine,`,
    `  };`,
    `}`,
    ``,
    `function buildStepRetryLineMap(code: string): StepRetryLineMap {`,
    `  const lines = code.split("\\n");`,
    `  const retryLine = findErrorLine(`,
    `    lines,`,
    `    "throw new Error(CHANNEL_ERROR_MESSAGES[channel])"`,
    `  );`,
    `  return {`,
    `    slack: retryLine,`,
    `    email: retryLine,`,
    `    sms: retryLine,`,
    `    pagerduty: retryLine,`,
    `  };`,
    `}`,
    ``,
    `function findReturnLineInBlock(lines: string[], fnMarker: string): number[] {`,
    `  const start = lines.findIndex((line) => line.includes(fnMarker));`,
    `  if (start === -1) return [];`,
    `  for (let i = start + 1; i < lines.length; i++) {`,
    `    if (lines[i].trimStart().startsWith("return ")) return [i + 1];`,
    `    if (lines[i].trimStart().startsWith("async function ") || lines[i].trim() === "}") {`,
    `      if (lines[i].trim() === "}") continue;`,
    `      break;`,
    `    }`,
    `  }`,
    `  return [];`,
    `}`,
    ``,
    `function buildStepSuccessLineMap(code: string): StepSuccessLineMap {`,
    `  const lines = code.split("\\n");`,
    `  const successLine = findReturnLineInBlock(`,
    `    lines,`,
    `    "async function sendChannelAlert("`,
    `  );`,
    `  return {`,
    `    slack: successLine,`,
    `    email: successLine,`,
    `    sms: successLine,`,
    `    pagerduty: successLine,`,
    `  };`,
    `}`,
    ``,
    `export function getFanOutCodeProps(): FanOutCodeProps {`,
    `  const workflowSource = readFileSync(`,
    `    join(process.cwd(), "fan-out/workflows/incident-fanout.ts"),`,
    `    "utf-8",`,
    `  );`,
    ``,
    `  const workflowCode = extractFunctionBlock(`,
    `    workflowSource,`,
    `    "export async function incidentFanOut(",`,
    `  );`,
    ``,
    `  const stepCode = [`,
    `    extractFunctionBlock(workflowSource, "async function sendChannelAlert("),`,
    `    "",`,
    `    extractFunctionBlock(workflowSource, "async function sendSlackAlert("),`,
    `    "",`,
    `    extractFunctionBlock(workflowSource, "async function sendEmailAlert("),`,
    `    "",`,
    `    extractFunctionBlock(workflowSource, "async function sendSmsAlert("),`,
    `    "",`,
    `    extractFunctionBlock(workflowSource, "async function sendPagerDutyAlert("),`,
    `    "",`,
    `    extractFunctionBlock(workflowSource, "async function aggregateResults("),`,
    `  ].join("\\n");`,
    ``,
    `  return {`,
    `    workflowCode,`,
    `    workflowLinesHtml: highlightCodeToHtmlLines(workflowCode),`,
    `    stepCode,`,
    `    stepLinesHtml: highlightCodeToHtmlLines(stepCode),`,
    `    workflowLineMap: buildWorkflowLineMap(workflowCode),`,
    `    stepLineMap: buildStepLineMap(stepCode),`,
    `    stepErrorLineMap: buildStepErrorLineMap(stepCode),`,
    `    stepRetryLineMap: buildStepRetryLineMap(stepCode),`,
    `    stepSuccessLineMap: buildStepSuccessLineMap(stepCode),`,
    `  };`,
    `}`,
    ``,
  ].join("\n");
}

// ---------------------------------------------------------------------------
/**
 * Dispatches template-mode code-props module generation by slug.
 * Throws immediately for unknown slugs instead of silently generating
 * the wrong module content.
 */
function renderTemplateCodePropsModule(slug: string): string {
  switch (slug) {
    case "fan-out":
      return generateFanOutCodePropsModule();
    default:
      throw new Error(
        `No template code-props generator registered for ${slug}`,
      );
  }
}

// Canonical representative demo metadata — single source of truth.
//
// All import lists, dispatcher branches, cache/restore lists, and
// slug-to-function-name mappings are derived from this one array.
// ---------------------------------------------------------------------------

type CodePropsMode = "template" | "preserve-file";

type RealCodePropsDemo = {
  slug: string;
  fn: string;
  mode: CodePropsMode;
};

const REAL_CODE_PROPS_DEMOS: readonly RealCodePropsDemo[] = [
  { slug: "fan-out", fn: "getFanOutCodeProps", mode: "template" },
  { slug: "saga", fn: "getSagaCodeProps", mode: "preserve-file" },
  { slug: "circuit-breaker", fn: "getCircuitBreakerCodeProps", mode: "preserve-file" },
  { slug: "splitter", fn: "getSplitterCodeProps", mode: "preserve-file" },
  { slug: "dead-letter-queue", fn: "getDeadLetterQueueCodeProps", mode: "preserve-file" },
  { slug: "async-request-reply", fn: "getAsyncRequestReplyCodeProps", mode: "preserve-file" },
  { slug: "idempotent-receiver", fn: "getIdempotentReceiverCodeProps", mode: "preserve-file" },
  { slug: "choreography", fn: "getChoreographyCodeProps", mode: "preserve-file" },
  { slug: "cancellable-export", fn: "getCancellableExportCodeProps", mode: "preserve-file" },
  { slug: "onboarding-drip", fn: "getOnboardingDripCodeProps", mode: "preserve-file" },
  { slug: "pipeline", fn: "getPipelineCodeProps", mode: "preserve-file" },
  { slug: "recipient-list", fn: "getRecipientListCodeProps", mode: "preserve-file" },
  { slug: "routing-slip", fn: "getRoutingSlipCodeProps", mode: "preserve-file" },
  { slug: "scatter-gather", fn: "getScatterGatherCodeProps", mode: "preserve-file" },
  { slug: "webhook-basics", fn: "getWebhookBasicsCodeProps", mode: "preserve-file" },
  { slug: "wire-tap", fn: "getWireTapCodeProps", mode: "preserve-file" },
  { slug: "message-history", fn: "getMessageHistoryCodeProps", mode: "preserve-file" },
] as const;

/** Set of slugs that have real code-props modules (derived from REAL_CODE_PROPS_DEMOS). */
const REAL_CODE_PROPS_SLUGS = new Set(REAL_CODE_PROPS_DEMOS.map((d) => d.slug));

// ---------------------------------------------------------------------------
// Standard-generated code-props: 33 demos that follow the common dual-pane
// pattern (workflowCode/stepCode or orchestratorCode/stepCode). These get
// auto-generated modules with real line-map keys extracted from each demo's
// standalone component source.
// ---------------------------------------------------------------------------

const STANDARD_GENERATED_CODE_PROPS_SLUGS = [
  "aggregator",
  "approval-chain",
  "batch-processor",
  "bulkhead",
  "claim-check",
  "competing-consumers",
  "content-based-router",
  "content-enricher",
  "correlation-identifier",
  "detour",
  "event-gateway",
  "event-sourcing",
  "guaranteed-delivery",
  "hedge-request",
  "map-reduce",
  "message-filter",
  // "message-history" excluded: has multiple workflow files, needs explicit bespoke selection
  "message-translator",
  "namespaced-streams",
  "normalizer",
  "priority-queue",
  "process-manager",
  "publish-subscribe",
  "request-reply",
  "resequencer",
  "retry-backoff",
  "retryable-rate-limit",
  "scheduled-digest",
  "scheduler-agent-supervisor",
  "status-poller",
  "throttle",
  "transactional-outbox",
  "wakeable-reminder",
] as const;

const STANDARD_GENERATED_SET = new Set<string>(STANDARD_GENERATED_CODE_PROPS_SLUGS);

function isStandardGeneratedCodePropsSlug(slug: string): boolean {
  return STANDARD_GENERATED_SET.has(slug);
}

type LineMapSpec = {
  propName: string;
  pane: "workflow" | "secondary";
  keys: string[];
};

/**
 * Reads the standalone demo component source and extracts line-map keys
 * by scanning for `propName.keyName`, `propName["keyName"]`, and type
 * definition patterns like `type FooLineMap = { key1: number[]; ... }`.
 */
function extractLineMapKeysFromComponent(
  source: string,
  propName: string,
): string[] {
  const keys = new Set<string>();
  // dot access: propName.keyName
  for (const match of source.matchAll(
    new RegExp(`${propName}\\.([A-Za-z0-9_]+)`, "g"),
  )) {
    keys.add(match[1]);
  }
  // bracket access: propName["keyName"] or propName['keyName']
  for (const match of source.matchAll(
    new RegExp(`${propName}\\[(?:'([^']+)'|"([^"]+)")\\]`, "g"),
  )) {
    keys.add(match[1] ?? match[2]);
  }

  // If direct access didn't find keys, try extracting from type definitions.
  // Look for type aliases like `type WorkflowLineMap = { key1: number[]; ... }`
  // that correspond to this prop name.
  if (keys.size === 0) {
    const typeKeys = extractKeysFromTypeDefinition(source, propName);
    for (const key of typeKeys) keys.add(key);
  }

  return [...keys].sort();
}

/**
 * Extracts keys from a TypeScript type definition that corresponds to a prop name.
 * Handles patterns like:
 *   type WorkflowLineMap = { key1: number[]; key2: number[]; }
 *   type StepLineMap = Record<StepId, number[]>  (then finds the StepId union)
 */
function extractKeysFromTypeDefinition(
  source: string,
  propName: string,
): string[] {
  // Derive likely type name from prop name: e.g. "stepLineMap" → "StepLineMap"
  const baseName = propName.charAt(0).toUpperCase() + propName.slice(1);

  // Also try common variations: FooLineMap, FooMap, etc.
  const typeNameCandidates = [baseName];

  // Search for common type aliases in the source
  // Pattern: type <TypeName> = { ... } where keys have number[] values
  for (const candidate of typeNameCandidates) {
    // Look for type Foo = { key: number[]; ... }
    const typeDefRegex = new RegExp(
      `type\\s+\\w*${candidate.replace(/([A-Z])/g, "[A-Za-z]*$1")}\\w*\\s*=\\s*\\{([^}]+)\\}`,
      "s",
    );
    const typeMatch = source.match(typeDefRegex);
    if (typeMatch) {
      const body = typeMatch[1];
      const keyMatches = body.matchAll(/(\w+)\s*:\s*number\[\]/g);
      const keys: string[] = [];
      for (const m of keyMatches) keys.push(m[1]);
      if (keys.length > 0) return keys;
    }
  }

  // Try broader search: any type definition containing the prop name
  // e.g., type FooLineMap = { ... } or type BatchWorkflowLineMap = { ... }
  const propSuffix = propName.replace(/^(workflow|orchestrator|step|flow|participant|callback)/, "");
  const broadRegex = new RegExp(
    `type\\s+\\w*${propSuffix.charAt(0).toUpperCase()}${propSuffix.slice(1)}\\s*=\\s*\\{([^}]+)\\}`,
    "s",
  );
  const broadMatch = source.match(broadRegex);
  if (broadMatch) {
    const body = broadMatch[1];
    const keyMatches = body.matchAll(/(\w+)\s*:\s*number\[\]/g);
    const keys: string[] = [];
    for (const m of keyMatches) keys.push(m[1]);
    if (keys.length > 0) return keys;
  }

  // Try Record<UnionType, number[]> pattern
  // e.g., type StepLineMap = Record<OutboxStepId, number[]>
  // Then find: type OutboxStepId = "persist" | "relay" | ...
  const recordRegex = new RegExp(
    `type\\s+\\w*${propSuffix.charAt(0).toUpperCase()}${propSuffix.slice(1)}\\s*=\\s*Record<(\\w+),\\s*number\\[\\]>`,
  );
  const recordMatch = source.match(recordRegex);
  if (recordMatch) {
    const unionTypeName = recordMatch[1];
    // Find the union type definition
    const unionRegex = new RegExp(
      `type\\s+${unionTypeName}\\s*=\\s*([^;]+)`,
    );
    const unionMatch = source.match(unionRegex);
    if (unionMatch) {
      const unionBody = unionMatch[1];
      const literalMatches = unionBody.matchAll(/["']([^"']+)["']/g);
      const keys: string[] = [];
      for (const m of literalMatches) keys.push(m[1]);
      if (keys.length > 0) return keys;
    }
  }

  // Last resort: look for string literal union types whose members could be
  // map keys. Try Step*, Highlight*, and any other union types with camelCase members.
  const unionPatterns = [
    /type\s+Step\w*\s*=\s*([^;]+)/,
    /type\s+Highlight\w*\s*=\s*([^;]+)/,
    /type\s+\w*Phase\w*\s*=\s*([^;]+)/,
  ];
  for (const regex of unionPatterns) {
    const unionMatch = source.match(regex);
    if (unionMatch) {
      const unionBody = unionMatch[1];
      const literalMatches = unionBody.matchAll(/["']([^"']+)["']/g);
      const keys: string[] = [];
      for (const m of literalMatches) {
        // Skip "none", "idle", and other non-step values
        if (m[1] !== "none" && m[1] !== "idle") keys.push(m[1]);
      }
      if (keys.length > 0) return keys;
    }
  }

  return [];
}

function readStandaloneDemoComponentSource(slug: string): string {
  // Try standard demo.tsx first, then slug-specific variants, then page.tsx
  const candidates = [
    join(ROOT, slug, "app/components/demo.tsx"),
    join(ROOT, slug, `app/components/${slug}-demo.tsx`),
    join(ROOT, slug, "app/page.tsx"),
  ];
  for (const filePath of candidates) {
    if (existsSync(filePath)) {
      return readFileSync(filePath, "utf8");
    }
  }
  return "";
}

function inferStandardLineMapSpecs(
  slug: string,
  props: DemoComponentProp[],
): LineMapSpec[] {
  const componentSource = readStandaloneDemoComponentSource(slug);
  if (!componentSource) return [];
  return props
    .filter((prop) => classifyCodeProp(prop) === "map")
    .map((prop) => ({
      propName: prop.name,
      pane: (prop.name.startsWith("step") || prop.name.startsWith("callback") || prop.name.startsWith("participant"))
        ? "secondary" as const
        : "workflow" as const,
      keys: extractLineMapKeysFromComponent(componentSource, prop.name),
    }))
    .filter((spec) => spec.keys.length > 0);
}

function pickWorkflowPathForGeneratedModule(demo: SupportedDemo): string {
  if (demo.workflows.length === 0) {
    throw new Error(`No workflow file found for ${demo.slug}`);
  }
  if (demo.workflows.length === 1) {
    return demo.workflows[0].filePath;
  }
  throw new Error(
    `Standard-generated code-props need an explicit workflow selection for ${demo.slug}: ${demo.workflows
      .map((w) => w.filePath)
      .join(", ")}`,
  );
}

function renderStandardGeneratedCodePropsModule(
  demo: SupportedDemo,
): string {
  const workflowPath = pickWorkflowPathForGeneratedModule(demo);

  const fnName = slugToCodePropsFnName(demo.slug);
  const lineMapSpecs = inferStandardLineMapSpecs(demo.slug, demo.componentProps);

  // Determine which panes are needed
  const strategy = inferGenericFallbackStrategy(demo.componentProps);
  const needsSecondary = strategy?.panes.some((p) => p.source === "secondary") ?? false;

  const propEntries = demo.componentProps.map((prop) => {
    // Code string props
    if (prop.name === "workflowCode" || prop.name === "orchestratorCode") {
      return `    ${prop.name}: workflowCode,`;
    }
    if (prop.name === "stepCode") {
      return `    ${prop.name}: secondaryCode,`;
    }
    // HTML lines props
    if (
      prop.name === "workflowLinesHtml" ||
      prop.name === "workflowHtmlLines" ||
      prop.name === "orchestratorHtmlLines"
    ) {
      return `    ${prop.name}: workflowHtmlLines,`;
    }
    if (
      prop.name === "stepLinesHtml" ||
      prop.name === "stepHtmlLines"
    ) {
      return `    ${prop.name}: secondaryHtmlLines,`;
    }
    // Line map props — check if we found real keys
    const lineMapSpec = lineMapSpecs.find(
      (candidate) => candidate.propName === prop.name,
    );
    if (lineMapSpec) {
      const codeVar = lineMapSpec.pane === "workflow" ? "workflowCode" : "secondaryCode";
      const fallbackVar = lineMapSpec.pane === "workflow" ? "workflowFallbackLines" : "secondaryFallbackLines";
      const mapValue = lineMapSpec.keys
        .map((key) => `      ${JSON.stringify(key)}: findBestGeneratedRange(${codeVar}, ${JSON.stringify(key)}, ${fallbackVar}),`)
        .join("\n");
      return `    ${prop.name}: {\n${mapValue}\n    },`;
    }
    // Fallback for unrecognised map props
    if (classifyCodeProp(prop) === "map") {
      return `    ${prop.name}: {},`;
    }
    if (classifyCodeProp(prop) === "html") {
      return `    ${prop.name}: [],`;
    }
    return `    ${prop.name}: "",`;
  });

  const secondaryLines = needsSecondary
    ? [
        `  const extractedSecondary = extractSecondaryFunctionBlocks(source);`,
        `  const secondaryCode = extractedSecondary.length > 0 ? extractedSecondary : source;`,
        `  const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);`,
        `  const secondaryFallbackLines = secondaryCode.split("\\n").map((_: string, i: number) => i + 1);`,
      ]
    : [];

  // Determine if we need the function-level matching helpers
  const needsFunctionMatching = lineMapSpecs.length > 0;

  const imports = [
    `  extractExportedWorkflowBlock,`,
    `  extractSecondaryFunctionBlocks,`,
    `  highlightCodeToHtmlLines,`,
  ];
  if (needsFunctionMatching) {
    imports.push(`  findBlockLineNumbers,`);
    imports.push(`  findLineNumbers,`);
  }

  const helperLines = needsFunctionMatching
    ? [
        ``,
        `function findBestGeneratedRange(code: string, key: string, fallback: number[]): number[] {`,
        `  const blockMarkers = [`,
        `    \`async function \${key}(\`,`,
        `    \`function \${key}(\`,`,
        `    \`const \${key} = async (\`,`,
        `    \`const \${key} = (\`,`,
        `  ];`,
        `  for (const marker of blockMarkers) {`,
        `    const lines = findBlockLineNumbers(code, marker);`,
        `    if (lines.length > 0) return lines;`,
        `  }`,
        `  const callLines = findLineNumbers(code, \`\${key}(\`);`,
        `  if (callLines.length > 0) return callLines;`,
        `  const identifierLines = findLineNumbers(code, key);`,
        `  if (identifierLines.length > 0) return identifierLines;`,
        `  return fallback;`,
        `}`,
      ]
    : [];

  return [
    HEADER.trimEnd(),
    `import { readFileSync } from "node:fs";`,
    `import { join } from "node:path";`,
    `import {`,
    ...imports,
    `} from "@/lib/code-workbench.server";`,
    ...helperLines,
    ``,
    `export function ${fnName}(): Record<string, unknown> {`,
    `  const source = readFileSync(join(process.cwd(), ${JSON.stringify(workflowPath)}), "utf-8");`,
    `  const workflowCode = extractExportedWorkflowBlock(source);`,
    `  const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);`,
    `  const workflowFallbackLines = workflowCode.split("\\n").map((_: string, i: number) => i + 1);`,
    ...secondaryLines,
    `  return {`,
    ...propEntries,
    `  };`,
    `}`,
    ``,
  ].join("\n");
}

/** Map slug → exported function name (derived from REAL_CODE_PROPS_DEMOS). */
function slugToCodePropsFnName(slug: string): string {
  const demo = REAL_CODE_PROPS_DEMOS.find((d) => d.slug === slug);
  return demo?.fn ?? `get${toPascalCase(slug)}CodeProps`;
}

/**
 * Classifies a code-pane prop as "code" (raw source string), "html" (highlighted
 * HTML lines array), or "map" (line map object) so the dispatcher can populate
 * code/html props with real highlighted workflow source while leaving line maps
 * as empty objects for graceful degradation.
 */
function classifyCodeProp(prop: DemoComponentProp): "code" | "html" | "map" | "other" {
  if (prop.valueKind === "string") {
    // e.g. workflowCode, orchestratorCode, stepCode, flowCode, workflowDirective
    if (prop.name.endsWith("Code")) return "code";
    if (prop.name.endsWith("Directive")) return "other";
    return "other";
  }
  if (prop.valueKind === "array") {
    // e.g. workflowLinesHtml, workflowHtmlLines, orchestratorHtmlLines, stepLinesHtml
    if (prop.name.endsWith("LinesHtml") || prop.name.endsWith("HtmlLines")) return "html";
    // e.g. stepCodes, sectionNames, sectionContent — array props that are not HTML
    return "other";
  }
  // object props are line maps
  return "map";
}

// ---------------------------------------------------------------------------
// Multi-pane fallback strategy
// ---------------------------------------------------------------------------

type GenericFallbackPaneSource = "workflow" | "secondary";

type GenericFallbackPane = {
  codeProp: string | null;
  htmlProp: string | null;
  source: GenericFallbackPaneSource;
};

type GenericFallbackStrategy = {
  panes: GenericFallbackPane[];
};

function findNamedProp(
  props: DemoComponentProp[],
  names: readonly string[],
): string | null {
  const match = props.find((prop) => names.includes(prop.name));
  return match?.name ?? null;
}

/**
 * Infers a multi-pane fallback strategy from a demo's component props.
 * Recognises primary workflow panes (workflow*, orchestrator*, flow*) and
 * secondary panes (step*, participant*, callback*) so the dispatcher can
 * populate both from extracted workflow source instead of leaving them blank.
 */
function inferGenericFallbackStrategy(
  props: DemoComponentProp[],
): GenericFallbackStrategy | null {
  const panes: GenericFallbackPane[] = [];

  // Primary workflow pane
  const workflowCodeProp = findNamedProp(props, [
    "workflowCode",
    "orchestratorCode",
    "flowCode",
  ]);
  const workflowHtmlProp = findNamedProp(props, [
    "workflowLinesHtml",
    "workflowHtmlLines",
    "orchestratorLinesHtml",
    "orchestratorHtmlLines",
    "flowLinesHtml",
    "flowHtmlLines",
  ]);

  if (workflowCodeProp || workflowHtmlProp) {
    panes.push({
      codeProp: workflowCodeProp,
      htmlProp: workflowHtmlProp,
      source: "workflow",
    });
  }

  // Secondary panes
  const secondarySpecs = [
    { codeNames: ["stepCode"], htmlNames: ["stepLinesHtml", "stepHtmlLines"] },
    { codeNames: ["participantCode"], htmlNames: ["participantLinesHtml", "participantHtmlLines"] },
    { codeNames: ["callbackCode"], htmlNames: ["callbackLinesHtml", "callbackHtmlLines"] },
  ] as const;

  for (const spec of secondarySpecs) {
    const codeProp = findNamedProp(props, spec.codeNames);
    const htmlProp = findNamedProp(props, spec.htmlNames);
    if (!codeProp && !htmlProp) continue;
    panes.push({
      codeProp,
      htmlProp,
      source: "secondary",
    });
  }

  return panes.length > 0 ? { panes } : null;
}

function generateCodePropsDispatcher(demos: SupportedDemo[]): string {
  // Track whether any non-module demo needs the generic inline fallback
  let needsGenericImports = false;

  const cases = demos
    .map((demo) => {
      // Bespoke preserved/template modules
      if (REAL_CODE_PROPS_SLUGS.has(demo.slug)) {
        const fnName = slugToCodePropsFnName(demo.slug);
        return [
          `    case ${JSON.stringify(demo.slug)}:`,
          `      return ${fnName}();`,
        ].join("\n");
      }
      // Standard-generated modules
      if (isStandardGeneratedCodePropsSlug(demo.slug)) {
        const fnName = slugToCodePropsFnName(demo.slug);
        return [
          `    case ${JSON.stringify(demo.slug)}:`,
          `      return ${fnName}();`,
        ].join("\n");
      }
      if (demo.componentProps.length === 0) {
        return [
          `    case ${JSON.stringify(demo.slug)}:`,
          `      return {};`,
        ].join("\n");
      }

      // For remaining special-shape demos, generate inline multi-pane fallback
      const strategy = inferGenericFallbackStrategy(demo.componentProps);
      const workflowPath = demo.workflows[0]?.filePath ?? null;

      if (strategy && workflowPath) {
        needsGenericImports = true;

        const entries = demo.componentProps.map((prop) => {
          const pane = strategy.panes.find(
            (candidate) =>
              candidate.codeProp === prop.name ||
              candidate.htmlProp === prop.name,
          );

          if (pane?.source === "workflow") {
            if (prop.name === pane.codeProp) {
              return `        ${prop.name}: workflowCode,`;
            }
            if (prop.name === pane.htmlProp) {
              return `        ${prop.name}: workflowHtmlLines,`;
            }
          }

          if (pane?.source === "secondary") {
            if (prop.name === pane.codeProp) {
              return `        ${prop.name}: secondaryCode,`;
            }
            if (prop.name === pane.htmlProp) {
              return `        ${prop.name}: secondaryHtmlLines,`;
            }
          }

          const cls = classifyCodeProp(prop);
          if (cls === "code") return `        ${prop.name}: "",`;
          if (cls === "html") return `        ${prop.name}: [],`;
          if (cls === "map") return `        ${prop.name}: {},`;
          // "other" — use type-appropriate default
          const value =
            prop.valueKind === "string" ? `""` :
            prop.valueKind === "array" ? `[]` : `{}`;
          return `        ${prop.name}: ${value},`;
        });

        // Determine if any pane uses secondary source
        const needsSecondary = strategy.panes.some((p) => p.source === "secondary");

        const secondaryLines = needsSecondary
          ? [
              `      const extractedSecondaryCode = extractSecondaryFunctionBlocks(workflowSource);`,
              `      const secondaryCode = extractedSecondaryCode.length > 0 ? extractedSecondaryCode : workflowSource;`,
              `      const secondaryHtmlLines = highlightCodeToHtmlLines(secondaryCode);`,
            ]
          : [];

        return [
          `    case ${JSON.stringify(demo.slug)}: {`,
          `      const workflowSource = readWorkflowSource(${JSON.stringify(workflowPath)});`,
          `      const workflowCode = extractExportedWorkflowBlock(workflowSource);`,
          `      const workflowHtmlLines = highlightCodeToHtmlLines(workflowCode);`,
          ...secondaryLines,
          `      return {`,
          ...entries,
          `      };`,
          `    }`,
        ].join("\n");
      }

      // No recognisable code+html pair or no workflow file — use defaults
      const entries = demo.componentProps.map((prop) => {
        const value =
          prop.valueKind === "string"
            ? `""`
            : prop.valueKind === "array"
              ? `[]`
              : `{}`;
        return `        ${prop.name}: ${value},`;
      });
      return [
        `    case ${JSON.stringify(demo.slug)}:`,
        `      return {`,
        ...entries,
        `      };`,
      ].join("\n");
    })
    .join("\n");

  // Imports for bespoke modules
  const bespokeImports = REAL_CODE_PROPS_DEMOS.map(
    (d) => `import { ${d.fn} } from "@/lib/generated/demo-code-props/${d.slug}";`,
  );

  // Imports for standard-generated modules
  const standardImports = STANDARD_GENERATED_CODE_PROPS_SLUGS.map(
    (slug) => `import { ${slugToCodePropsFnName(slug)} } from "@/lib/generated/demo-code-props/${slug}";`,
  );

  const genericImports = needsGenericImports
    ? [
        `import { readFileSync } from "node:fs";`,
        `import { join } from "node:path";`,
        `import {`,
        `  extractExportedWorkflowBlock,`,
        `  extractSecondaryFunctionBlocks,`,
        `  highlightCodeToHtmlLines,`,
        `} from "@/lib/code-workbench.server";`,
      ]
    : [];

  const helperFn = needsGenericImports
    ? [
        ``,
        `function readWorkflowSource(relPath: string): string {`,
        `  try {`,
        `    return readFileSync(join(process.cwd(), relPath), "utf-8");`,
        `  } catch {`,
        `    return "// Source not available";`,
        `  }`,
        `}`,
      ]
    : [];

  return [
    HEADER.trimEnd(),
    ...genericImports,
    ...bespokeImports,
    ...standardImports,
    ...helperFn,
    ``,
    `export async function getNativeDemoCodeProps(`,
    `  slug: string,`,
    `): Promise<Record<string, unknown>> {`,
    `  switch (slug) {`,
    cases,
    `    default:`,
    `      return {};`,
    `  }`,
    `}`,
    ``,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  // Cache code-props module contents before cleaning (cleanup deletes the directory).
  // Only preserve-file demos need caching; template demos are regenerated from scratch.
  const cachedCodePropsModules = new Map<string, string>();
  const missingPreserved: RealCodePropsDemo[] = [];
  for (const demo of REAL_CODE_PROPS_DEMOS) {
    if (demo.mode !== "preserve-file") continue;
    const filePath = join(ROOT, `lib/generated/demo-code-props/${demo.slug}.ts`);
    if (existsSync(filePath)) {
      cachedCodePropsModules.set(demo.slug, readFileSync(filePath, "utf8"));
    } else {
      missingPreserved.push(demo);
    }
  }

  // Fail fast BEFORE cleaning if any preserved modules are missing.
  // This avoids writing 100+ files then failing, leaving partial state.
  if (missingPreserved.length > 0) {
    for (const demo of missingPreserved) {
      console.error(
        JSON.stringify({
          level: "error",
          action: "missing_preserved_code_props_module",
          slug: demo.slug,
          expectedPath: `lib/generated/demo-code-props/${demo.slug}.ts`,
        }),
      );
    }
    process.exit(1);
  }

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
  const generationErrors: GenerationError[] = [];

  for (const demo of supported) {
    const catalogEntry = catalogBySlug.get(demo.slug)!;

    // Generate start route with full parity
    const startRoute = generateStartRoute(demo, catalogEntry);
    if (!startRoute) {
      generationErrors.push({
        slug: demo.slug,
        kind: "start_route_missing",
        output: `app/api/${demo.slug}/route.ts`,
        sourceCandidates: catalogEntry.apiRoutes.filter(
          (route) => !route.includes("readable"),
        ),
      });
      continue;
    }

    write(`app/api/${demo.slug}/route.ts`, startRoute);
    startRoutesGenerated++;
    filesWritten++;

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

  if (generationErrors.length > 0) {
    console.error(
      JSON.stringify({
        level: "error",
        action: "native_gallery_generation_failed",
        errorCount: generationErrors.length,
        errors: generationErrors,
      }),
    );
    process.exit(1);
  }

  // Generate registry
  write("lib/native-demos.generated.ts", generateRegistry(supported, extraRoutesBySlug));
  filesWritten++;

  // Generate/restore code-props modules for all representative demos.
  // Template-mode demos are regenerated; preserve-file demos are restored from cache.
  // Missing preserve-file modules were already caught before cleaning started.
  for (const demo of REAL_CODE_PROPS_DEMOS) {
    if (demo.mode === "template") {
      write(
        `lib/generated/demo-code-props/${demo.slug}.ts`,
        renderTemplateCodePropsModule(demo.slug),
      );
    } else {
      // preserve-file: restore from cached pre-clean content (validated above)
      write(
        `lib/generated/demo-code-props/${demo.slug}.ts`,
        cachedCodePropsModules.get(demo.slug)!,
      );
    }
    filesWritten++;
  }

  // Generate standard code-props modules for the 33 dual-pane demos.
  // These read real workflow source, extract primary + secondary blocks,
  // highlight both, and populate line maps with keys from each demo's component.
  const supportedBySlug = new Map(supported.map((d) => [d.slug, d]));
  for (const slug of STANDARD_GENERATED_CODE_PROPS_SLUGS) {
    const demo = supportedBySlug.get(slug);
    if (!demo) {
      console.log(
        JSON.stringify({
          level: "warn",
          action: "standard_code_props_slug_not_in_supported",
          slug,
        }),
      );
      continue;
    }
    write(
      `lib/generated/demo-code-props/${slug}.ts`,
      renderStandardGeneratedCodePropsModule(demo),
    );
    filesWritten++;
  }

  // Generate code-props dispatcher (routes slug → module function or inline fallback)
  write(
    "lib/native-demo-code.generated.ts",
    generateCodePropsDispatcher(supported),
  );
  filesWritten++;

  const uiCounts = supported.reduce<Record<UiStatus, number>>(
    (acc, demo) => {
      acc[demo.ui.status] += 1;
      return acc;
    },
    { "native-ready": 0, "adapter-required": 0, placeholder: 0 },
  );

  console.log(
    JSON.stringify({
      level: "info",
      action: "native_gallery_generated",
      supported: supported.length,
      unsupported: unsupported.length,
      startRoutesGenerated,
      extraRoutesGenerated,
      filesWritten,
      uiCounts,
    }),
  );
}

main();
