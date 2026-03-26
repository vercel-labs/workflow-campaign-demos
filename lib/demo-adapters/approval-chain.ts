import { readFileSync } from "fs";
import { join } from "path";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "approval-chain";
const DEMO_DIR = join(process.cwd(), SLUG);

export const approvalChainAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Approval Chain",

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [];

    const workflowPath = join(DEMO_DIR, "workflows/approval-chain.ts");
    files.push({
      path: `${SLUG}/workflows/approval-chain.ts`,
      role: "workflow",
      contents: readFileSync(workflowPath, "utf-8"),
    });

    const startRoutePath = join(DEMO_DIR, "app/api/approval-chain/route.ts");
    files.push({
      path: `${SLUG}/app/api/approval-chain/route.ts`,
      role: "api",
      contents: readFileSync(startRoutePath, "utf-8"),
    });

    const readableRoutePath = join(
      DEMO_DIR,
      "app/api/readable/[runId]/route.ts"
    );
    files.push({
      path: `${SLUG}/app/api/readable/[runId]/route.ts`,
      role: "api",
      contents: readFileSync(readableRoutePath, "utf-8"),
    });

    // Extra route: approval resume endpoint
    const approveRoutePath = join(DEMO_DIR, "app/api/approve/route.ts");
    files.push({
      path: `${SLUG}/app/api/approve/route.ts`,
      role: "api",
      contents: readFileSync(approveRoutePath, "utf-8"),
    });

    console.info(
      JSON.stringify({
        level: "info",
        adapter: SLUG,
        action: "getCodeBundle",
        fileCount: files.length,
      })
    );

    return files;
  },

  apiRoutes: [
    { route: "/api/approval-chain", kind: "start" },
    { route: "/api/readable/[runId]", kind: "readable" },
    { route: "/api/approve", kind: "extra" },
  ],
};
