#!/usr/bin/env bun
/**
 * Parse posts/<slug>.md into X thread drafts and publish to Typefully.
 *
 * Usage:
 *   bun .scripts/typefully-publish.ts fan-out --validate       # validate only
 *   bun .scripts/typefully-publish.ts fan-out --variant A       # one variant
 *   bun .scripts/typefully-publish.ts fan-out                   # all variants
 *   bun .scripts/typefully-publish.ts --all --variant A         # all posts, variant A
 */

import { readFileSync, existsSync, readdirSync, writeFileSync } from "fs";
import { join, basename } from "path";
import { parseArgs } from "util";
import puppeteer from "puppeteer";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    validate: { type: "boolean", default: false },
    variant: { type: "string" },
    all: { type: "boolean", default: false },
  },
  allowPositionals: true,
});

const PROJECT_ROOT = join(import.meta.dir, "..");
const POSTS_DIR = join(PROJECT_ROOT, "posts");
const SOCIAL_SET_ID = 289983;
const X_CHAR_LIMIT = 280;
const X_URL_LENGTH = 23; // t.co wrapping

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

function getEnvVar(name: string): string {
  const envPath = join(PROJECT_ROOT, ".env.local");
  if (!existsSync(envPath)) {
    console.error(".env.local not found");
    process.exit(1);
  }
  const content = readFileSync(envPath, "utf-8");
  const match = content.match(new RegExp(`^${name}=(.+)$`, "m"));
  if (!match) {
    console.error(`${name} not found in .env.local`);
    process.exit(1);
  }
  return match[1].trim();
}

function getApiKey(): string {
  return getEnvVar("TYPEFULLY_API_KEY");
}

// ---------------------------------------------------------------------------
// v0 Publish (shells out to v0-publish-public.ts)
// ---------------------------------------------------------------------------

