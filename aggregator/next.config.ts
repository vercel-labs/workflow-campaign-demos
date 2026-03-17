import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const cwdHasPackageJson = existsSync(join(process.cwd(), "package.json"));

const nextConfig: NextConfig = cwdHasPackageJson
  ? {}
  : {
      // v0 sometimes runs the build from ".../app" instead of the repo root.
      // In that case, explicitly pin Turbopack back to the demo root so
      // "@/workflows/*" and the workflow plugin resolve correctly.
      turbopack: {
        root: projectRoot,
      },
    };

export default withWorkflow(nextConfig);
