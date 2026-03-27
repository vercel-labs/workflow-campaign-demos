import { createElement } from "react";
import { WakeableReminderDemo } from "@/app/components/demos/wakeable-reminder-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "wakeable-reminder";

export const wakeableReminderAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Wakeable Reminder",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(WakeableReminderDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/wakeable-reminder.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/wakeable-reminder.ts"),
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
        path: `${SLUG}/app/components/wakeable-reminder-code-workbench.tsx`,
        role: "support",
        contents: readDemoFile(SLUG, "app/components/wakeable-reminder-code-workbench.tsx"),
      },
      {
        path: `${SLUG}/app/components/code-highlight-server.ts`,
        role: "support",
        contents: readDemoFile(SLUG, "app/components/code-highlight-server.ts"),
      },
      {
        path: `${SLUG}/app/api/wakeable-reminder/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/wakeable-reminder/route.ts"),
      },
      {
        path: `${SLUG}/app/api/wake/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/wake/route.ts"),
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
      route: "/api/wakeable-reminder",
      kind: "start",
      load: () => import("@/app/api/wakeable-reminder/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
