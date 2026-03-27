import { createElement } from "react";
import { PublishSubscribeDemo } from "@/app/components/demos/publish-subscribe-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "publish-subscribe";

export const publishSubscribeAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Publish-Subscribe",

  async renderDemo() {
    logAdapterEvent({ level: "info", scope: "adapter", adapter: SLUG, action: "render_demo_started" });
    return createElement(PublishSubscribeDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      { path: `${SLUG}/workflows/publish-subscribe.ts`, role: "workflow", contents: readDemoFile(SLUG, "workflows/publish-subscribe.ts") },
      { path: `${SLUG}/app/page.tsx`, role: "page", contents: readDemoFile(SLUG, "app/page.tsx") },
      { path: `${SLUG}/app/components/demo.tsx`, role: "component", contents: readDemoFile(SLUG, "app/components/demo.tsx") },
      { path: `${SLUG}/app/api/publish-subscribe/route.ts`, role: "api", contents: readDemoFile(SLUG, "app/api/publish-subscribe/route.ts") },
      { path: `${SLUG}/app/api/readable/[runId]/route.ts`, role: "api", contents: readDemoFile(SLUG, "app/api/readable/[runId]/route.ts") },
    ];

    logAdapterEvent({ level: "info", scope: "adapter", adapter: SLUG, action: "get_code_bundle_succeeded", fileCount: files.length });
    return files;
  },

  apiRoutes: [
    { route: "/api/publish-subscribe", kind: "start", load: () => import("@/app/api/publish-subscribe/route") },
    { route: "/api/readable/[runId]", kind: "readable", load: () => import("@/app/api/readable/[runId]/route") },
  ],
};
