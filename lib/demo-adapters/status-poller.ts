import { createElement } from "react";
import { StatusPollerDemo } from "@/app/components/demos/status-poller-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "status-poller";

export const statusPollerAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Status Poller",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(StatusPollerDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/status-poller.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/status-poller.ts"),
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
        path: `${SLUG}/app/components/poller-code-workbench.tsx`,
        role: "support",
        contents: readDemoFile(SLUG, "app/components/poller-code-workbench.tsx"),
      },
      {
        path: `${SLUG}/app/components/code-highlight-server.ts`,
        role: "support",
        contents: readDemoFile(SLUG, "app/components/code-highlight-server.ts"),
      },
      {
        path: `${SLUG}/app/api/status-poller/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/status-poller/route.ts"),
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
      route: "/api/status-poller",
      kind: "start",
      load: () => import("@/app/api/status-poller/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
