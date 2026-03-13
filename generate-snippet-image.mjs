#!/usr/bin/env node
/**
 * Generate a ray.so code snippet image from a demo's README.
 *
 * Usage:
 *   node generate-snippet-image.mjs fan-out
 *   node generate-snippet-image.mjs fan-out saga bulkhead
 *   node generate-snippet-image.mjs --all
 *
 * Reads the first ```-fenced code block from each demo's README.md,
 * sends it to ray.so with the Vercel theme, and saves the PNG next to the README.
 *
 * Settings (matching screenshot):
 *   Theme: vercel, Background: true, Dark mode: true,
 *   Line numbers: false, Padding: 16, Language: tsx (auto)
 */

import puppeteer from "puppeteer";
import { readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = new URL(".", import.meta.url).pathname;

// --- Parse args ---
const args = process.argv.slice(2);
const doAll = args.includes("--all");
const slugs = args.filter((a) => !a.startsWith("-"));

function discoverDemos() {
  return readdirSync(PROJECT_ROOT)
    .filter((name) => {
      if (name.startsWith(".")) return false;
      try {
        statSync(join(PROJECT_ROOT, name, "package.json"));
        return true;
      } catch {
        return false;
      }
    })
    .sort();
}

const demos = doAll ? discoverDemos() : slugs;
if (demos.length === 0) {
  console.error("Usage: node generate-snippet-image.mjs <demo>... | --all");
  process.exit(1);
}

// --- Extract first ts/tsx code block from a markdown file ---
function extractCodeBlock(mdPath) {
  const content = readFileSync(mdPath, "utf-8");
  // Prefer ts/tsx fenced blocks, fall back to any fenced block
  const tsMatch = content.match(/```(?:ts|tsx|typescript)\n([\s\S]*?)```/);
  if (tsMatch) return tsMatch[1].trimEnd();
  const anyMatch = content.match(/```[^\n]*\n([\s\S]*?)```/);
  if (anyMatch) return anyMatch[1].trimEnd();
  return null;
}

// --- Pretty title from slug ---
function prettyTitle(slug) {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- Build ray.so URL ---
function buildRayUrl(code, title) {
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
  // ray.so uses hash fragment, not query string
  return `https://ray.so/#${params}`;
}

// --- Generate image ---
async function generateImage(slug) {
  const postPath = join(PROJECT_ROOT, "posts", `${slug}.md`);
  const readmePath = join(PROJECT_ROOT, slug, "README.md");
  // Prefer the post file (has curated TS snippets), fall back to README
  let mdPath;
  try {
    statSync(postPath);
    mdPath = postPath;
  } catch {
    mdPath = readmePath;
  }
  const code = extractCodeBlock(mdPath);
  if (!code) {
    console.log(`  ${slug}: no code block found in README.md, skipping`);
    return null;
  }

  const title = prettyTitle(slug);
  const url = buildRayUrl(code, title);
  const outPath = join(PROJECT_ROOT, "posts", `${slug}.png`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 8192, height: 2048, deviceScaleFactor: 2 });
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Wait for render to settle
    await new Promise((r) => setTimeout(r, 3000));

    // Hide UI controls — try multiple selectors for different ray.so versions
    await page.evaluate(() => {
      const hide = (sel) => {
        const el = document.querySelector(sel);
        if (el) el.style.display = "none";
      };
      // Old selectors
      hide("#frame > div.drag-control-points > div.handle.left");
      hide("#frame > div.drag-control-points > div.handle.right");
      hide("#app > main > section");
      // New selectors — hide anything that's not the code frame
      for (const el of document.querySelectorAll("nav, footer, header, [class*='controls'], [class*='toolbar'], [class*='sidebar']")) {
        el.style.display = "none";
      }
    });

    // Try #frame first, fall back to other selectors
    let frame = await page.$("#frame");
    if (!frame) frame = await page.$("div[class*='frame']");
    if (!frame) frame = await page.$("main > div");
    if (!frame) throw new Error("Could not find frame element");

    const buf = await frame.screenshot({ omitBackground: true });
    writeFileSync(outPath, buf);
    console.log(`  ${slug}: ${outPath}`);
    return outPath;
  } finally {
    await browser.close();
  }
}

// --- Main ---
console.log(`Generating snippet images for ${demos.length} demo(s)...\n`);

let success = 0;
let failed = 0;

for (const slug of demos) {
  try {
    const result = await generateImage(slug);
    if (result) success++;
  } catch (err) {
    console.log(`  ${slug}: FAILED - ${err.message}`);
    failed++;
  }
}

console.log(`\nDone: ${success} generated, ${failed} failed.`);
