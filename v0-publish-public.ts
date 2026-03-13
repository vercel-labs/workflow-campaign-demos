#!/usr/bin/env bun
/**
 * Publish demos to v0 via GitHub repo import with public shareable URLs.
 *
 * Usage:
 *   bun run v0-publish-public.ts                    # all demos
 *   bun run v0-publish-public.ts fan-out saga       # specific demos
 *   bun run v0-publish-public.ts --dry-run          # preview only
 *
 * Requires V0_API_KEY in environment.
 */

import { createClient } from "v0-sdk";
import { readdirSync, statSync } from "fs";
import { join } from "path";
import { parseArgs } from "util";

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    "dry-run": { type: "boolean", default: false },
    yes: { type: "boolean", short: "y", default: false },
  },
  allowPositionals: true,
});

const PROJECT_ROOT = import.meta.dir;
const REPO_ORG = "vercel-labs";

// Discover demos: directories containing a package.json
function discoverDemos(): string[] {
  return readdirSync(PROJECT_ROOT)
    .filter((name) => {
      if (name.startsWith(".")) return false;
      const dir = join(PROJECT_ROOT, name);
      try {
        statSync(join(dir, "package.json"));
        return true;
      } catch {
        return false;
      }
    })
    .sort();
}

// Resolve which demos to publish
const allDemos = discoverDemos();
const requested = positionals.filter((p) => !p.startsWith("-"));
const demos =
  requested.length > 0
    ? requested.filter((d) => {
        const slug = d.replace(/\/$/, "");
        if (!allDemos.includes(slug)) {
          console.error(`Unknown demo: ${slug} (not found in ${PROJECT_ROOT})`);
          return false;
        }
        return true;
      })
    : allDemos;

if (demos.length === 0) {
  console.error("No demos to publish.");
  process.exit(1);
}

// Pretty name from slug
function prettyName(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Dry run: just list what would be published
console.log(`\nDemos to publish (${demos.length}):\n`);
for (const slug of demos) {
  const repoUrl = `https://github.com/${REPO_ORG}/workflow-${slug}`;
  console.log(`  ${slug} → ${repoUrl}`);
}

if (values["dry-run"]) {
  console.log("\n(dry-run — nothing published)");
  process.exit(0);
}

// Confirm
if (!values.yes) {
  process.stdout.write(`\nPublish ${demos.length} demos as public v0 chats? [y/N] `);
  const response = await new Promise<string>((resolve) => {
    process.stdin.once("data", (data) => resolve(data.toString().trim()));
  });
  if (response.toLowerCase() !== "y") {
    console.log("Aborted.");
    process.exit(0);
  }
}

// Publish
const apiKey = process.env.V0_API_KEY;
if (!apiKey) {
  console.error("V0_API_KEY not set. Export it or use: with_v0 bun run v0-publish-public.ts");
  process.exit(1);
}

const client = createClient({ apiKey });

const results: { slug: string; url: string; chatId: string }[] = [];
const errors: { slug: string; error: string }[] = [];

for (const slug of demos) {
  const repoUrl = `https://github.com/${REPO_ORG}/workflow-${slug}`;
  const name = `${prettyName(slug)} – Workflow DevKit`;

  process.stdout.write(`Publishing ${slug}...`);

  try {
    const chat = await client.chats.init({
      type: "repo",
      repo: { url: repoUrl },
      chatPrivacy: "public",
      name,
    });

    results.push({ slug, url: chat.webUrl, chatId: chat.id });
    console.log(` ✓ ${chat.webUrl}`);
  } catch (e: any) {
    const msg = e.message || JSON.stringify(e);
    errors.push({ slug, error: msg });
    console.log(` ✗ ${msg}`);
  }
}

// Summary
console.log("\n=== Results ===\n");

if (results.length > 0) {
  console.log("Published:");
  const maxSlug = Math.max(...results.map((r) => r.slug.length));
  for (const r of results) {
    console.log(`  ${r.slug.padEnd(maxSlug)}  ${r.url}`);
  }
}

if (errors.length > 0) {
  console.log("\nFailed:");
  for (const e of errors) {
    console.log(`  ${e.slug}: ${e.error}`);
  }
}

console.log(`\n${results.length} published, ${errors.length} failed.`);
