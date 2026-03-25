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
 *   bun .scripts/sync.ts repair <slug>      # re-link as real subtree (clean tree required)
 *   bun .scripts/sync.ts repair-all --yes   # batch re-link demos missing subtree history
 */

import { existsSync, readdirSync, rmSync, statSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = join(import.meta.dir, "..");
type RunResult = { ok: boolean; stdout: string; stderr: string };
type SubtreePushResult =
  | { status: "pushed"; splitSha: string }
  | { status: "skipped"; splitSha: string }
  | { status: "failed"; step: "split" | "remote" | "push"; error: string };

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

function run(cmd: string[], cwd = PROJECT_ROOT): RunResult {
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

/** Duplicate subtree join commits break plain `subtree push` (git cache error). */
const SUBTREE_PUSH_EXTRA: Record<string, string[]> = {
  "async-request-reply": ["--ignore-joins"],
};

export function getSubtreeArgs(slug: string): string[] {
  const extra = SUBTREE_PUSH_EXTRA[slug] ?? [];
  return [`--prefix=${slug}`, ...extra];
}

function extractLastToken(stdout: string): string {
  const line = stdout
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean)
    .at(-1);
  return line?.split(/\s+/)[0] ?? "";
}

function describeRunFailure(result: RunResult, fallback: string): string {
  return result.stderr || result.stdout || fallback;
}

function shouldSuggestRepair(error: string): boolean {
  return error.includes("no new revisions");
}

function getSubtreeSplitSha(slug: string): { ok: true; splitSha: string } | { ok: false; error: string } {
  const split = run(["git", "subtree", "split", ...getSubtreeArgs(slug)]);
  if (!split.ok) {
    return {
      ok: false,
      error: describeRunFailure(split, `git subtree split failed for ${slug}`),
    };
  }

  const splitSha = extractLastToken(split.stdout);
  if (!splitSha) {
    return {
      ok: false,
      error: `git subtree split returned no SHA for ${slug}`,
    };
  }

  return { ok: true, splitSha };
}

function getRemoteMainSha(slug: string): { ok: true; remoteSha: string | null } | { ok: false; error: string } {
  const remote = run(["git", "ls-remote", `workflow-${slug}`, "refs/heads/main"]);
  if (!remote.ok) {
    return {
      ok: false,
      error: describeRunFailure(remote, `git ls-remote failed for workflow-${slug}`),
    };
  }

  const remoteSha = extractLastToken(remote.stdout);
  return { ok: true, remoteSha: remoteSha || null };
}

export function pushSubtreeIfChanged(slug: string): SubtreePushResult {
  const split = getSubtreeSplitSha(slug);
  if (!split.ok) {
    return { status: "failed", step: "split", error: split.error };
  }

  const remote = getRemoteMainSha(slug);
  if (!remote.ok) {
    return { status: "failed", step: "remote", error: remote.error };
  }

  if (remote.remoteSha === split.splitSha) {
    return { status: "skipped", splitSha: split.splitSha };
  }

  const push = run([
    "git",
    "push",
    `workflow-${slug}`,
    `${split.splitSha}:refs/heads/main`,
  ]);
  if (!push.ok) {
    return {
      status: "failed",
      step: "push",
      error: describeRunFailure(push, `git push failed for ${slug}`),
    };
  }

  return { status: "pushed", splitSha: split.splitSha };
}

function prompt(question: string): string {
  process.stdout.write(question);
  const buf = new Uint8Array(256);
  const fsModule = globalThis.require("fs") as { readSync: (fd: number, buffer: Uint8Array) => number };
  const n = fsModule.readSync(0, buf);
  return new TextDecoder().decode(buf.slice(0, n)).trim();
}

// --- Commands ----------------------------------------------------------------

export function cmdPull(): boolean {
  info("Pulling latest from origin main...");
  const result = run(["git", "pull", "origin", "main"]);
  if (result.ok) {
    success("Pull complete.");
    return true;
  }

  fail(`Pull failed: ${describeRunFailure(result, "git pull origin main failed")}`);
  process.exitCode = 1;
  return false;
}

export function cmdPush() {
  info("Pushing all subtrees to their individual repos...");
  let pushed = 0, skipped = 0, failed = 0;

  for (const slug of getDemos()) {
    if (!hasRemote(slug)) {
      warn(`Skipping ${slug} — no remote workflow-${slug}`);
      skipped++;
      continue;
    }

    info(`Checking ${slug}...`);
    const result = pushSubtreeIfChanged(slug);
    if (result.status === "pushed") {
      success(`${slug} pushed (${result.splitSha.slice(0, 12)}).`);
      pushed++;
      continue;
    }

    if (result.status === "skipped") {
      info(`${slug} unchanged — remote main already matches ${result.splitSha.slice(0, 12)}.`);
      skipped++;
      continue;
    }

    fail(`${slug} failed during ${result.step}: ${result.error}`);
    if (shouldSuggestRepair(result.error)) {
      warn(`  Run: bun .scripts/sync.ts repair ${slug}`);
    }
    failed++;
  }

  console.log("");
  if (failed > 0) {
    fail(`Done. Pushed: ${pushed}  Skipped: ${skipped}  Failed: ${failed}`);
    process.exitCode = 1;
    return;
  }

  success(`Done. Pushed: ${pushed}  Skipped: ${skipped}  Failed: ${failed}`);
}

export function cmdPushOne() {
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
  const result = pushSubtreeIfChanged(slug);
  if (result.status === "pushed") {
    success(`${slug} pushed (${result.splitSha.slice(0, 12)}).`);
    return;
  }

  if (result.status === "skipped") {
    info(`${slug} is already up to date (${result.splitSha.slice(0, 12)}).`);
    return;
  }

  fail(`Push failed during ${result.step}: ${result.error}`);
  if (shouldSuggestRepair(result.error)) {
    warn(`Try: bun .scripts/sync.ts repair ${slug}`);
  }
  process.exitCode = 1;
}

export function cmdSync() {
  const pulled = cmdPull();
  if (!pulled) {
    warn("Sync aborted because pull failed.");
    return;
  }

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

export function cmdInitNew() {
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
        fail(`Failed to create ${repo}: ${describeRunFailure(create, "gh repo create failed")}`);
        failed++;
        continue;
      }
    }

    // Add remote
    if (!hasRemote(slug)) {
      const addRemote = run(["git", "remote", "add", remote, `https://github.com/${repo}.git`]);
      if (!addRemote.ok) {
        fail(`Failed to add remote ${remote}: ${describeRunFailure(addRemote, "git remote add failed")}`);
        failed++;
        continue;
      }

      success(`Remote ${remote} added.`);
    }

    // Push subtree
    info(`Pushing subtree ${slug}...`);
    const push = pushSubtreeIfChanged(slug);
    if (push.status === "pushed") {
      success(`${slug} pushed (${push.splitSha.slice(0, 12)}).`);
      created++;
      continue;
    }

    if (push.status === "skipped") {
      info(`${slug} already matches remote main (${push.splitSha.slice(0, 12)}).`);
      created++;
      continue;
    }

    fail(`${slug} subtree push failed during ${push.step}: ${push.error}`);
    if (shouldSuggestRepair(push.error)) {
      warn(`  If this is "no new revisions", run: bun .scripts/sync.ts repair ${slug}`);
    }
    failed++;
  }

  console.log("");
  if (failed > 0) {
    fail(`Done. Created: ${created}  Failed: ${failed}`);
    process.exitCode = 1;
    return;
  }

  success(`Done. Created: ${created}  Failed: ${failed}`);
}

