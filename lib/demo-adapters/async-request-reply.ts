import { createElement } from "react";
import { AsyncRequestReplyDemo } from "@/app/components/demos/async-request-reply-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "async-request-reply";

export const asyncRequestReplyAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Async Request-Reply",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(AsyncRequestReplyDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/async-request-reply.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/async-request-reply.ts"),
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
        path: `${SLUG}/app/api/async-request-reply/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/async-request-reply/route.ts"),
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
      {
        path: `${SLUG}/app/api/webhook/[token]/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/webhook/[token]/route.ts"),
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
      route: "/api/async-request-reply",
      kind: "start",
      load: () => import("@/app/api/async-request-reply/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
