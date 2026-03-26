import { createElement } from "react";
import type { DemoAdapter, DemoCodeFile } from "./types";
import { readDemoFile } from "./read-demo-file";
import { logAdapterEvent } from "./adapter-log";

const SLUG = "fan-out";

export const fanOutAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Fan-Out Notifications",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    const codeBundle = await this.getCodeBundle();
    const workflowFile = codeBundle.find((f) => f.role === "workflow");

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
        path: `${SLUG}/workflows/incident-fanout.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/incident-fanout.ts"),
      },
      {
        path: `${SLUG}/app/api/fan-out/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/fan-out/route.ts"),
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
      route: "/api/fan-out",
      kind: "start",
      load: () => import("@/app/api/fan-out/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
