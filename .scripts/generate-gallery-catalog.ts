#!/usr/bin/env bun
/**
 * generate-gallery-catalog.ts
 *
 * Discovers demos via filesystem scan, enriches with README.md metadata when
 * available, and audits each demo directory to produce a deterministic
 * lib/demos.generated.json catalog.
 *
 * A directory is considered a demo if it contains both package.json and a
 * workflows/ directory. Adding a new demo directory that matches this
 * convention is sufficient — no README edit required for discovery.
 *
 * Usage:
 *   bun .scripts/generate-gallery-catalog.ts
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { writeFileSync } from "fs";
import { join, relative } from "path";
import type { DemoCatalogEntry, SourceMode } from "../lib/demos";

const ROOT = join(import.meta.dir, "..");

// ---------------------------------------------------------------------------
// Structured logging
// ---------------------------------------------------------------------------
function log(level: "info" | "warn" | "error", msg: string, data?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), level, msg, ...data };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

// ---------------------------------------------------------------------------
// Filesystem discovery
// ---------------------------------------------------------------------------
type ReadmeRow = {
  slug: string;
  title: string;
  description: string;
  whenToUse: string;
  reviewedBy: string;
};

/**
 * Scan ROOT for directories containing both package.json and workflows/.
 * Returns sorted slug list.
 */
function discoverDemos(): string[] {
  const slugs: string[] = [];
  for (const entry of readdirSync(ROOT)) {
    if (entry.startsWith(".") || entry.startsWith("_")) continue;
    const dir = join(ROOT, entry);
    if (!statSync(dir).isDirectory()) continue;
    if (
      existsSync(join(dir, "package.json")) &&
      existsSync(join(dir, "workflows")) &&
      statSync(join(dir, "workflows")).isDirectory()
    ) {
      slugs.push(entry);
    }
  }
  return slugs.sort();
}

/** Slug → title case: "fan-out" → "Fan-Out" */
function slugToTitle(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("-")
    .replace(/(^|[\s-])([a-z])/g, (_m, sep, c) => sep + c.toUpperCase());
}

// ---------------------------------------------------------------------------
// README parsing (enrichment source, not discovery source)
// ---------------------------------------------------------------------------
function parseReadme(): Map<string, ReadmeRow> {
  const readme = readFileSync(join(ROOT, "README.md"), "utf-8");

  // Parse markdown table rows
  // Format: | **`slug`** | description | when to use | reviewed by |
  const tableRowRe =
    /^\|\s*\*\*`([^`]+)`\*\*\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|$/gm;
  const rows = new Map<string, ReadmeRow>();

  let match: RegExpExecArray | null;
  while ((match = tableRowRe.exec(readme)) !== null) {
    const slug = match[1].trim();
    rows.set(slug, {
      slug,
      title: slugToTitle(slug),
      description: match[2].trim(),
      whenToUse: match[3].trim(),
      reviewedBy: match[4].trim(),
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Taxonomy tagging
// ---------------------------------------------------------------------------
const TAG_RULES: Array<{ tags: string[]; slugs?: string[]; keywords?: RegExp }> = [
  // Messaging patterns
  {
    tags: ["messaging"],
    slugs: [
      "aggregator", "content-based-router", "content-enricher", "claim-check",
      "dead-letter-queue", "message-filter", "message-history", "message-translator",
      "normalizer", "publish-subscribe", "recipient-list", "resequencer",
      "routing-slip", "splitter", "wire-tap", "correlation-identifier",
      "namespaced-streams",
    ],
  },
  // Orchestration
  {
    tags: ["orchestration"],
    slugs: [
      "saga", "choreography", "process-manager", "pipeline", "fan-out",
      "scatter-gather", "map-reduce", "approval-chain", "approval-gate",
      "scheduler-agent-supervisor",
    ],
  },
  // Resilience
  {
    tags: ["resilience"],
    slugs: [
      "circuit-breaker", "retry-backoff", "retryable-rate-limit", "bulkhead",
      "dead-letter-queue", "guaranteed-delivery", "hedge-request",
      "idempotent-receiver", "transactional-outbox",
    ],
  },
  // Scheduling & time
  {
    tags: ["scheduling"],
    slugs: [
      "scheduled-digest", "wakeable-reminder", "onboarding-drip", "status-poller",
      "batch-processor", "throttle",
    ],
  },
  // Human-in-the-loop
  {
    tags: ["human-in-the-loop"],
    slugs: ["approval-chain", "approval-gate", "cancellable-export"],
  },
  // Data processing
  {
    tags: ["data-processing"],
    slugs: [
      "map-reduce", "batch-processor", "pipeline", "splitter", "aggregator",
      "normalizer", "content-enricher",
    ],
  },
  // Integration
  {
    tags: ["integration"],
    slugs: [
      "webhook-basics", "event-gateway", "async-request-reply", "request-reply",
      "claim-check",
    ],
  },
  // Async patterns
  {
    tags: ["async"],
    slugs: [
      "async-request-reply", "request-reply", "competing-consumers",
      "priority-queue", "fan-out", "scatter-gather",
    ],
  },
  // Observability
  {
    tags: ["observability"],
    slugs: ["wire-tap", "event-sourcing", "message-history", "correlation-identifier"],
  },
  // Routing
  {
    tags: ["routing"],
    slugs: [
      "content-based-router", "detour", "routing-slip", "recipient-list",
      "message-filter",
    ],
  },
];

function assignTags(slug: string): string[] {
  const tags = new Set<string>();
  for (const rule of TAG_RULES) {
    if (rule.slugs?.includes(slug)) {
      for (const t of rule.tags) tags.add(t);
    }
    if (rule.keywords?.test(slug)) {
      for (const t of rule.tags) tags.add(t);
    }
  }
  return [...tags].sort();
}

// ---------------------------------------------------------------------------
// Directory audit
// ---------------------------------------------------------------------------
function collectFiles(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  function walk(d: string) {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (pattern.test(entry)) {
        results.push(relative(ROOT, full));
      }
    }
  }
  walk(dir);
  return results.sort();
}

function detectSourceMode(slug: string): SourceMode {
  const pagePath = join(ROOT, slug, "app/page.tsx");
  if (!existsSync(pagePath)) return "unknown";

  const page = readFileSync(pagePath, "utf-8");
  const usesReadFile = /readFileSync/.test(page);
  const usesInlineCode =
    // Multiline template strings assigned to code-related variables
    /(?:const|let)\s+\w*(?:code|source|snippet)\w*\s*=\s*`/i.test(page) ||
    // String literals that look like TypeScript/JS code blocks
    /(?:const|let)\s+\w*(?:code|source|snippet)\w*\s*=\s*["']/i.test(page);

  if (usesReadFile && usesInlineCode) return "mixed";
  if (usesReadFile) return "filesystem";
  if (usesInlineCode) return "inline-page-string";
  return "unknown";
}

