import { createElement } from "react";
import { TransactionalOutboxDemo } from "@/app/components/demos/transactional-outbox-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "transactional-outbox";

export const transactionalOutboxAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Transactional Outbox",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(TransactionalOutboxDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/transactional-outbox.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/transactional-outbox.ts"),
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
        path: `${SLUG}/app/components/outbox-code-workbench.tsx`,
        role: "support",
        contents: readDemoFile(SLUG, "app/components/outbox-code-workbench.tsx"),
      },
      {
        path: `${SLUG}/app/components/code-highlight-server.ts`,
        role: "support",
        contents: readDemoFile(SLUG, "app/components/code-highlight-server.ts"),
      },
      {
        path: `${SLUG}/app/api/transactional-outbox/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/transactional-outbox/route.ts"),
      },
      {
        path: `${SLUG}/app/api/run/[runId]/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/run/[runId]/route.ts"),
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
      route: "/api/transactional-outbox",
      kind: "start",
      load: () => import("@/app/api/transactional-outbox/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
