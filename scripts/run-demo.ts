import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { getDemo } from "../lib/demos";
import { getDemoPort } from "../lib/demo-runtime";

const slug = process.argv[2];

if (!slug) {
  console.error("Usage: bun scripts/run-demo.ts <slug>");
  process.exit(1);
}

const demo = getDemo(slug);

if (!demo) {
  console.error(`Unknown demo slug "${slug}"`);
  process.exit(1);
}

const demoDir = join(process.cwd(), slug);
const port = getDemoPort(slug);

if (!existsSync(demoDir) || port === null) {
  console.error(`Demo directory not found for "${slug}"`);
  process.exit(1);
}

const hasPnpmLock = existsSync(join(demoDir, "pnpm-lock.yaml"));
const hasNpmLock = existsSync(join(demoDir, "package-lock.json"));

const command = hasPnpmLock ? "pnpm" : "npm";
const args = hasPnpmLock
  ? ["dev", "--port", String(port)]
  : hasNpmLock
    ? ["run", "dev", "--", "--port", String(port)]
    : ["run", "dev", "--", "--port", String(port)];

const child = spawn(command, args, {
  cwd: demoDir,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

