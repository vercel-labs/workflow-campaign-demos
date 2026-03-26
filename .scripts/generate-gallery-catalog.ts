#!/usr/bin/env bun
/**
 * generate-gallery-catalog.ts
 *
 * Parses the README.md demo table and audits each demo directory to produce
 * a deterministic lib/demos.generated.json catalog.
 *
 * Usage:
 *   bun .scripts/generate-gallery-catalog.ts
 *
 * Exits non-zero when the README intro count and parsed table row count disagree.
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
// README parsing
// ---------------------------------------------------------------------------
function parseReadme(): {
  introCount: number;
  rows: Array<{
    slug: string;
    title: string;
    description: string;
    whenToUse: string;
    reviewedBy: string;
  }>;
} {
  const readme = readFileSync(join(ROOT, "README.md"), "utf-8");

  // Extract the intro count: "48 standalone Next.js apps" or similar
  const introMatch = readme.match(/(\d+)\s+standalone\s+Next\.js\s+app/i);
  const introCount = introMatch ? parseInt(introMatch[1], 10) : -1;

  // Parse markdown table rows
  // Format: | **`slug`** | description | when to use | reviewed by |
  const tableRowRe =
    /^\|\s*\*\*`([^`]+)`\*\*\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|$/gm;
  const rows: Array<{
    slug: string;
    title: string;
    description: string;
    whenToUse: string;
    reviewedBy: string;
  }> = [];

  let match: RegExpExecArray | null;
  while ((match = tableRowRe.exec(readme)) !== null) {
    const slug = match[1].trim();
    const description = match[2].trim();
    const whenToUse = match[3].trim();
    const reviewedBy = match[4].trim();

    // Title: slug to title case (e.g., "fan-out" → "Fan-Out")
    const title = slug
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join("-")
      // Capitalize after spaces too
      .replace(/(^|[\s-])([a-z])/g, (_m, sep, c) => sep + c.toUpperCase());

    rows.push({ slug, title, description, whenToUse, reviewedBy });
  }

  return { introCount, rows };
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

  const { introCount, rows } = parseReadme();
  log("info", "parsed README", { introCount, rowCount: rows.length });

  // Count mismatch check
  if (introCount !== -1 && introCount !== rows.length) {
    log("error", "README intro count disagrees with parsed table row count", {
      introCount,
      rowCount: rows.length,
    });
    process.exit(1);
  }

  const catalog: DemoCatalogEntry[] = [];

  for (const row of rows) {
    const { slug } = row;
    const demoDir = join(ROOT, slug);
    const dirExists = existsSync(demoDir);

    const workflowFiles = dirExists
      ? collectFiles(join(demoDir, "workflows"), /\.ts$/).filter(
          (f) => !f.endsWith(".test.ts")
        )
      : [];

    const apiRoutes = dirExists
      ? collectFiles(join(demoDir, "app/api"), /^route\.ts$/)
      : [];

    const extraRoutes = dirExists ? detectExtraRoutes(slug, apiRoutes) : [];
    const sourceMode = dirExists ? detectSourceMode(slug) : "unknown";
    const tags = assignTags(slug);

    const entry: DemoCatalogEntry = {
      slug,
      title: row.title,
      description: row.description,
      whenToUse: row.whenToUse,
      reviewedBy: row.reviewedBy,
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
