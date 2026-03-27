import { createElement } from "react";
import { EventSourcingDemo } from "@/app/components/demos/event-sourcing-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "event-sourcing";

export const eventSourcingAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Event Sourcing",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(EventSourcingDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/event-sourcing.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/event-sourcing.ts"),
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
        path: `${SLUG}/app/api/event-sourcing/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/event-sourcing/route.ts"),
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
      route: "/api/event-sourcing",
      kind: "start",
      load: () => import("@/app/api/event-sourcing/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
