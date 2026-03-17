import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

function hasNextPkg(dir: string): boolean {
  return existsSync(path.join(dir, "node_modules", "next", "package.json"));
}

/**
 * v0 imports run with cwd .../v0-next-shadcn/app while Next lives under the parent.
 * Next then infers the wrong project root unless turbopack.root points at that parent.
 */
function turbopackRoot(): string {
  const cwd = path.resolve(process.cwd());
  const up = path.resolve(cwd, "..");
  const up2 = path.resolve(cwd, "../..");

  if (path.basename(cwd) === "app" && hasNextPkg(up)) {
    return up;
  }

  for (const dir of [cwd, up, up2]) {
    if (hasNextPkg(dir)) return dir;
  }

  const cfgDir = path.dirname(fileURLToPath(import.meta.url));
  for (const dir of [cfgDir, path.resolve(cfgDir, "..")]) {
    if (hasNextPkg(dir)) return dir;
  }

  return cwd;
}

const nextConfig: NextConfig = {
  turbopack: {
    root: turbopackRoot(),
  },
};

export default withWorkflow(nextConfig);