async function publishToV0(slug: string): Promise<string> {
  const scriptPath = join(import.meta.dir, "v0-publish-public.ts");
  const proc = Bun.spawn(["bun", "run", scriptPath, slug, "-y"], {
    cwd: PROJECT_ROOT,
    env: { ...process.env },
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    throw new Error(stderr || stdout || `v0-publish-public.ts exited with ${exitCode}`);
  }

  // Parse the URL from output like "  fan-out  https://v0.app/chat/abc123"
  const urlMatch = stdout.match(/https:\/\/v0\.app\/chat\/\S+/);
  if (!urlMatch) {
    throw new Error(`Could not find v0 URL in output:\n${stdout}`);
  }

  return urlMatch[0];
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

interface Frontmatter {
  slug: string;
  v0_url: string;
  primitive: string;
}

interface Tweet {
  text: string;
  hasImage: boolean;
}

interface Variant {
  label: string; // "A", "B", "C"
  title: string; // e.g. "Four channels, zero coordination"
  tweets: Tweet[];
}

interface ParsedPost {
  frontmatter: Frontmatter;
  variants: Variant[];
}

function parseFrontmatter(raw: string): Frontmatter {
  const fm: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (m) fm[m[1]] = m[2].trim();
  }
  return {
    slug: fm.slug || "",
    v0_url: fm.v0_url || "",
    primitive: fm.primitive || "",
  };
}

function stripMarkdownFormatting(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
    .replace(/\*([^*]+)\*/g, "$1") // italic
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links (keep text)
    .trim();
}

function parsePost(slug: string, v0UrlOverride?: string): ParsedPost {
  const filePath = join(POSTS_DIR, `${slug}.md`);
  if (!existsSync(filePath)) {
    console.error(`Post not found: ${filePath}`);
    process.exit(1);
  }

  const raw = readFileSync(filePath, "utf-8");

  // Extract frontmatter
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    console.error(`No frontmatter in ${filePath}`);
    process.exit(1);
  }
  const frontmatter = parseFrontmatter(fmMatch[1]);
  if (v0UrlOverride) frontmatter.v0_url = v0UrlOverride;

  // Split into variants
  const body = raw.slice(fmMatch[0].length);
  const variantSections = body.split(/^## Variant ([A-C]) — "([^"]+)"/m);
  // variantSections: [preamble, "A", "title A", content A, "B", "title B", content B, ...]

  const variants: Variant[] = [];
  for (let i = 1; i < variantSections.length; i += 3) {
    const label = variantSections[i];
    const title = variantSections[i + 1];
    const content = variantSections[i + 2];

    // Split on <!-- split --> to get tweet chunks
    const chunks = content.split(/<!--\s*split\s*-->/).map((c) => c.trim());
    if (chunks.length < 3) {
      console.error(
        `Variant ${label} in ${slug}: expected 3+ chunks from <!-- split -->, got ${chunks.length}`
      );
      process.exit(1);
    }

    const tweets: Tweet[] = [];

    // Tweet 1: text before code block (strip the code block itself, image handles it)
    let tweet1Text = chunks[0]
      .replace(/```[\s\S]*?```/g, "") // remove code blocks
      .replace(/^\d+ Days of Workflow DevKit.*$/m, (m) => m) // keep the header line
      .trim();
    tweet1Text = stripMarkdownFormatting(tweet1Text);
    // Replace v0_link placeholder
    tweet1Text = tweet1Text.replace(/\{v0_link\}/g, frontmatter.v0_url);
    tweets.push({ text: tweet1Text, hasImage: true });

    // Tweets 2+: remaining chunks
    for (let j = 1; j < chunks.length; j++) {
      let text = chunks[j]
        .replace(/```[\s\S]*?```/g, "") // remove any code blocks
        .trim();
      text = stripMarkdownFormatting(text);
      text = text.replace(/\{v0_link\}/g, frontmatter.v0_url);
      if (text.length > 0) {
        tweets.push({ text, hasImage: false });
      }
    }

    variants.push({ label, title, tweets });
  }

  return { frontmatter, variants };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function tweetLength(text: string): number {
  // URLs are wrapped to 23 chars by t.co
  const urlRegex = /https?:\/\/\S+/g;
  let adjusted = text;
  const urls = text.match(urlRegex) || [];
  for (const url of urls) {
    adjusted = adjusted.replace(url, "x".repeat(X_URL_LENGTH));
  }
  return adjusted.length;
}

function validateVariant(
  slug: string,
  variant: Variant
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (let i = 0; i < variant.tweets.length; i++) {
    const tweet = variant.tweets[i];
    const len = tweetLength(tweet.text);
    if (len > X_CHAR_LIMIT) {
      errors.push(
        `  ${slug} Variant ${variant.label} Tweet ${i + 1}: ${len} chars (${len - X_CHAR_LIMIT} over)\n` +
          `  Text: "${tweet.text.slice(0, 100)}..."`
      );
    }
  }
  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Ray.so Code Snippet Image Generation
// ---------------------------------------------------------------------------

function extractCodeBlock(mdPath: string): string | null {
  const content = readFileSync(mdPath, "utf-8");
  const tsMatch = content.match(/```(?:ts|tsx|typescript)\n([\s\S]*?)```/);
  if (tsMatch) return tsMatch[1].trimEnd();
  const anyMatch = content.match(/```[^\n]*\n([\s\S]*?)```/);
  if (anyMatch) return anyMatch[1].trimEnd();
  return null;
}

function buildRayUrl(code: string, title: string): string {
  const encoded = Buffer.from(code).toString("base64");
  const params = new URLSearchParams({
    title,
    theme: "vercel",
    spacing: "16",
    background: "true",
    darkMode: "true",
    code: encoded,
    language: "typescript",
    lineNumbers: "false",
  });
  return `https://ray.so/#${params}`;
}

async function generateSnippetImage(slug: string): Promise<string | null> {
  const postPath = join(POSTS_DIR, `${slug}.md`);
  const code = extractCodeBlock(postPath);
  if (!code) {
    console.log(`  ${slug}: no code block found, skipping image`);
    return null;
  }

  const prettyName = slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase());
  const url = buildRayUrl(code, prettyName);
  const outPath = join(POSTS_DIR, `${slug}.png`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 8192, height: 2048, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    await new Promise((r) => setTimeout(r, 3000));

    await page.evaluate(() => {
      const hide = (sel: string) => {
        const el = document.querySelector(sel);
        if (el) (el as HTMLElement).style.display = "none";
      };
      hide("#frame > div.drag-control-points > div.handle.left");
      hide("#frame > div.drag-control-points > div.handle.right");
      hide("#app > main > section");
      for (const el of document.querySelectorAll(
        "nav, footer, header, [class*='controls'], [class*='toolbar'], [class*='sidebar']"
      )) {
        (el as HTMLElement).style.display = "none";
      }
    });

    let frame = await page.$("#frame");
    if (!frame) frame = await page.$("div[class*='frame']");
    if (!frame) frame = await page.$("main > div");
    if (!frame) throw new Error("Could not find frame element");

    const buf = await frame.screenshot({ omitBackground: true });
    writeFileSync(outPath, buf);
    return outPath;
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------
// Typefully API
// ---------------------------------------------------------------------------

async function typefullyFetch(
  path: string,
  apiKey: string,
  options: RequestInit = {}
): Promise<any> {
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

async function uploadImage(
  slug: string,
  apiKey: string
): Promise<string | null> {
  const imagePath = join(POSTS_DIR, `${slug}.png`);
  if (!existsSync(imagePath)) {
    console.log(`  No image found at posts/${slug}.png, skipping`);
    return null;
  }

  // 1. Get presigned URL
  const upload = await typefullyFetch(
    `/v2/social-sets/${SOCIAL_SET_ID}/media/upload`,
    apiKey,
    {
      method: "POST",
      body: JSON.stringify({ file_name: `${slug}.png` }),
    }
  );

  // 2. Upload to S3
  const imageData = readFileSync(imagePath);
  const putRes = await fetch(upload.upload_url, {
    method: "PUT",
    body: imageData,
  });
  if (!putRes.ok) {
    throw new Error(`S3 upload failed: ${putRes.status}`);
  }

  // 3. Poll until ready
  for (let attempt = 0; attempt < 10; attempt++) {
    const status = await typefullyFetch(
      `/v2/social-sets/${SOCIAL_SET_ID}/media/${upload.media_id}`,
      apiKey
    );
    if (status.status === "ready") return upload.media_id;
    if (status.status === "failed")
      throw new Error(`Media processing failed: ${status.error_reason}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Media processing timed out");
}

async function createDraft(
  variant: Variant,
  slug: string,
  mediaId: string | null,
  apiKey: string
): Promise<{ id: number; url: string; shareUrl: string | null }> {
  const prettyName = slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const posts = variant.tweets.map((tweet, i) => ({
    text: tweet.text,
    ...(i === 0 && mediaId ? { media_ids: [mediaId] } : {}),
  }));

  const draft = await typefullyFetch(
    `/v2/social-sets/${SOCIAL_SET_ID}/drafts`,
    apiKey,
    {
      method: "POST",
      body: JSON.stringify({
        draft_title: `${prettyName} — Variant ${variant.label}`,
        share: true,
        platforms: {
          x: { enabled: true, posts },
        },
      }),
    }
  );

  return { id: draft.id, url: draft.private_url, shareUrl: draft.share_url };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function discoverSlugs(): string[] {
  return readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""))
    .sort();
}

const slugs = values.all
  ? discoverSlugs()
  : positionals.filter((p) => !p.startsWith("-"));

if (slugs.length === 0) {
  console.error(
    "Usage: bun .scripts/typefully-publish.ts <slug>... [--validate] [--variant A|B|C] [--all]"
  );
  process.exit(1);
}

const variantFilter = values.variant?.toUpperCase();
if (variantFilter && !["A", "B", "C"].includes(variantFilter)) {
  console.error("--variant must be A, B, or C");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Step 1: Publish to v0 (unless --validate)
// ---------------------------------------------------------------------------

const v0Urls: Record<string, string> = {};

if (!values.validate) {
  console.log("Publishing to v0...\n");
  for (const slug of slugs) {
    try {
      const url = await publishToV0(slug);
      v0Urls[slug] = url;
      console.log(`  ${slug}: ${url}`);
    } catch (err: any) {
      console.error(`  ${slug}: v0 publish failed: ${err.message}`);
      process.exit(1);
    }
  }
  console.log("");
}

// ---------------------------------------------------------------------------
// Step 2: Generate ray.so code snippet images (unless --validate)
// ---------------------------------------------------------------------------

if (!values.validate) {
  console.log("Generating code snippet images...\n");
  for (const slug of slugs) {
    try {
      const path = await generateSnippetImage(slug);
      if (path) console.log(`  ${slug}: ${path}`);
    } catch (err: any) {
      console.error(`  ${slug}: image generation failed: ${err.message}`);
    }
  }
  console.log("");
}

// ---------------------------------------------------------------------------
// Step 3: Parse posts (using public v0 URLs for {v0_link})
// ---------------------------------------------------------------------------

const allParsed: { slug: string; post: ParsedPost }[] = [];
for (const slug of slugs) {
  allParsed.push({ slug, post: parsePost(slug, v0Urls[slug]) });
}

// ---------------------------------------------------------------------------
// Step 4: Validate tweet lengths
// ---------------------------------------------------------------------------

let allValid = true;
for (const { slug, post } of allParsed) {
  const variantsToCheck = variantFilter
    ? post.variants.filter((v) => v.label === variantFilter)
    : post.variants;

  for (const variant of variantsToCheck) {
    const { valid, errors } = validateVariant(slug, variant);
    if (!valid) {
      allValid = false;
      for (const err of errors) console.error(err);
    }
  }
}

if (!allValid) {
  console.error("\nValidation failed. Fix tweet lengths before publishing.");
  process.exit(1);
}

console.log("Validation passed.");

if (values.validate) {
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Step 5: Upload images + create Typefully drafts
// ---------------------------------------------------------------------------

const apiKey = getApiKey();

for (const { slug, post } of allParsed) {
  const variantsToPublish = variantFilter
    ? post.variants.filter((v) => v.label === variantFilter)
    : post.variants;

  // Upload image once per slug (shared across variants)
  let mediaId: string | null = null;
  console.log(`\n--- ${slug} ---`);
  try {
    mediaId = await uploadImage(slug, apiKey);
    if (mediaId) console.log(`  Image uploaded: ${mediaId}`);
  } catch (err: any) {
    console.error(`  Image upload failed: ${err.message}`);
  }

  for (const variant of variantsToPublish) {
    try {
      const { id, url, shareUrl } = await createDraft(variant, slug, mediaId, apiKey);
      console.log(`  Variant ${variant.label}: ${url}`);
      if (shareUrl) console.log(`    Share: ${shareUrl}`);
    } catch (err: any) {
      console.error(
        `  Variant ${variant.label} failed: ${err.message}`
      );
    }
  }
}
