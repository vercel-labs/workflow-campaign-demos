import { createElement } from "react";
import { MessageHistoryDemo } from "@/app/components/demos/message-history-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "message-history";

export const messageHistoryAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Message History",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(MessageHistoryDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/support-ticket-routing.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/support-ticket-routing.ts"),
      },
      {
        path: `${SLUG}/workflows/message-history.ts`,
        role: "support",
        contents: readDemoFile(SLUG, "workflows/message-history.ts"),
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
        path: `${SLUG}/app/api/message-history/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/message-history/route.ts"),
      },
      {
        path: `${SLUG}/app/api/readable/[runId]/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/readable/[runId]/route.ts"),
      },
      {
        path: `${SLUG}/app/api/run/[runId]/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/run/[runId]/route.ts"),
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
      route: "/api/message-history",
      kind: "start",
      load: () => import("@/app/api/message-history/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
