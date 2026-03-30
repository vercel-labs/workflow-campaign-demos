// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
import {
  findLineNumbers,
  highlightCodeToHtmlLines,
} from "@/lib/code-workbench.server";

const directiveUseWorkflow = `"use ${"workflow"}"`;
const directiveUseStep = `"use ${"step"}"`;

type HighlightLineMap = {
  generateLines: number[];
};

export type CancellableExportCodeProps = {
  workflowCode: string;
  workflowLinesHtml: string[];
  stepCodes: string[];
  stepLinesHtml: string[][];
  highlightLineMap: HighlightLineMap;
  sectionNames: string[];
  sectionContent: string[];
};

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

const workflowCode = `// Each await is a cancellation checkpoint —
// run.cancel() takes effect between steps.
export async function generateReport(
  accountId: string,
  systemPrompt: string
) {
  ${directiveUseWorkflow};

  const intro = await generateSection("Introduction", systemPrompt);
  const market = await generateSection("Market Analysis", intro);
  const tech = await generateSection("Technical Architecture", market);
  const plan = await generateSection("Implementation Plan", tech);
  const risks = await generateSection("Risk Assessment", plan);
  const finance = await generateSection("Financial Projections", risks);
  const timeline = await generateSection("Timeline", finance);
  const team = await generateSection("Team Structure", timeline);
  const landscape = await generateSection("Competitive Landscape", team);
  const conclusion = await generateSection("Conclusion", landscape);

  return { accountId, report: conclusion, status: "completed" };
}`;

const stepCodes = [
  `async function generateSection(
  title: string,
  previous?: string | { title: string }
) {
  ${directiveUseStep};

  const previousTitle =
    typeof previous === "string" ? previous : previous?.title;

  const { text } = await generateText({
    model: "anthropic/claude-sonnet-4.5",
    system: previousTitle
      ? \`You are a professional writer. Previous section: \${previousTitle}\`
      : "You are a professional writer.",
    prompt: \`Write the "\${title}" section of a strategic report.\`,
  });

  return { title, content: text, status: "generated" };
}`,
];

function buildHighlightLineMap(code: string): HighlightLineMap {
  return {
    generateLines: findLineNumbers(code, "await generateSection("),
  };
}

export function getCancellableExportCodeProps(): CancellableExportCodeProps {
  return {
    workflowCode,
    workflowLinesHtml: highlightCodeToHtmlLines(workflowCode),
    stepCodes,
    stepLinesHtml: stepCodes.map((code) => highlightCodeToHtmlLines(code)),
    highlightLineMap: buildHighlightLineMap(workflowCode),
    sectionNames,
    sectionContent,
  };
}
