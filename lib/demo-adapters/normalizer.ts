import { createElement } from "react";
import { NormalizerDemo } from "@/app/components/demos/normalizer-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "normalizer";

export const normalizerAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Normalizer",

  async renderDemo() {
    logAdapterEvent({ level: "info", scope: "adapter", adapter: SLUG, action: "render_demo_started" });
    return createElement(NormalizerDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      { path: `${SLUG}/workflows/normalizer.ts`, role: "workflow", contents: readDemoFile(SLUG, "workflows/normalizer.ts") },
      { path: `${SLUG}/app/page.tsx`, role: "page", contents: readDemoFile(SLUG, "app/page.tsx") },
      { path: `${SLUG}/app/components/demo.tsx`, role: "component", contents: readDemoFile(SLUG, "app/components/demo.tsx") },
      { path: `${SLUG}/app/api/normalizer/route.ts`, role: "api", contents: readDemoFile(SLUG, "app/api/normalizer/route.ts") },
      { path: `${SLUG}/app/api/readable/[runId]/route.ts`, role: "api", contents: readDemoFile(SLUG, "app/api/readable/[runId]/route.ts") },
    ];

    logAdapterEvent({ level: "info", scope: "adapter", adapter: SLUG, action: "get_code_bundle_succeeded", fileCount: files.length });
    return files;
  },

  apiRoutes: [
    { route: "/api/normalizer", kind: "start", load: () => import("@/app/api/normalizer/route") },
    { route: "/api/readable/[runId]", kind: "readable", load: () => import("@/app/api/readable/[runId]/route") },
  ],
};
