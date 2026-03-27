import { createElement } from "react";
import { GuaranteedDeliveryDemo } from "@/app/components/demos/guaranteed-delivery-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "guaranteed-delivery";

export const guaranteedDeliveryAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Guaranteed Delivery",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(GuaranteedDeliveryDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/guaranteed-delivery.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/guaranteed-delivery.ts"),
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
        path: `${SLUG}/app/api/guaranteed-delivery/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/guaranteed-delivery/route.ts"),
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
      route: "/api/guaranteed-delivery",
      kind: "start",
      load: () => import("@/app/api/guaranteed-delivery/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