export function cmdAdd() {
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

  let repoReady = false;
  let remoteReady = hasRemote(slug);
  let hadFailure = false;

  // Create GitHub repo
  info(`Creating GitHub repo ${repo}...`);
  const exists = run(["gh", "repo", "view", repo]);
  if (exists.ok) {
    warn(`Repo ${repo} already exists on GitHub.`);
    repoReady = true;
  } else {
    const create = run(["gh", "repo", "create", repo, "--public", "--confirm"]);
    if (!create.ok) {
      fail(`Failed to create ${repo}: ${describeRunFailure(create, "gh repo create failed")}`);
      hadFailure = true;
    } else {
      success(`Created ${repo}.`);
      repoReady = true;
    }
  }

  // Add remote
  if (!remoteReady && repoReady) {
    info(`Adding remote ${remote}...`);
    const addRemote = run(["git", "remote", "add", remote, `https://github.com/${repo}.git`]);
    if (!addRemote.ok) {
      fail(`Failed to add remote ${remote}: ${describeRunFailure(addRemote, "git remote add failed")}`);
      hadFailure = true;
    } else {
      success("Remote added.");
      remoteReady = true;
    }
  }

  // Subtree push
  try {
    statSync(join(PROJECT_ROOT, slug));
    if (!remoteReady) {
      warn(`Remote ${remote} is not configured. Skipping subtree push.`);
      hadFailure = true;
    } else {
      info("Directory exists — pushing as subtree...");
      const push = pushSubtreeIfChanged(slug);
      if (push.status === "pushed") {
        success(`Subtree pushed (${push.splitSha.slice(0, 12)}).`);
      } else if (push.status === "skipped") {
        info(`Subtree already matches remote main (${push.splitSha.slice(0, 12)}).`);
      } else {
        fail(`Subtree push failed during ${push.step}: ${push.error}`);
        if (shouldSuggestRepair(push.error)) {
          warn(`  Run: bun .scripts/sync.ts repair ${slug}`);
        }
        hadFailure = true;
      }
    }
  } catch {
    warn(`No ${slug}/ directory found. Create the demo first, commit it, then run 'bun .scripts/sync.ts push-one'.`);
  }

  console.log("");
  if (hadFailure) {
    fail(`Demo ${slug} was not fully configured.`);
    process.exitCode = 1;
    return;
  }

  success(`Done! Demo ${slug} is configured.`);
  if (repoReady) {
    info(`v0 URL: https://v0.app/chat/api/open?url=https://github.com/${repo}`);
  }
}

