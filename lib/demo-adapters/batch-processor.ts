import { createElement } from "react";
import { BatchProcessorDemo } from "@/app/components/demos/batch-processor-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "batch-processor";

export const batchProcessorAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Batch Processor",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(BatchProcessorDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/batch-processor.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/batch-processor.ts"),
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
        path: `${SLUG}/components/batch-code-workbench.tsx`,
        role: "support",
        contents: readDemoFile(SLUG, "components/batch-code-workbench.tsx"),
      },
      {
        path: `${SLUG}/app/api/batch-processor/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/batch-processor/route.ts"),
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
      route: "/api/batch-processor",
      kind: "start",
      load: () => import("@/app/api/batch-processor/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
