import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

/** No custom turbopack.root — v0's runtime resolves Next correctly; setting root breaks the preview. */
const nextConfig: NextConfig = {};

export default withWorkflow(nextConfig);
