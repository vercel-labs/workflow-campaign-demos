import { createElement } from "react";
import { IdempotentReceiverDemo } from "@/app/components/demos/idempotent-receiver-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "idempotent-receiver";

export const idempotentReceiverAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Idempotent Receiver",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(IdempotentReceiverDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/idempotent-receiver.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/idempotent-receiver.ts"),
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
        path: `${SLUG}/app/api/idempotent-receiver/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/idempotent-receiver/route.ts"),
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
      route: "/api/idempotent-receiver",
      kind: "start",
      load: () => import("@/app/api/idempotent-receiver/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
