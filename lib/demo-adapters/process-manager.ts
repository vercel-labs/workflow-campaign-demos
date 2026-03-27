import { createElement } from "react";
import { ProcessManagerDemo } from "@/app/components/demos/process-manager-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "process-manager";

export const processManagerAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Process Manager",

  async renderDemo() {
    logAdapterEvent({ level: "info", scope: "adapter", adapter: SLUG, action: "render_demo_started" });
    return createElement(ProcessManagerDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      { path: `${SLUG}/workflows/process-manager.ts`, role: "workflow", contents: readDemoFile(SLUG, "workflows/process-manager.ts") },
      { path: `${SLUG}/app/page.tsx`, role: "page", contents: readDemoFile(SLUG, "app/page.tsx") },
      { path: `${SLUG}/app/components/demo.tsx`, role: "component", contents: readDemoFile(SLUG, "app/components/demo.tsx") },
      { path: `${SLUG}/app/api/process-manager/route.ts`, role: "api", contents: readDemoFile(SLUG, "app/api/process-manager/route.ts") },
      { path: `${SLUG}/app/api/readable/[runId]/route.ts`, role: "api", contents: readDemoFile(SLUG, "app/api/readable/[runId]/route.ts") },
      { path: `${SLUG}/app/api/run/[runId]/route.ts`, role: "api", contents: readDemoFile(SLUG, "app/api/run/[runId]/route.ts") },
    ];

    logAdapterEvent({ level: "info", scope: "adapter", adapter: SLUG, action: "get_code_bundle_succeeded", fileCount: files.length });
    return files;
  },

  apiRoutes: [
    { route: "/api/process-manager", kind: "start", load: () => import("@/app/api/process-manager/route") },
    { route: "/api/readable/[runId]", kind: "readable", load: () => import("@/app/api/readable/[runId]/route") },
  ],
};
