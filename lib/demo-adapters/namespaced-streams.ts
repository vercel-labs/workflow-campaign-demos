import { createElement } from "react";
import { NamespacedStreamsDemo } from "@/app/components/demos/namespaced-streams-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "namespaced-streams";

export const namespacedStreamsAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Namespaced Streams",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(NamespacedStreamsDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/namespaced-streams.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/namespaced-streams.ts"),
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
        path: `${SLUG}/app/api/namespaced-streams/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/namespaced-streams/route.ts"),
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
      route: "/api/namespaced-streams",
      kind: "start",
      load: () => import("@/app/api/namespaced-streams/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
