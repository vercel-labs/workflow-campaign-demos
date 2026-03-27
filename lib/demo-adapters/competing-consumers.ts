import { createElement } from "react";
import { CompetingConsumersDemo } from "@/app/components/demos/competing-consumers-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "competing-consumers";

export const competingConsumersAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Competing Consumers",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(CompetingConsumersDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/competing-consumers.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/competing-consumers.ts"),
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
        path: `${SLUG}/app/components/cc-code-workbench.tsx`,
        role: "support",
        contents: readDemoFile(SLUG, "app/components/cc-code-workbench.tsx"),
      },
      {
        path: `${SLUG}/app/api/competing-consumers/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/competing-consumers/route.ts"),
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
      route: "/api/competing-consumers",
      kind: "start",
      load: () => import("@/app/api/competing-consumers/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
