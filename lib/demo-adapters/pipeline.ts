import { createElement } from "react";
import { PipelineDemo } from "@/app/components/demos/pipeline-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "pipeline";

export const pipelineAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Pipeline",

  async renderDemo() {
    logAdapterEvent({ level: "info", scope: "adapter", adapter: SLUG, action: "render_demo_started" });
    return createElement(PipelineDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      { path: `${SLUG}/workflows/pipeline.ts`, role: "workflow", contents: readDemoFile(SLUG, "workflows/pipeline.ts") },
      { path: `${SLUG}/app/page.tsx`, role: "page", contents: readDemoFile(SLUG, "app/page.tsx") },
      { path: `${SLUG}/app/components/demo.tsx`, role: "component", contents: readDemoFile(SLUG, "app/components/demo.tsx") },
      { path: `${SLUG}/app/api/pipeline/route.ts`, role: "api", contents: readDemoFile(SLUG, "app/api/pipeline/route.ts") },
      { path: `${SLUG}/app/api/readable/[runId]/route.ts`, role: "api", contents: readDemoFile(SLUG, "app/api/readable/[runId]/route.ts") },
    ];

    logAdapterEvent({ level: "info", scope: "adapter", adapter: SLUG, action: "get_code_bundle_succeeded", fileCount: files.length });
    return files;
  },

  apiRoutes: [
    { route: "/api/pipeline", kind: "start", load: () => import("@/app/api/pipeline/route") },
    { route: "/api/readable/[runId]", kind: "readable", load: () => import("@/app/api/readable/[runId]/route") },
  ],
};
