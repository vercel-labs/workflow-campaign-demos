import { createElement } from "react";
import { RequestReplyDemo } from "@/app/components/demos/request-reply-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "request-reply";

export const requestReplyAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Request-Reply",

  async renderDemo() {
    logAdapterEvent({ level: "info", scope: "adapter", adapter: SLUG, action: "render_demo_started" });
    return createElement(RequestReplyDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      { path: `${SLUG}/workflows/request-reply.ts`, role: "workflow", contents: readDemoFile(SLUG, "workflows/request-reply.ts") },
      { path: `${SLUG}/app/page.tsx`, role: "page", contents: readDemoFile(SLUG, "app/page.tsx") },
      { path: `${SLUG}/app/components/demo.tsx`, role: "component", contents: readDemoFile(SLUG, "app/components/demo.tsx") },
      { path: `${SLUG}/app/api/request-reply/route.ts`, role: "api", contents: readDemoFile(SLUG, "app/api/request-reply/route.ts") },
      { path: `${SLUG}/app/api/readable/[runId]/route.ts`, role: "api", contents: readDemoFile(SLUG, "app/api/readable/[runId]/route.ts") },
    ];

    logAdapterEvent({ level: "info", scope: "adapter", adapter: SLUG, action: "get_code_bundle_succeeded", fileCount: files.length });
    return files;
  },

  apiRoutes: [
    { route: "/api/request-reply", kind: "start", load: () => import("@/app/api/request-reply/route") },
    { route: "/api/readable/[runId]", kind: "readable", load: () => import("@/app/api/readable/[runId]/route") },
  ],
};
