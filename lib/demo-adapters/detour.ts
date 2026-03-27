import { createElement } from "react";
import { DetourDemo } from "@/app/components/demos/detour-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "detour";

export const detourAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Detour",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(DetourDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/detour.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/detour.ts"),
      },
      {
        path: `${SLUG}/app/page.tsx`,
        role: "page",
        contents: readDemoFile(SLUG, "app/page.tsx"),
      },
      {
        path: `${SLUG}/app/components/detour-demo.tsx`,
        role: "component",
        contents: readDemoFile(SLUG, "app/components/detour-demo.tsx"),
      },
      {
        path: `${SLUG}/app/api/detour/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/detour/route.ts"),
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
      route: "/api/detour",
      kind: "start",
      load: () => import("@/app/api/detour/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
