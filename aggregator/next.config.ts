import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const nextConfig: NextConfig = {
  // v0 can infer ".../app" as the project directory for imported demos.
  // Pin Turbopack to the actual demo root so sibling folders like
  // `workflows/` remain inside the compiled project boundary.
  turbopack: {
    root: join(projectRoot),
  },
};

export default withWorkflow(nextConfig);
