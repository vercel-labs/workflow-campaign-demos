#!/usr/bin/env bun
/**
 * Delete all unpublished drafts from Typefully.
 *
 * Usage:
 *   bun .scripts/typefully-clear-drafts.ts              # preview what would be deleted
 *   bun .scripts/typefully-clear-drafts.ts --confirm     # actually delete
 *
 * Requires TYPEFULLY_API_KEY in .env.local
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = join(import.meta.dir, "..");
const SOCIAL_SET_ID = 289983;

function getApiKey(): string {
  const envPath = join(PROJECT_ROOT, ".env.local");
  if (!existsSync(envPath)) {
    console.error(".env.local not found");
    process.exit(1);
  }
  const content = readFileSync(envPath, "utf-8");
  const match = content.match(/^TYPEFULLY_API_KEY=(.+)$/m);
  if (!match) {
    console.error("TYPEFULLY_API_KEY not found in .env.local");
    process.exit(1);
  }
  return match[1].trim();
}

async function typefullyFetch(path: string, apiKey: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(`https://api.typefully.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Typefully API ${res.status}: ${body}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function listDrafts(apiKey: string, status: string): Promise<any[]> {
  const all: any[] = [];
  let offset = 0;
  const limit = 50;

  while (true) {
    const params = new URLSearchParams({ status, limit: String(limit), offset: String(offset) });
    const res = await typefullyFetch(
      `/v2/social-sets/${SOCIAL_SET_ID}/drafts?${params}`,
      apiKey
    );
    const items = res.results ?? [];
    if (!Array.isArray(items) || items.length === 0) break;
    all.push(...items);
    if (items.length < limit) break;
    offset += limit;
  }

  return all;
}

// --- Main ---

const confirm = Bun.argv.includes("--confirm");
const apiKey = getApiKey();

console.log("Fetching unpublished drafts...\n");

const drafts = await listDrafts(apiKey, "draft");

if (drafts.length === 0) {
  console.log("No unpublished drafts found.");
  process.exit(0);
}

console.log(`Found ${drafts.length} unpublished draft(s):\n`);
for (const d of drafts) {
  const title = d.draft_title || d.title || "(untitled)";
  const created = d.created_at ? new Date(d.created_at).toLocaleDateString() : "?";
  console.log(`  ${d.id}  ${created}  ${title}`);
}

if (!confirm) {
  console.log(`\nDry run. To delete all ${drafts.length} drafts, run:`);
  console.log("  bun .scripts/typefully-clear-drafts.ts --confirm");
  process.exit(0);
}

console.log(`\nDeleting ${drafts.length} drafts...\n`);

let deleted = 0;
let failed = 0;

for (const d of drafts) {
  const title = d.draft_title || d.title || "(untitled)";
  try {
    await typefullyFetch(
      `/v2/social-sets/${SOCIAL_SET_ID}/drafts/${d.id}`,
      apiKey,
      { method: "DELETE" }
    );
    console.log(`  \x1b[32m✓\x1b[0m ${d.id}  ${title}`);
    deleted++;
  } catch (err: any) {
    console.log(`  \x1b[31m✗\x1b[0m ${d.id}  ${title} — ${err.message}`);
    failed++;
  }
}

console.log(`\nDone. Deleted: ${deleted}  Failed: ${failed}`);
