import { createElement } from "react";
import { RetryableRateLimitDemo } from "@/app/components/demos/retryable-rate-limit-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "retryable-rate-limit";

export const retryableRateLimitAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Retryable Rate Limit",

  async renderDemo() {
    logAdapterEvent({ level: "info", scope: "adapter", adapter: SLUG, action: "render_demo_started" });
    return createElement(RetryableRateLimitDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      { path: `${SLUG}/workflows/retryable-rate-limit.ts`, role: "workflow", contents: readDemoFile(SLUG, "workflows/retryable-rate-limit.ts") },
      { path: `${SLUG}/app/api/start/route.ts`, role: "api", contents: readDemoFile(SLUG, "app/api/start/route.ts") },
      { path: `${SLUG}/app/api/readable/[runId]/route.ts`, role: "api", contents: readDemoFile(SLUG, "app/api/readable/[runId]/route.ts") },
    ];

    logAdapterEvent({ level: "info", scope: "adapter", adapter: SLUG, action: "get_code_bundle_succeeded", fileCount: files.length });
    return files;
  },

  apiRoutes: [
    { route: "/api/retryable-rate-limit", kind: "start", load: () => import("@/app/api/retryable-rate-limit/route") },
    { route: "/api/readable/[runId]", kind: "readable", load: () => import("@/app/api/readable/[runId]/route") },
  ],
};
