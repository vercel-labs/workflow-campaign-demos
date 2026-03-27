import { createElement } from "react";
import { ClaimCheckDemo } from "@/app/components/demos/claim-check-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "claim-check";

export const claimCheckAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Claim Check",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(ClaimCheckDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/claim-check.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/claim-check.ts"),
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
        path: `${SLUG}/components/claim-code-workbench.tsx`,
        role: "support",
        contents: readDemoFile(SLUG, "components/claim-code-workbench.tsx"),
      },
      {
        path: `${SLUG}/app/api/claim-check/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/claim-check/route.ts"),
      },
      {
        path: `${SLUG}/app/api/readable/[runId]/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/readable/[runId]/route.ts"),
      },
      {
        path: `${SLUG}/app/api/claim-check/upload/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/claim-check/upload/route.ts"),
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
      route: "/api/claim-check",
      kind: "start",
      load: () => import("@/app/api/claim-check/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
