import { createElement } from "react";
import { WebhookBasicsDemo } from "@/app/components/demos/webhook-basics-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "webhook-basics";

export const webhookBasicsAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Webhook Basics",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(WebhookBasicsDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/payment-webhook.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/payment-webhook.ts"),
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
        path: `${SLUG}/app/api/webhook-basics/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/webhook-basics/route.ts"),
      },
      {
        path: `${SLUG}/app/api/webhook/[token]/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/webhook/[token]/route.ts"),
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
      route: "/api/webhook-basics",
      kind: "start",
      load: () => import("@/app/api/webhook-basics/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
