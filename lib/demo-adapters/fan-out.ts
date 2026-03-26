import { readFileSync } from "fs";
import { join } from "path";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "fan-out";
const DEMO_DIR = join(process.cwd(), SLUG);

export const fanOutAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Fan-Out Notifications",

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [];

    const workflowPath = join(DEMO_DIR, "workflows/incident-fanout.ts");
    files.push({
      path: `${SLUG}/workflows/incident-fanout.ts`,
      role: "workflow",
      contents: readFileSync(workflowPath, "utf-8"),
    });

    const startRoutePath = join(DEMO_DIR, "app/api/fan-out/route.ts");
    files.push({
      path: `${SLUG}/app/api/fan-out/route.ts`,
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
    { route: "/api/fan-out", kind: "start" },
    { route: "/api/readable/[runId]", kind: "readable" },
  ],
};
