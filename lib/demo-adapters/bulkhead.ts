import { createElement } from "react";
import { BulkheadDemo } from "@/app/components/demos/bulkhead-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "bulkhead";

export const bulkheadAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Bulkhead",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(BulkheadDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/bulkhead.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/bulkhead.ts"),
      },
      {
        path: `${SLUG}/app/page.tsx`,
        role: "page",
        contents: readDemoFile(SLUG, "app/page.tsx"),
      },
      {
        path: `${SLUG}/app/components/demo.tsx`,
        role: "component",
        contents: readDemoFile(SLUG, "app/components/demo.tsx"),
      },
      {
        path: `${SLUG}/app/components/bulkhead-code-workbench.tsx`,
        role: "support",
        contents: readDemoFile(SLUG, "app/components/bulkhead-code-workbench.tsx"),
      },
      {
        path: `${SLUG}/app/api/bulkhead/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/bulkhead/route.ts"),
      },
      {
        path: `${SLUG}/app/api/readable/[runId]/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/readable/[runId]/route.ts"),
      },
    ];

    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "get_code_bundle_succeeded",
      fileCount: files.length,
    });

    return files;
  },

  apiRoutes: [
    {
      route: "/api/bulkhead",
      kind: "start",
      load: () => import("@/app/api/bulkhead/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
