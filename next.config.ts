import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

/** No turbopack.root — breaks v0 preview. */
const nextConfig: NextConfig = {};

export default withWorkflow(nextConfig);