/** Demos that were mirrored without subtree merge history (rsync / plain commits). */
const REPAIR_ALL_SLUGS = [
  "choreography",
  "competing-consumers",
  "content-based-router",
  "correlation-identifier",
  "detour",
  "event-sourcing",
  "guaranteed-delivery",
  "hedge-request",
  "idempotent-receiver",
  "map-reduce",
  "message-filter",
  "message-history",
  "message-translator",
  "normalizer",
  "priority-queue",
  "process-manager",
  "publish-subscribe",
  "recipient-list",
  "request-reply",
  "resequencer",
  "splitter",
  "throttle",
  "transactional-outbox",
  "wire-tap",
];

function subtreeAddFromRemote(slug: string): boolean {
  const add = run(
    [
      "git",
      "subtree",
      "add",
      `--prefix=${slug}`,
      `workflow-${slug}`,
      "main",
      "-m",
      `git subtree: add ${slug} from vercel-labs/workflow-${slug}`,
    ],
    PROJECT_ROOT
  );
  if (!add.ok) {
    fail(`subtree add failed (${slug}): ${add.stderr}`);
    return false;
  }
  return true;
}

function repairOneSlug(slug: string, opts: { skipPrompt: boolean }): boolean {
  if (!hasRemote(slug)) {
    warn(`Skipping ${slug} — no remote workflow-${slug}`);
    return false;
  }

  const tracked =
    run(["git", "ls-files", "-z", slug], PROJECT_ROOT).stdout.split("\0").filter(Boolean).length > 0;
  const dir = join(PROJECT_ROOT, slug);

  if (!opts.skipPrompt) {
    console.log("");
    warn(`Re-link ${slug}/ as a real git subtree (fixes subtree push).`);
    warn(`After this, ${slug}/ will match workflow-${slug}/main exactly.`);
    warn(`If monorepo has newer code than GitHub, update the repo first, then run repair.`);
    const c = prompt("Continue? [y/N] ");
    if (c.toLowerCase() !== "y") {
      info("Aborted.");
      return false;
    }
  }

  if (!run(["git", "fetch", `workflow-${slug}`, "main"]).ok) {
    fail(`git fetch workflow-${slug} main failed`);
    return false;
  }

  if (tracked) {
    const rm = run(["git", "rm", "-rf", `${slug}/`], PROJECT_ROOT);
    if (!rm.ok) {
      fail(`git rm failed (${slug}): ${rm.stderr}`);
      return false;
    }
    if (!run(["git", "commit", "-m", `chore: remove ${slug} for subtree re-link`]).ok) {
      fail(`commit failed (${slug})`);
      run(["git", "reset", "--hard", "HEAD"], PROJECT_ROOT);
      return false;
    }
  }

  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }

  if (!subtreeAddFromRemote(slug)) {
    if (tracked) {
      warn(`Rollback: git reset --hard HEAD~1 for ${slug}`);
      run(["git", "reset", "--hard", "HEAD~1"], PROJECT_ROOT);
    }
    return false;
  }

  if (!opts.skipPrompt) {
    console.log("");
    success(`${slug} is now a real subtree.`);
    info("Push: bun .scripts/sync.ts push-one");
  } else {
    success(`${slug} ✓`);
  }
  return true;
}

