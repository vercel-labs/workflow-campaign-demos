import { existsSync } from "node:fs";
import path from "node:path";
import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

/**
 * v0 preview sometimes runs with cwd nested under `app/`; resolve the directory
 * that actually contains node_modules/next.
 */
function turbopackRoot(): string {
  const candidates = [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "../.."),
  ];
  for (const dir of candidates) {
    if (existsSync(path.join(dir, "node_modules", "next", "package.json"))) {
      return dir;
    }
  }
  return process.cwd();
}

const nextConfig: NextConfig = {
  turbopack: {
    root: turbopackRoot(),
  },
};

export default withWorkflow(nextConfig);
