import { createElement } from "react";
import type { DemoAdapter, DemoCodeFile } from "./types";
import { readDemoFile } from "./read-demo-file";
import { logAdapterEvent } from "./adapter-log";
import { ApprovalChainDemo } from "@/app/components/demos/approval-chain-demo";

const SLUG = "approval-chain";

export const approvalChainAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Approval Chain",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(ApprovalChainDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/approval-chain.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/approval-chain.ts"),
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
        path: `${SLUG}/components/approval-chain-code-workbench.tsx`,
        role: "support",
        contents: readDemoFile(SLUG, "components/approval-chain-code-workbench.tsx"),
      },
      {
        path: `${SLUG}/app/api/approval-chain/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/approval-chain/route.ts"),
      },
      {
        path: `${SLUG}/app/api/readable/[runId]/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/readable/[runId]/route.ts"),
      },
      {
        path: `${SLUG}/app/api/approve/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/approve/route.ts"),
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
      route: "/api/approval-chain",
      kind: "start",
      load: () => import("@/app/api/approval-chain/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
    {
      route: "/api/approve",
      kind: "extra",
      load: () => import("@/app/api/approve/route"),
    },
  ],
};