function cmdRepair(slug: string) {
  if (!slug) {
    fail("Usage: bun .scripts/sync.ts repair <slug>");
    process.exit(1);
  }
  try {
    statSync(join(PROJECT_ROOT, slug, "package.json"));
  } catch {
    fail(`No directory ${slug}/ with package.json`);
    process.exit(1);
  }

  const porcel = run(["git", "status", "--porcelain"]);
  if (porcel.stdout.length > 0) {
    fail("Working tree must be clean. Commit or stash, then retry.");
    process.exit(1);
  }

  if (!repairOneSlug(slug, { skipPrompt: false })) {
    process.exit(1);
  }
}

function cmdRepairAll(yes: boolean) {
  if (!yes) {
    fail("Usage: bun .scripts/sync.ts repair-all --yes");
    fail("(Replaces each listed demo with workflow-*/main; requires clean working tree.)");
    process.exit(1);
  }
  const porcel = run(["git", "status", "--porcelain"]);
  if (porcel.stdout.length > 0) {
    fail("Working tree must be clean. Run: git stash push -u -m 'pre-repair-all'");
    process.exit(1);
  }

  console.log("");
  warn(`repair-all: ${REPAIR_ALL_SLUGS.length} demos → subtree from workflow-*/main`);
  let ok = 0;
  let skip = 0;
  for (const slug of REPAIR_ALL_SLUGS) {
    if (!hasRemote(slug)) {
      warn(`skip ${slug} (no remote)`);
      skip++;
      continue;
    }
    if (repairOneSlug(slug, { skipPrompt: true })) ok++;
    else skip++;
  }
  console.log("");
  success(`Done: ${ok} repaired, ${skip} skipped/failed.`);
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
  console.log(`  ${CYAN}8)${RESET} repair    — Re-link one demo as real subtree (see CLAUDE.md)`);
  console.log(`     repair-all --yes — Batch re-link (clean tree; see REPAIR_ALL_SLUGS)`);
  console.log("");

  const choice = prompt("Choose [1-8]: ");

  switch (choice) {
    case "1": cmdSync(); break;
    case "2": cmdPull(); break;
    case "3": cmdPush(); break;
    case "4": cmdPushOne(); break;
    case "5": cmdStatus(); break;
    case "6": cmdAdd(); break;
    case "7": cmdInitNew(); break;
    case "8": {
      const s = prompt("Demo slug: ");
      cmdRepair(s);
      break;
    }
    default: fail("Invalid choice."); process.exit(1);
  }
}

// --- Entry -------------------------------------------------------------------

export function main() {
  const command = Bun.argv[2] ?? "";

  switch (command) {
    case "sync": cmdSync(); break;
    case "pull": cmdPull(); break;
    case "push": cmdPush(); break;
    case "push-one": cmdPushOne(); break;
    case "status": cmdStatus(); break;
    case "add": cmdAdd(); break;
    case "init-new": cmdInitNew(); break;
    case "repair": {
      const slug = Bun.argv[3] ?? "";
      cmdRepair(slug);
      break;
    }
    case "repair-all":
      cmdRepairAll(Bun.argv.includes("--yes"));
      break;
    case "":
      showMenu();
      break;
    default:
      fail(`Unknown command: ${command}`);
      console.log(
        "Usage: bun .scripts/sync.ts [sync|pull|push|push-one|status|add|init-new|repair <slug>|repair-all --yes]"
      );
      process.exit(1);
  }
}

if (import.meta.main) {
  main();
}
