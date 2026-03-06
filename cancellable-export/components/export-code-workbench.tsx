"use client";

import { useState } from "react";

const EMPTY_HIGHLIGHT_SET = new Set<number>();

type HighlightStyle = {
  border: string;
  bg: string;
  text: string;
};

const HIGHLIGHT_STYLES: HighlightStyle[] = [
  { border: "border-amber-700", bg: "bg-amber-700/15", text: "text-amber-700" },
  { border: "border-red-700", bg: "bg-red-700/15", text: "text-red-700" },
  { border: "border-green-700", bg: "bg-green-700/15", text: "text-green-700" },
];

const GUTTER_CHECK_COLORS = ["text-amber-700", "text-green-700"];
const CHECK_POINTS = "3,8.5 7,12.5 14,4.5";
const STEP_FILENAMES = ["generateSection()"];

type CopyState = "idle" | "copied" | "failed";

function CodePane({
  linesHtml,
  highlightLines,
  highlightStyle,
  lineHighlights,
  gutterMarks,
  activeSendSteps,
  filename,
  code,
}: {
  linesHtml: string[];
  highlightLines: Set<number>;
  highlightStyle: HighlightStyle;
  lineHighlights?: Record<number, number>;
  gutterMarks?: Record<number, number>;
  activeSendSteps?: Set<number>;
  filename: string;
  code: string;
}) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1400);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 1400);
    }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-300 bg-background-200">
      <div className="flex items-center justify-between border-b border-gray-300 bg-background-100 px-4 py-2">
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
              const perLineColorIdx = lineHighlights?.[lineNumber];
              const perLineStyle =
                perLineColorIdx !== undefined
                  ? HIGHLIGHT_STYLES[perLineColorIdx]
                  : undefined;
              const isHighlighted =
                perLineStyle !== undefined || highlightLines.has(lineNumber);
              const activeStyle = perLineStyle ?? highlightStyle;

              return (
                <div
                  key={lineNumber}
                  data-line={lineNumber}
                  className={`flex min-w-max border-l-2 transition-colors duration-300 ${
                    isHighlighted
                      ? `${activeStyle.border} ${activeStyle.bg}`
                      : "border-transparent"
                  }`}
                >
                  <span className="flex w-3 shrink-0 items-center justify-center py-0.5" aria-hidden="true">
                    {gutterMarks?.[lineNumber] !== undefined && (
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`h-3.5 w-3.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] transition-opacity duration-500 ${
                          GUTTER_CHECK_COLORS[gutterMarks[lineNumber]]
                        } ${
                          activeSendSteps?.has(gutterMarks[lineNumber])
                            ? "opacity-100"
                            : "opacity-20"
                        }`}
                        aria-hidden="true"
                      >
                        <polyline points={CHECK_POINTS} />
                      </svg>
                    )}
                  </span>
                  <span
                    className={`w-8 shrink-0 select-none border-r border-gray-300/80 pr-2 py-0.5 text-right text-xs tabular-nums ${
                      isHighlighted ? activeStyle.text : "text-gray-900"
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

export type ExportCodeWorkbenchProps = {
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

export type ApiCodeWorkbenchProps = {
  leftCode: string;
  leftLinesHtml: string[];
  leftFilename: string;
  leftLineHighlights: Record<number, number>;
  rightCode: string;
  rightLinesHtml: string[];
  rightFilename: string;
  rightLineHighlights: Record<number, number>;
};

export function ApiCodeWorkbench({
  leftCode,
  leftLinesHtml,
  leftFilename,
  leftLineHighlights,
  rightCode,
  rightLinesHtml,
  rightFilename,
  rightLineHighlights,
}: ApiCodeWorkbenchProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <CodePane
        linesHtml={leftLinesHtml}
        highlightLines={EMPTY_HIGHLIGHT_SET}
        highlightStyle={HIGHLIGHT_STYLES[0]}
        lineHighlights={leftLineHighlights}
        filename={leftFilename}
        code={leftCode}
      />
      <CodePane
        linesHtml={rightLinesHtml}
        highlightLines={EMPTY_HIGHLIGHT_SET}
        highlightStyle={HIGHLIGHT_STYLES[0]}
        lineHighlights={rightLineHighlights}
        filename={rightFilename}
        code={rightCode}
      />
    </div>
  );
}

export function ExportCodeWorkbench({
  workflowCode,
  workflowLinesHtml,
  stepCodes,
  stepLinesHtml,
  activeStepIndex,
  highlightLines,
  highlightColorIndex,
  gutterMarks,
  activeSendSteps,
}: ExportCodeWorkbenchProps) {
  const workflowHighlightLineSet = new Set(highlightLines);
  const activeHighlightStyle =
    HIGHLIGHT_STYLES[highlightColorIndex] ?? HIGHLIGHT_STYLES[0];

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
        filename="workflows/report-generator.ts"
        code={workflowCode}
      />
      <CodePane
        linesHtml={currentStepLinesHtml}
        highlightLines={EMPTY_HIGHLIGHT_SET}
        highlightStyle={activeHighlightStyle}
        filename={STEP_FILENAMES[stepIndex] ?? "step"}
        code={currentStepCode}
      />
    </div>
  );
}
