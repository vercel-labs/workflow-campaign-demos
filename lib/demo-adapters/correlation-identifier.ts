import { createElement } from "react";
import { CorrelationIdentifierDemo } from "@/app/components/demos/correlation-identifier-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "correlation-identifier";

export const correlationIdentifierAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Correlation Identifier",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(CorrelationIdentifierDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/correlation-identifier.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/correlation-identifier.ts"),
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
        path: `${SLUG}/app/components/correlation-code-workbench.tsx`,
        role: "support",
        contents: readDemoFile(SLUG, "app/components/correlation-code-workbench.tsx"),
      },
      {
        path: `${SLUG}/app/api/correlation-identifier/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/correlation-identifier/route.ts"),
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
      route: "/api/correlation-identifier",
      kind: "start",
      load: () => import("@/app/api/correlation-identifier/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
