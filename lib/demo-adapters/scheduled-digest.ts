import { createElement } from "react";
import { ScheduledDigestDemo } from "@/app/components/demos/scheduled-digest-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "scheduled-digest";

export const scheduledDigestAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Scheduled Digest",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(ScheduledDigestDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/scheduled-digest.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/scheduled-digest.ts"),
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
        path: `${SLUG}/app/components/digest-code-workbench.tsx`,
        role: "support",
        contents: readDemoFile(SLUG, "app/components/digest-code-workbench.tsx"),
      },
      {
        path: `${SLUG}/app/components/code-highlight-server.ts`,
        role: "support",
        contents: readDemoFile(SLUG, "app/components/code-highlight-server.ts"),
      },
      {
        path: `${SLUG}/app/api/scheduled-digest/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/scheduled-digest/route.ts"),
      },
      {
        path: `${SLUG}/app/api/event/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/event/route.ts"),
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
      route: "/api/scheduled-digest",
      kind: "start",
      load: () => import("@/app/api/scheduled-digest/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
