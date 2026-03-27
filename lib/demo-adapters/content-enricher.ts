import { createElement } from "react";
import { ContentEnricherDemo } from "@/app/components/demos/content-enricher-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "content-enricher";

export const contentEnricherAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Content Enricher",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(ContentEnricherDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/content-enricher.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/content-enricher.ts"),
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
        path: `${SLUG}/components/content-enricher-code-workbench.tsx`,
        role: "support",
        contents: readDemoFile(SLUG, "components/content-enricher-code-workbench.tsx"),
      },
      {
        path: `${SLUG}/app/api/enrich/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/enrich/route.ts"),
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
      route: "/api/content-enricher",
      kind: "start",
      load: () => import("@/app/api/content-enricher/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
