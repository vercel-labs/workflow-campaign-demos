"use client";

import { useState } from "react";

type ActiveLines = {
  workflow: number[];
  step: number[];
};

type GutterMarks = {
  workflow?: Record<number, boolean>;
  step?: Record<number, boolean>;
};

type CopyState = "idle" | "copied" | "failed";

type CodePaneProps = {
  code: string;
  linesHtml: string[];
  filename: string;
  label: string;
  activeLines: Set<number>;
  gutterMarks?: Record<number, boolean>;
  completed: boolean;
};

function CodePane({
  code,
  linesHtml,
  filename,
  label,
  activeLines,
  gutterMarks,
  completed,
}: CodePaneProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const highlightBorder = completed ? "border-green-700" : "border-amber-700";
  const highlightBg = completed ? "bg-green-700/15" : "bg-amber-700/15";
  const highlightText = completed ? "text-green-700" : "text-amber-700";

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
          <span className="rounded border border-gray-400 px-2 py-0.5 text-[11px] font-mono text-gray-900">
            {label}
          </span>
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
              const isActive = activeLines.has(lineNumber);
              const hasMark = gutterMarks?.[lineNumber] === true;

              return (
                <div
                  key={lineNumber}
                  className={`flex min-w-max border-l-2 transition-colors duration-200 ${
                    isActive
                      ? `${highlightBorder} ${highlightBg}`
                      : "border-transparent"
                  }`}
                >
                  <span className="flex w-3 shrink-0 items-center justify-center py-0.5" aria-hidden="true">
                    {hasMark ? (
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3.5 w-3.5 text-green-700"
                      >
                        <polyline points="3,8.5 7,12.5 14,4.5" />
                      </svg>
                    ) : null}
                  </span>
                  <span
                    className={`w-8 shrink-0 select-none border-r border-gray-300/80 py-0.5 pr-2 text-right text-xs tabular-nums ${
                      isActive ? highlightText : "text-gray-900"
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

export type RoutingSlipCodeWorkbenchProps = {
  workflowCode: string;
  workflowLinesHtml: string[];
  stepCode: string;
  stepLinesHtml: string[];
  activeLines: ActiveLines;
  gutterMarks?: GutterMarks;
  completed?: boolean;
};

export function RoutingSlipCodeWorkbench({
  workflowCode,
  workflowLinesHtml,
  stepCode,
  stepLinesHtml,
  activeLines,
  gutterMarks,
  completed = false,
}: RoutingSlipCodeWorkbenchProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <CodePane
        code={workflowCode}
        linesHtml={workflowLinesHtml}
        filename="workflows/routing-slip.ts"
        label="workflow fn"
        activeLines={new Set(activeLines.workflow)}
        gutterMarks={gutterMarks?.workflow}
        completed={completed}
      />
      <CodePane
        code={stepCode}
        linesHtml={stepLinesHtml}
        filename="workflows/routing-slip.ts"
        label="step fn"
        activeLines={new Set(activeLines.step)}
        gutterMarks={gutterMarks?.step}
        completed={completed}
      />
    </div>
  );
}
