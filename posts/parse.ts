/**
 * Parse a post markdown file into structured data ready for Typefully or similar APIs.
 *
 * Usage:
 *   bun posts/parse.ts posts/saga.md
 *   bun posts/parse.ts posts/saga.md --variant B
 *   bun posts/parse.ts posts/*.md --json
 */

import { readFileSync } from "fs";

export interface PostThread {
  variant: string;
  label: string;
  posts: string[];
}

export interface ParsedPost {
  slug: string;
  day: number | null;
  status: string;
  v0_url: string;
  primitive: string;
  pick: string | null;
  title: string;
  summary: string;
  threads: PostThread[];
}

export function parsePostFile(filePath: string): ParsedPost {
  const raw = readFileSync(filePath, "utf-8");

  // Extract YAML frontmatter
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) throw new Error(`No frontmatter in ${filePath}`);

  const fm: Record<string, string> = {};
  for (const line of fmMatch[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    fm[key] = val === "null" ? "" : val;
  }

  const body = raw.slice(fmMatch[0].length).trim();

  // Extract title from # heading
  const titleMatch = body.match(/^# (.+)/m);
  const title = titleMatch?.[1] ?? fm.slug;

  // Extract summary (text between # title and first ## Variant)
  const summaryMatch = body.match(/^# .+\n\n([\s\S]*?)(?=\n## Variant)/);
  const summary = summaryMatch?.[1]?.trim() ?? "";

  // Split into variants on ## Variant headings
  const variantBlocks = body.split(/\n(?=## Variant )/);
  const threads: PostThread[] = [];

  for (const block of variantBlocks) {
    const headerMatch = block.match(/^## Variant ([A-Z]) — "(.+?)"/);
    if (!headerMatch) continue;

    const [, variant, label] = headerMatch;
    const content = block.slice(block.indexOf("\n") + 1).trim();

    // Split posts on <!-- split --> delimiter
    const posts = content
      .split(/<!--\s*split\s*-->/)
      .map((p) => p.trim())
      .filter(Boolean);

    threads.push({ variant, label, posts });
  }

  return {
    slug: fm.slug,
    day: fm.day ? parseInt(fm.day) : null,
    status: fm.status || "draft",
    v0_url: fm.v0_url,
    primitive: fm.primitive,
    pick: fm.pick || null,
    title,
    summary,
    threads,
  };
}

// CLI usage
if (import.meta.main) {
  const args = process.argv.slice(2);
  const jsonFlag = args.includes("--json");
  const variantFlag = args.indexOf("--variant");
  const variantFilter =
    variantFlag !== -1 ? args[variantFlag + 1]?.toUpperCase() : null;
  const files = args.filter((a) => !a.startsWith("--") && a.endsWith(".md"));

  for (const file of files) {
    const parsed = parsePostFile(file);

    if (jsonFlag) {
      console.log(JSON.stringify(parsed, null, 2));
      continue;
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(`${parsed.title} [${parsed.status}]`);
    console.log(`Primitive: ${parsed.primitive}`);
    console.log(`${"=".repeat(60)}`);

    for (const thread of parsed.threads) {
      if (variantFilter && thread.variant !== variantFilter) continue;

      console.log(`\n--- Variant ${thread.variant}: "${thread.label}" ---`);
      thread.posts.forEach((post, i) => {
        console.log(`\n  [Post ${i + 1}]`);
        console.log(
          `  ${post
            .split("\n")
            .map((l) => `  ${l}`)
            .join("\n")}`
        );
      });
    }
  }
}
