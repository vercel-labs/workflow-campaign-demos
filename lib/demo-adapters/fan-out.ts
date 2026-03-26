import { createElement } from "react";
import type { DemoAdapter, DemoCodeFile } from "./types";
import { readDemoFile } from "./read-demo-file";

const SLUG = "fan-out";

export const fanOutAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Fan-Out Notifications",

  async renderPage() {
    const codeBundle = await this.getCodeBundle();
    const workflowFile = codeBundle.find((f) => f.role === "workflow");

    return createElement(
      "main",
      {
        className:
          "min-h-screen bg-[#0a0a0a] text-white px-6 py-12 max-w-4xl mx-auto",
      },
      createElement(
        "header",
        { className: "mb-8" },
        createElement(
          "a",
          {
            href: "/",
            className:
              "text-sm text-neutral-500 hover:text-neutral-300 transition-colors",
          },
          "\u2190 Gallery"
        ),
        createElement(
          "h1",
          {
            className:
              "text-2xl font-semibold mt-4 font-[family-name:var(--font-geist-sans)]",
          },
          "Fan-Out Notifications"
        )
      ),
      createElement(
        "section",
        { className: "mb-8" },
        createElement(
          "div",
          { className: "flex gap-3 flex-wrap" },
          ...this.apiRoutes.map((r) =>
            createElement(
              "span",
              {
                key: r.route,
                className:
                  "text-xs px-2 py-1 rounded bg-neutral-800 text-neutral-400 font-mono",
              },
              `${r.kind}: ${r.route}`
            )
          )
        )
      ),
      workflowFile
        ? createElement(
            "section",
            {
              className:
                "rounded-lg border border-neutral-800 bg-neutral-900/50 p-6",
            },
            createElement(
              "h2",
              { className: "text-sm font-medium text-neutral-400 mb-3" },
              "Workflow Source"
            ),
            createElement(
              "pre",
              {
                className:
                  "text-xs text-neutral-300 overflow-x-auto font-mono leading-relaxed max-h-96 overflow-y-auto",
              },
              createElement("code", null, workflowFile.contents)
            )
          )
        : null
    );
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [];

    files.push({
      path: `${SLUG}/workflows/incident-fanout.ts`,
      role: "workflow",
      contents: readDemoFile(SLUG, "workflows/incident-fanout.ts"),
    });

    files.push({
      path: `${SLUG}/app/api/fan-out/route.ts`,
      role: "api",
      contents: readDemoFile(SLUG, "app/api/fan-out/route.ts"),
    });

    files.push({
      path: `${SLUG}/app/api/readable/[runId]/route.ts`,
      role: "api",
      contents: readDemoFile(SLUG, "app/api/readable/[runId]/route.ts"),
    });

    console.info(
      JSON.stringify({
        level: "info",
        adapter: SLUG,
        action: "getCodeBundle",
        fileCount: files.length,
      })
    );

    return files;
  },

  apiRoutes: [
    {
      route: "/api/fan-out",
      kind: "start",
      load: async () => ({}),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: async () => ({}),
    },
  ],
};
