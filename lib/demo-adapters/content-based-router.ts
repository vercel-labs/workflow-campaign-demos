import { createElement } from "react";
import { ContentBasedRouterDemo } from "@/app/components/demos/content-based-router-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "content-based-router";

export const contentBasedRouterAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Content-Based Router",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(ContentBasedRouterDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/content-based-router.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/content-based-router.ts"),
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
        path: `${SLUG}/app/components/router-code-workbench.tsx`,
        role: "support",
        contents: readDemoFile(SLUG, "app/components/router-code-workbench.tsx"),
      },
      {
        path: `${SLUG}/app/api/content-based-router/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/content-based-router/route.ts"),
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
      route: "/api/content-based-router",
      kind: "start",
      load: () => import("@/app/api/content-based-router/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
