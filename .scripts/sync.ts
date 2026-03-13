#!/usr/bin/env bun
/**
 * Workflow Subtree Sync — manage git subtree push/pull for all demos.
 *
 * Usage:
 *   bun .scripts/sync.ts                   # interactive menu
 *   bun .scripts/sync.ts sync              # pull + push all
 *   bun .scripts/sync.ts pull              # pull from origin main
 *   bun .scripts/sync.ts push              # push all subtrees
 *   bun .scripts/sync.ts push-one          # pick a single subtree
 *   bun .scripts/sync.ts status            # show remote status
 *   bun .scripts/sync.ts add               # add a new demo
 *   bun .scripts/sync.ts init-new          # create repos for unconfigured demos
 */

import { readdirSync, statSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = join(import.meta.dir, "..");

// Colors
const RED = "\x1b[0;31m";
const GREEN = "\x1b[0;32m";
const YELLOW = "\x1b[0;33m";
const CYAN = "\x1b[0;36m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

const info = (msg: string) => console.log(`${CYAN}▸${RESET} ${msg}`);
const success = (msg: string) => console.log(`${GREEN}✓${RESET} ${msg}`);
const warn = (msg: string) => console.log(`${YELLOW}⚠${RESET} ${msg}`);
const fail = (msg: string) => console.log(`${RED}✗${RESET} ${msg}`);

function getDemos(): string[] {
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

function run(cmd: string[], cwd = PROJECT_ROOT): { ok: boolean; stdout: string; stderr: string } {
  const proc = Bun.spawnSync(cmd, { cwd, env: process.env });
  return {
    ok: proc.exitCode === 0,
    stdout: proc.stdout.toString().trim(),
    stderr: proc.stderr.toString().trim(),
  };
}

function hasRemote(slug: string): boolean {
  return run(["git", "remote", "get-url", `workflow-${slug}`]).ok;
}

function prompt(question: string): string {
  process.stdout.write(question);
  const buf = new Uint8Array(256);
  const n = require("fs").readSync(0, buf);
  return new TextDecoder().decode(buf.slice(0, n)).trim();
}

// --- Commands ----------------------------------------------------------------

function cmdPull() {
  info("Pulling latest from origin main...");
  const result = run(["git", "pull", "origin", "main"]);
  if (result.ok) success("Pull complete.");
  else fail(`Pull failed: ${result.stderr}`);
}

function cmdPush() {
  info("Pushing all subtrees to their individual repos...");
  let count = 0, skipped = 0, failed = 0;

  for (const slug of getDemos()) {
    if (!hasRemote(slug)) {
      warn(`Skipping ${slug} — no remote workflow-${slug}`);
      skipped++;
      continue;
    }
    info(`Pushing ${slug}...`);
    const result = run(["git", "subtree", "push", `--prefix=${slug}`, `workflow-${slug}`, "main"]);
    if (result.ok) {
      success(`${slug} pushed.`);
      count++;
    } else {
      fail(`${slug} failed to push.`);
      failed++;
    }
  }

  console.log("");
  success(`Done. Pushed: ${count}  Skipped: ${skipped}  Failed: ${failed}`);
}

function cmdPushOne() {
  const demos = getDemos();
  if (demos.length === 0) {
    fail("No demos found.");
    process.exit(1);
  }

  console.log("");
  console.log(`${BOLD}Pick a demo to push:${RESET}`);
  demos.forEach((slug, i) => {
    if (hasRemote(slug)) {
      console.log(`  ${GREEN}${String(i + 1).padStart(2)})${RESET} ${slug}`);
    } else {
      console.log(`  ${YELLOW}${String(i + 1).padStart(2)})${RESET} ${slug} ${YELLOW}(no remote)${RESET}`);
    }
  });

  console.log("");
  const choice = parseInt(prompt("Enter number: "), 10);

  if (isNaN(choice) || choice < 1 || choice > demos.length) {
    fail("Invalid choice.");
    process.exit(1);
  }

  const slug = demos[choice - 1];
  if (!hasRemote(slug)) {
    fail(`No remote workflow-${slug} configured. Run 'bun .scripts/sync.ts add' first.`);
    process.exit(1);
  }

  info(`Pushing ${slug}...`);
  const result = run(["git", "subtree", "push", `--prefix=${slug}`, `workflow-${slug}`, "main"]);
  if (result.ok) success(`${slug} pushed.`);
  else fail(`Push failed: ${result.stderr}`);
}

function cmdSync() {
  cmdPull();
  console.log("");
  cmdPush();
}

function cmdStatus() {
  console.log(`\n${BOLD}Demo subtree status:${RESET}\n`);
  let total = 0, configured = 0, missing = 0;

  for (const slug of getDemos()) {
    total++;
    if (hasRemote(slug)) {
      console.log(`  ${GREEN}✓${RESET} ${slug.padEnd(30)}  remote: workflow-${slug}`);
      configured++;
    } else {
      console.log(`  ${RED}✗${RESET} ${slug.padEnd(30)}  ${RED}no remote${RESET}`);
      missing++;
    }
  }

  console.log("");
  info(`Total: ${total}  Configured: ${configured}  Missing: ${missing}`);
}

function cmdInitNew() {
  console.log(`\n${BOLD}Checking for demos without remotes...${RESET}\n`);
  const newDemos = getDemos().filter((slug) => !hasRemote(slug));

  if (newDemos.length === 0) {
    success("All demos already have remotes configured.");
    return;
  }

  info(`Found ${newDemos.length} demo(s) without remotes:`);
  for (const slug of newDemos) {
    console.log(`  ${YELLOW}•${RESET} ${slug}`);
  }

  console.log("");
  const confirm = prompt("Create GitHub repos and push all of these? [y/N] ");
  if (confirm.toLowerCase() !== "y") return;

  let created = 0, failed = 0;
  for (const slug of newDemos) {
    const repo = `vercel-labs/workflow-${slug}`;
    const remote = `workflow-${slug}`;

    console.log("");
    info(`Setting up ${slug}...`);

    // Create GitHub repo
    const exists = run(["gh", "repo", "view", repo]);
    if (exists.ok) {
      warn(`Repo ${repo} already exists on GitHub.`);
    } else {
      const create = run(["gh", "repo", "create", repo, "--public", "--confirm"]);
      if (create.ok) {
        success(`Created ${repo}.`);
      } else {
        fail(`Failed to create ${repo}. Skipping.`);
        failed++;
        continue;
      }
    }

    // Add remote
    if (!hasRemote(slug)) {
      run(["git", "remote", "add", remote, `https://github.com/${repo}.git`]);
      success(`Remote ${remote} added.`);
    }

    // Push subtree
    info(`Pushing subtree ${slug}...`);
    const push = run(["git", "subtree", "push", `--prefix=${slug}`, remote, "main"]);
    if (push.ok) {
      success(`${slug} pushed.`);
      created++;
    } else {
      fail(`${slug} subtree push failed.`);
      failed++;
    }
  }

  console.log("");
  success(`Done. Created: ${created}  Failed: ${failed}`);
}

function cmdAdd() {
  console.log(`\n${BOLD}Add a new demo as a subtree${RESET}\n`);
  const slug = prompt("Demo slug (directory name): ");

  if (!slug) {
    fail("Slug cannot be empty.");
    process.exit(1);
  }

  const repo = `vercel-labs/workflow-${slug}`;
  const remote = `workflow-${slug}`;

  try {
    statSync(join(PROJECT_ROOT, slug));
    warn(`Directory ${slug}/ already exists.`);
  } catch {}

  if (hasRemote(slug)) {
    warn(`Remote ${remote} already exists.`);
    const confirm = prompt("Continue anyway? [y/N] ");
    if (confirm.toLowerCase() !== "y") process.exit(0);
  }

  // Create GitHub repo
  info(`Creating GitHub repo ${repo}...`);
  const exists = run(["gh", "repo", "view", repo]);
  if (exists.ok) {
    warn(`Repo ${repo} already exists on GitHub.`);
  } else {
    run(["gh", "repo", "create", repo, "--public", "--confirm"]);
    success(`Created ${repo}.`);
  }

  // Add remote
  if (!hasRemote(slug)) {
    info(`Adding remote ${remote}...`);
    run(["git", "remote", "add", remote, `https://github.com/${repo}.git`]);
    success("Remote added.");
  }

  // Subtree push
  try {
    statSync(join(PROJECT_ROOT, slug));
    info("Directory exists — pushing as subtree...");
    run(["git", "subtree", "push", `--prefix=${slug}`, remote, "main"]);
    success("Subtree pushed.");
  } catch {
    warn(`No ${slug}/ directory found. Create the demo first, commit it, then run 'bun .scripts/sync.ts push-one'.`);
  }

  console.log("");
  success(`Done! Demo ${slug} is configured.`);
  info(`v0 URL: https://v0.app/chat/api/open?url=https://github.com/${repo}`);
}

// --- Menu / Dispatch ---------------------------------------------------------

function showMenu() {
  console.log(`\n${BOLD}Workflow Subtree Sync${RESET}\n`);
  console.log(`  ${CYAN}1)${RESET} sync      — Pull latest, then push all subtrees`);
  console.log(`  ${CYAN}2)${RESET} pull      — Pull from origin main`);
  console.log(`  ${CYAN}3)${RESET} push      — Push all subtrees to individual repos`);
  console.log(`  ${CYAN}4)${RESET} push-one  — Pick a single subtree to push`);
  console.log(`  ${CYAN}5)${RESET} status    — Show remote status for all demos`);
  console.log(`  ${CYAN}6)${RESET} add       — Add a new demo as a subtree`);
  console.log(`  ${CYAN}7)${RESET} init-new  — Create repos & push all unconfigured demos`);
  console.log("");

  const choice = prompt("Choose [1-7]: ");

  switch (choice) {
    case "1": cmdSync(); break;
    case "2": cmdPull(); break;
    case "3": cmdPush(); break;
    case "4": cmdPushOne(); break;
    case "5": cmdStatus(); break;
    case "6": cmdAdd(); break;
    case "7": cmdInitNew(); break;
    default: fail("Invalid choice."); process.exit(1);
  }
}

// --- Entry -------------------------------------------------------------------

const command = Bun.argv[2] ?? "";

switch (command) {
  case "sync": cmdSync(); break;
  case "pull": cmdPull(); break;
  case "push": cmdPush(); break;
  case "push-one": cmdPushOne(); break;
  case "status": cmdStatus(); break;
  case "add": cmdAdd(); break;
  case "init-new": cmdInitNew(); break;
  case "": showMenu(); break;
  default:
    fail(`Unknown command: ${command}`);
    console.log("Usage: bun .scripts/sync.ts [sync|pull|push|push-one|status|add|init-new]");
    process.exit(1);
}
