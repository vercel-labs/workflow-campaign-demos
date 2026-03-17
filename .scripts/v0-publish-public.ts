#!/usr/bin/env bun
/**
 * Publish demos to v0 via GitHub repo import with public shareable URLs.
 *
 * Usage:
 *   bun .scripts/v0-publish-public.ts                    # all demos
 *   bun .scripts/v0-publish-public.ts fan-out saga       # specific demos
 *   bun .scripts/v0-publish-public.ts --dry-run          # preview only
 *   bun .scripts/v0-publish-public.ts --skip-sync-check  # skip subtree sync verification
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
    "skip-sync-check": { type: "boolean", default: false },
  },
  allowPositionals: true,
});

const PROJECT_ROOT = join(import.meta.dir, "..");
const REPO_ORG = "vercel-labs";

// --- Subtree sync check ---------------------------------------------------

function run(cmd: string[]): { ok: boolean; stdout: string; stderr: string } {
  const proc = Bun.spawnSync(cmd, { cwd: PROJECT_ROOT, env: process.env });
  return {
    ok: proc.exitCode === 0,
    stdout: proc.stdout.toString().trim(),
    stderr: proc.stderr.toString().trim(),
  };
}

function hasRemote(slug: string): boolean {
  return run(["git", "remote", "get-url", `workflow-${slug}`]).ok;
}

/**
 * Check if the local subtree for a demo is in sync with its remote repo.
 * Fetches the remote, splits the local subtree, and compares SHAs.
 */
function isSubtreeSynced(slug: string): { synced: boolean; reason: string } {
  const remote = `workflow-${slug}`;

  if (!hasRemote(slug)) {
    return { synced: false, reason: `no remote ${remote} configured` };
  }

  // Fetch latest from the remote
  const fetch = run(["git", "fetch", remote, "main"]);
  if (!fetch.ok) {
    return { synced: false, reason: `failed to fetch ${remote}: ${fetch.stderr}` };
  }

  // Get the remote HEAD SHA
  const remoteHead = run(["git", "rev-parse", `${remote}/main`]);
  if (!remoteHead.ok) {
    return { synced: false, reason: `no ${remote}/main branch found` };
  }

  // Split the local subtree to get its synthetic commit SHA
  const split = run(["git", "subtree", "split", `--prefix=${slug}`]);
  if (!split.ok) {
    return { synced: false, reason: `subtree split failed: ${split.stderr}` };
  }

  if (split.stdout !== remoteHead.stdout) {
    return {
      synced: false,
      reason: `local subtree is ahead of ${remote}/main — run: bun .scripts/sync.ts push-one`,
    };
  }

  return { synced: true, reason: "up to date" };
}

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

// Check subtree sync status
if (!values["skip-sync-check"]) {
  console.log("\nChecking subtree sync status...\n");
  const outOfSync: string[] = [];
  for (const slug of demos) {
    const { synced, reason } = isSubtreeSynced(slug);
    if (synced) {
      console.log(`  \x1b[32m✓\x1b[0m ${slug}`);
    } else {
      console.log(`  \x1b[31m✗\x1b[0m ${slug} — ${reason}`);
      outOfSync.push(slug);
    }
  }

  if (outOfSync.length > 0) {
    console.error(
      `\n${outOfSync.length} demo(s) not synced to their remote repos. Push subtrees first:\n` +
      `  bun .scripts/sync.ts push\n\n` +
      `Or skip this check with --skip-sync-check`
    );
    process.exit(1);
  }
  console.log("");
}

// Publish
const apiKey = process.env.V0_API_KEY;
if (!apiKey) {
  console.error("V0_API_KEY not set. Export it or use: with_v0 bun .scripts/v0-publish-public.ts");
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
