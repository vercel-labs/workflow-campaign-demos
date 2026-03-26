"use client";

import { useState } from "react";

const EMPTY_HIGHLIGHT_SET = new Set<number>();

type HighlightStyle = {
  border: string;
  bg: string;
  text: string;
};

const HIGHLIGHT_STYLES: HighlightStyle[] = [
  { border: "border-green-700", bg: "bg-green-700/15", text: "text-green-700" },
  { border: "border-blue-700", bg: "bg-blue-700/15", text: "text-blue-700" },
  { border: "border-violet-700", bg: "bg-violet-700/15", text: "text-violet-700" },
  { border: "border-amber-700", bg: "bg-amber-700/15", text: "text-amber-700" },
];

export const SEND_CHECK_COLORS = ["text-rose-500", "text-cyan-500", "text-amber-500", "text-fuchsia-500"];
export const SEND_BG_COLORS = ["bg-rose-500", "bg-cyan-500", "bg-amber-500", "bg-fuchsia-500"];

const STEP_HEADER_BG = ["bg-rose-500/10", "bg-cyan-500/10", "bg-amber-500/10", "bg-fuchsia-500/10"];

const CHECK_POINTS = "3,8.5 7,12.5 14,4.5";
const COPY_FEEDBACK_MS = 1400;

type OnboardingCodeWorkbenchProps = {
  workflowCode: string;
  workflowLinesHtml: string[];
  stepCodes: string[];
  stepLinesHtml: string[][];
  activeStepIndex: number;
  highlightLines: number[];
  highlightColorIndex: number;
  gutterMarks: Record<number, number>;
  activeSendSteps: Set<number>;
};

type CopyState = "idle" | "copied" | "failed";

function CodePane({
  linesHtml,
  highlightLines,
  highlightStyle,
  gutterMarks,
  activeSendSteps,
  filename,
  code,
  headerBgClass,
}: {
  linesHtml: string[];
  highlightLines: Set<number>;
  highlightStyle: HighlightStyle;
  gutterMarks?: Record<number, number>;
  activeSendSteps?: Set<number>;
  filename: string;
  code: string;
  headerBgClass?: string;
}) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), COPY_FEEDBACK_MS);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), COPY_FEEDBACK_MS);
    }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-300 bg-background-200">
      <div className={`flex items-center justify-between border-b border-gray-300 ${headerBgClass ?? "bg-background-100"} px-4 py-2`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-red-700/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-700/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-700/70" />
          </div>
          <span className="text-xs font-mono text-gray-900">{filename}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="cursor-pointer rounded-md border border-gray-400 px-2.5 py-1 text-xs font-medium text-gray-900 transition-colors hover:border-gray-300 hover:text-gray-1000"
        >
          {copyState === "copied"
            ? "Copied"
            : copyState === "failed"
              ? "Failed"
              : "Copy"}
        </button>
      </div>
      <div className="flex-1 overflow-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-500/40">
        <pre className="text-[13px] leading-5">
          <code className="font-mono">
            {linesHtml.map((lineHtml, index) => {
              const lineNumber = index + 1;
              const isHighlighted = highlightLines.has(lineNumber);

              return (
                <div
                  key={lineNumber}
                  data-line={lineNumber}
                  className={`flex min-w-max border-l-2 transition-colors duration-300 ${
                    isHighlighted
                      ? `${highlightStyle.border} ${highlightStyle.bg}`
                      : "border-transparent"
                  }`}
                >
                  <span className="flex w-3 shrink-0 items-center justify-center py-0.5" aria-hidden="true">
                    {gutterMarks?.[lineNumber] !== undefined && (
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={`h-3.5 w-3.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] transition-opacity duration-500 ${SEND_CHECK_COLORS[gutterMarks[lineNumber]]} ${activeSendSteps?.has(gutterMarks[lineNumber]) ? "opacity-100" : "opacity-20"}`} aria-hidden="true">
                        <polyline points={CHECK_POINTS} />
                      </svg>
                    )}
                  </span>
                  <span
                    className={`w-8 shrink-0 select-none border-r border-gray-300/80 pr-2 py-0.5 text-right text-xs tabular-nums ${
                      isHighlighted ? highlightStyle.text : "text-gray-900"
                    }`}
                    aria-hidden="true"
                  >
                    {lineNumber}
                  </span>
                  <span
                    className="block flex-1 px-3 py-0.5 text-gray-1000"
                    dangerouslySetInnerHTML={{
                      __html: lineHtml.length > 0 ? lineHtml : "&nbsp;",
                    }}
                  />
                </div>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}

export function OnboardingCodeWorkbench({
  workflowCode,
  workflowLinesHtml,
  stepCodes,
  stepLinesHtml,
  activeStepIndex,
  highlightLines,
  highlightColorIndex,
  gutterMarks,
  activeSendSteps,
}: OnboardingCodeWorkbenchProps) {
  const workflowHighlightLineSet = new Set(highlightLines);
  const activeHighlightStyle = HIGHLIGHT_STYLES[highlightColorIndex] ?? HIGHLIGHT_STYLES[0];

  const stepIndex = activeStepIndex >= 0 ? activeStepIndex : 0;
  const currentStepLinesHtml = stepLinesHtml[stepIndex] ?? [];
  const currentStepCode = stepCodes[stepIndex] ?? "";

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <CodePane
        linesHtml={workflowLinesHtml}
        highlightLines={workflowHighlightLineSet}
        highlightStyle={activeHighlightStyle}
        gutterMarks={gutterMarks}
        activeSendSteps={activeSendSteps}
        filename="workflows/onboarding-drip.ts"
        code={workflowCode}
      />
      <CodePane
        linesHtml={currentStepLinesHtml}
        highlightLines={EMPTY_HIGHLIGHT_SET}
        highlightStyle={activeHighlightStyle}
        filename="workflows/onboarding-drip.ts"
        code={currentStepCode}
        headerBgClass={STEP_HEADER_BG[stepIndex]}
      />
    </div>
  );
}
