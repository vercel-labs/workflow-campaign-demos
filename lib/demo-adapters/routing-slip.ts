import { createElement } from "react";
import { RoutingSlipDemo } from "@/app/components/demos/routing-slip-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "routing-slip";

export const routingSlipAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Routing Slip",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(RoutingSlipDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/routing-slip.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/routing-slip.ts"),
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
        path: `${SLUG}/components/routing-slip-code-workbench.tsx`,
        role: "support",
        contents: readDemoFile(SLUG, "components/routing-slip-code-workbench.tsx"),
      },
      {
        path: `${SLUG}/components/code-highlight-server.ts`,
        role: "support",
        contents: readDemoFile(SLUG, "components/code-highlight-server.ts"),
      },
      {
        path: `${SLUG}/app/api/routing-slip/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/routing-slip/route.ts"),
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
      route: "/api/routing-slip",
      kind: "start",
      load: () => import("@/app/api/routing-slip/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
