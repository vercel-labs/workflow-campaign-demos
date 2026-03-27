import { createElement } from "react";
import { EventGatewayDemo } from "@/app/components/demos/event-gateway-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "event-gateway";

export const eventGatewayAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Event Gateway",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(EventGatewayDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/event-gateway.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/event-gateway.ts"),
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
        path: `${SLUG}/app/api/event-gateway/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/event-gateway/route.ts"),
      },
      {
        path: `${SLUG}/app/api/readable/[runId]/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/readable/[runId]/route.ts"),
      },
      {
        path: `${SLUG}/app/api/signal/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/signal/route.ts"),
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
      route: "/api/event-gateway",
      kind: "start",
      load: () => import("@/app/api/event-gateway/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
