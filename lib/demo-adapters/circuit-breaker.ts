import { createElement } from "react";
import { CircuitBreakerDemo } from "@/app/components/demos/circuit-breaker-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "circuit-breaker";

export const circuitBreakerAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Circuit Breaker",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(CircuitBreakerDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/circuit-breaker.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/circuit-breaker.ts"),
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
        path: `${SLUG}/app/components/circuit-code-workbench.tsx`,
        role: "support",
        contents: readDemoFile(SLUG, "app/components/circuit-code-workbench.tsx"),
      },
      {
        path: `${SLUG}/app/api/circuit-breaker/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/circuit-breaker/route.ts"),
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
      route: "/api/circuit-breaker",
      kind: "start",
      load: () => import("@/app/api/circuit-breaker/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
