import { createElement } from "react";
import type { DemoAdapter, DemoCodeFile } from "./types";
import { readDemoFile } from "./read-demo-file";
import { logAdapterEvent } from "./adapter-log";

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

    const codeBundle = await this.getCodeBundle();
    const workflowFile = codeBundle.find((file) => file.role === "workflow");

    return createElement(
      "section",
      {
        className: "rounded-lg border border-gray-400 bg-background-200 p-6",
      },
      workflowFile
        ? createElement(
            "pre",
            {
              className:
                "max-h-[520px] overflow-auto rounded-md border border-gray-300 bg-background-100 p-4 text-xs leading-relaxed text-gray-1000",
            },
            createElement(
              "code",
              {
                className: "font-mono",
              },
              workflowFile.contents,
            ),
          )
        : createElement(
            "p",
            {
              className: "text-sm text-red-700",
            },
            "Missing workflow source.",
          ),
    );
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/approval-chain.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/approval-chain.ts"),
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
