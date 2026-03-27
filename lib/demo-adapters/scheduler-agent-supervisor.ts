import { createElement } from "react";
import { SchedulerAgentSupervisorDemo } from "@/app/components/demos/scheduler-agent-supervisor-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "scheduler-agent-supervisor";

export const schedulerAgentSupervisorAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Scheduler Agent Supervisor",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(SchedulerAgentSupervisorDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/scheduler-agent-supervisor.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/scheduler-agent-supervisor.ts"),
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
        path: `${SLUG}/components/scheduler-agent-supervisor-code-workbench.tsx`,
        role: "support",
        contents: readDemoFile(SLUG, "components/scheduler-agent-supervisor-code-workbench.tsx"),
      },
      {
        path: `${SLUG}/components/code-highlight-server.ts`,
        role: "support",
        contents: readDemoFile(SLUG, "components/code-highlight-server.ts"),
      },
      {
        path: `${SLUG}/app/api/scheduler-agent-supervisor/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/scheduler-agent-supervisor/route.ts"),
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
      route: "/api/scheduler-agent-supervisor",
      kind: "start",
      load: () => import("@/app/api/scheduler-agent-supervisor/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
