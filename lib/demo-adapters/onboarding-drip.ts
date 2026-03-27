import { createElement } from "react";
import { OnboardingDripDemo } from "@/app/components/demos/onboarding-drip-demo";
import { logAdapterEvent } from "./adapter-log";
import { readDemoFile } from "./read-demo-file";
import type { DemoAdapter, DemoCodeFile } from "./types";

const SLUG = "onboarding-drip";

export const onboardingDripAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Onboarding Drip",

  async renderDemo() {
    logAdapterEvent({ level: "info", scope: "adapter", adapter: SLUG, action: "render_demo_started" });
    return createElement(OnboardingDripDemo);
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      { path: `${SLUG}/workflows/onboarding-drip.ts`, role: "workflow", contents: readDemoFile(SLUG, "workflows/onboarding-drip.ts") },
      { path: `${SLUG}/app/api/onboarding/route.ts`, role: "api", contents: readDemoFile(SLUG, "app/api/onboarding/route.ts") },
      { path: `${SLUG}/app/api/readable/[runId]/route.ts`, role: "api", contents: readDemoFile(SLUG, "app/api/readable/[runId]/route.ts") },
    ];

    logAdapterEvent({ level: "info", scope: "adapter", adapter: SLUG, action: "get_code_bundle_succeeded", fileCount: files.length });
    return files;
  },

  apiRoutes: [
    { route: "/api/onboarding-drip", kind: "start", load: () => import("@/app/api/onboarding-drip/route") },
    { route: "/api/readable/[runId]", kind: "readable", load: () => import("@/app/api/readable/[runId]/route") },
  ],
};
