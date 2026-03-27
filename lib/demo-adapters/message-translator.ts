import { createElement } from "react";
import { MessageTranslatorDemo } from "@/app/components/demos/message-translator-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "message-translator";

export const messageTranslatorAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Message Translator",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(MessageTranslatorDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/message-translator.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/message-translator.ts"),
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
        path: `${SLUG}/app/api/message-translator/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/message-translator/route.ts"),
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
      route: "/api/message-translator",
      kind: "start",
      load: () => import("@/app/api/message-translator/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
  ],
};