function detectExtraRoutes(slug: string, standardRoutes: string[]): string[] {
  const apiDir = join(ROOT, slug, "app/api");
  const allRoutes = collectFiles(apiDir, /^route\.ts$/);

  // Standard routes: {slug}/route.ts and readable/[runId]/route.ts
  const standardPatterns = [
    new RegExp(`app/api/${slug}/route\\.ts$`),
    /app\/api\/readable\/\[runId\]\/route\.ts$/,
  ];

  return allRoutes.filter((r) => !standardPatterns.some((p) => p.test(r)));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  log("info", "starting catalog generation");

  // 1. Filesystem-first discovery
  const discoveredSlugs = discoverDemos();
  log("info", "discovered demos on filesystem", { count: discoveredSlugs.length });

  // 2. README enrichment (optional metadata)
  const readmeRows = parseReadme();
  log("info", "parsed README", { rowCount: readmeRows.size });

  // Log mismatches (informational, not fatal)
  const fsSet = new Set(discoveredSlugs);
  for (const slug of readmeRows.keys()) {
    if (!fsSet.has(slug)) {
      log("warn", "README entry has no matching directory on filesystem", { slug });
    }
  }
  for (const slug of discoveredSlugs) {
    if (!readmeRows.has(slug)) {
      log("warn", "demo discovered on filesystem but missing from README — using defaults", { slug });
    }
  }

  // 3. Build catalog from discovered demos, enriched with README metadata
  const catalog: DemoCatalogEntry[] = [];

  for (const slug of discoveredSlugs) {
    const demoDir = join(ROOT, slug);
    const readme = readmeRows.get(slug);

    const workflowFiles = collectFiles(join(demoDir, "workflows"), /\.ts$/).filter(
      (f) => !f.endsWith(".test.ts")
    );

    const apiRoutes = collectFiles(join(demoDir, "app/api"), /^route\.ts$/);
    const extraRoutes = detectExtraRoutes(slug, apiRoutes);
    const sourceMode = detectSourceMode(slug);
    const tags = assignTags(slug);

    const entry: DemoCatalogEntry = {
      slug,
      title: readme?.title ?? slugToTitle(slug),
      description: readme?.description ?? "",
      whenToUse: readme?.whenToUse ?? "",
      reviewedBy: readme?.reviewedBy ?? "",
      tags,
      sourceMode,
      workflowFiles,
      apiRoutes,
      extraRoutes,
    };

    catalog.push(entry);
    log("info", "audited demo", {
      slug,
      sourceMode,
      workflowFiles: workflowFiles.length,
      apiRoutes: apiRoutes.length,
      extraRoutes: extraRoutes.length,
      tags: tags.length,
      hasReadmeEntry: !!readme,
    });
  }

  // Sort deterministically by slug
  catalog.sort((a, b) => a.slug.localeCompare(b.slug));

  const outPath = join(ROOT, "lib/demos.generated.json");
  writeFileSync(outPath, JSON.stringify(catalog, null, 2) + "\n");
  log("info", "wrote catalog", { path: outPath, entries: catalog.length });

  // Summary output for programmatic consumers
  const summary = {
    total: catalog.length,
    bySourceMode: {
      filesystem: catalog.filter((d) => d.sourceMode === "filesystem").length,
      "inline-page-string": catalog.filter((d) => d.sourceMode === "inline-page-string").length,
      mixed: catalog.filter((d) => d.sourceMode === "mixed").length,
      unknown: catalog.filter((d) => d.sourceMode === "unknown").length,
    },
    withExtraRoutes: catalog.filter((d) => d.extraRoutes.length > 0).map((d) => d.slug),
  };
  log("info", "catalog summary", summary);
}

main();
