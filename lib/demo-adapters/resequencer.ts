import { createElement } from "react";
import { ResequencerDemo } from "@/app/components/demos/resequencer-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "resequencer";

export const resequencerAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Resequencer",

  async renderDemo() {
    logAdapterEvent({ level: "info", scope: "adapter", adapter: SLUG, action: "render_demo_started" });
    return createElement(ResequencerDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      { path: `${SLUG}/workflows/resequencer.ts`, role: "workflow", contents: readDemoFile(SLUG, "workflows/resequencer.ts") },
      { path: `${SLUG}/app/api/resequencer/route.ts`, role: "api", contents: readDemoFile(SLUG, "app/api/resequencer/route.ts") },
      { path: `${SLUG}/app/api/resequencer/event/route.ts`, role: "api", contents: readDemoFile(SLUG, "app/api/resequencer/event/route.ts") },
      { path: `${SLUG}/app/api/readable/[runId]/route.ts`, role: "api", contents: readDemoFile(SLUG, "app/api/readable/[runId]/route.ts") },
      { path: `${SLUG}/app/api/run/[runId]/route.ts`, role: "api", contents: readDemoFile(SLUG, "app/api/run/[runId]/route.ts") },
    ];

    logAdapterEvent({ level: "info", scope: "adapter", adapter: SLUG, action: "get_code_bundle_succeeded", fileCount: files.length });
    return files;
  },

  apiRoutes: [
    { route: "/api/resequencer", kind: "start", load: () => import("@/app/api/resequencer/route") },
    { route: "/api/readable/[runId]", kind: "readable", load: () => import("@/app/api/readable/[runId]/route") },
  ],
};
