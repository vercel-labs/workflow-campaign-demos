import { createElement } from "react";
import type { DemoAdapter, DemoCodeFile } from "./types";
import { readDemoFile } from "./read-demo-file";
import { logAdapterEvent } from "./adapter-log";
import { CancellableExportDemo } from "@/app/components/demos/cancellable-export-demo";

const SLUG = "cancellable-export";

const sectionNames = [
  "Introduction",
  "Market Analysis",
  "Technical Architecture",
  "Implementation Plan",
  "Risk Assessment",
  "Financial Projections",
  "Timeline",
  "Team Structure",
  "Competitive Landscape",
  "Conclusion",
];

const sectionContent = [
  "This report analyzes the strategic opportunity for expanding into the European market. We evaluate market conditions, technical requirements, and projected returns over a 24-month horizon.",
  "The European SaaS market is projected to reach $142B by 2027, growing at 14.2% CAGR. Key segments include enterprise automation (38%), developer tools (24%), and data infrastructure (19%).",
  "The proposed architecture uses a multi-region deployment across AWS eu-west-1 and eu-central-1 with active-active failover. Data residency is enforced at the routing layer to meet GDPR requirements.",
  "Phase 1 (Q1): Infrastructure setup and compliance review. Phase 2 (Q2): Beta launch with 10 design partners. Phase 3 (Q3-Q4): General availability and sales ramp across 4 initial markets.",
  "Primary risks include GDPR compliance complexity (mitigated by dedicated DPO hire), currency fluctuation (hedged via forward contracts), and competitive pressure from established EU-native vendors.",
  "Year 1 revenue projection: $2.4M with 340 enterprise accounts. Break-even expected by month 18. Gross margin target of 78% aligns with existing product economics.",
  "Key milestones: regulatory approval (March), beta launch (June), first enterprise close (August), GA announcement (October), 100-customer milestone (December).",
  "Proposed team of 12: 5 engineering (2 backend, 2 infra, 1 frontend), 3 sales, 2 compliance, 1 marketing, 1 operations lead. Initial hires co-located in London office.",
  "Three established competitors hold 67% market share. Our differentiation centers on developer experience and pricing flexibility — areas where incumbents score lowest in customer satisfaction surveys.",
  "The European expansion represents a $12M ARR opportunity within 24 months. With controlled investment and phased rollout, risk-adjusted ROI exceeds 3.2x. We recommend proceeding with Phase 1 immediately.",
];

export const cancellableExportAdapter: DemoAdapter = {
  slug: SLUG,
  title: "Cancellable Export",

  async renderDemo() {
    logAdapterEvent({
      level: "info",
      scope: "adapter",
      adapter: SLUG,
      action: "render_demo_started",
    });

    return createElement(CancellableExportDemo, {
      sectionNames,
      sectionContent,
    });
  },

  async getCodeBundle(): Promise<DemoCodeFile[]> {
    const files: DemoCodeFile[] = [
      {
        path: `${SLUG}/workflows/report-generator.ts`,
        role: "workflow",
        contents: readDemoFile(SLUG, "workflows/report-generator.ts"),
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
        path: `${SLUG}/app/api/cancellable-export/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/cancellable-export/route.ts"),
      },
      {
        path: `${SLUG}/app/api/readable/[runId]/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/readable/[runId]/route.ts"),
      },
      {
        path: `${SLUG}/app/api/run/[runId]/route.ts`,
        role: "api",
        contents: readDemoFile(SLUG, "app/api/run/[runId]/route.ts"),
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
      route: "/api/cancellable-export",
      kind: "start",
      load: () => import("@/app/api/cancellable-export/route"),
    },
    {
      route: "/api/readable/[runId]",
      kind: "readable",
      load: () => import("@/app/api/readable/[runId]/route"),
    },
    {
      route: "/api/run/[runId]",
      kind: "extra",
      load: () => import("@/app/api/run/[runId]/route"),
    },
  ],
};
