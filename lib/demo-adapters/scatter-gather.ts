import { createElement } from "react";
import { ScatterGatherDemo } from "@/app/components/demos/scatter-gather-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "scatter-gather";

export const scatterGatherAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Scatter-Gather",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(ScatterGatherDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/scatter-gather.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/scatter-gather.ts"),
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
        path: `${SLUG}/app/components/scatter-gather-code-workbench.tsx`,
        role: "support",
        contents: readDemoFile(SLUG, "app/components/scatter-gather-code-workbench.tsx"),
      },
      {
        path: `${SLUG}/app/components/code-highlight-server.ts`,
        role: "support",
        contents: readDemoFile(SLUG, "app/components/code-highlight-server.ts"),
      },
      {
        path: `${SLUG}/app/api/scatter-gather/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/scatter-gather/route.ts"),
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
      route: "/api/scatter-gather",
      kind: "start",
      load: () => import("@/app/api/scatter-gather/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
