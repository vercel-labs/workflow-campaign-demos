import { createElement } from "react";
import { ThrottleDemo } from "@/app/components/demos/throttle-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "throttle";

export const throttleAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Throttle",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(ThrottleDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/throttle.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/throttle.ts"),
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
        path: `${SLUG}/app/components/queue-code-workbench.tsx`,
        role: "support",
        contents: readDemoFile(SLUG, "app/components/queue-code-workbench.tsx"),
      },
      {
        path: `${SLUG}/app/components/code-highlight-server.ts`,
        role: "support",
        contents: readDemoFile(SLUG, "app/components/code-highlight-server.ts"),
      },
      {
        path: `${SLUG}/app/api/throttle/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/throttle/route.ts"),
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
      route: "/api/throttle",
      kind: "start",
      load: () => import("@/app/api/throttle/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
