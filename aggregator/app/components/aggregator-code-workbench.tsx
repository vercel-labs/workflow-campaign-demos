"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type HighlightTone = "amber" | "cyan" | "green" | "red";
type CopyState = "idle" | "copied" | "failed";

type HighlightStyle = {
  border: string;
  bg: string;
  text: string;
};

const HIGHLIGHT_STYLES: Record<HighlightTone, HighlightStyle> = {
  amber: {
    border: "border-amber-700",
    bg: "bg-amber-700/15",
    text: "text-amber-700",
  },
  cyan: {
    border: "border-cyan-700",
    bg: "bg-cyan-700/15",
    text: "text-cyan-700",
  },
  green: {
    border: "border-green-700",
    bg: "bg-green-700/15",
    text: "text-green-700",
  },
  red: {
    border: "border-red-700",
    bg: "bg-red-700/15",
    text: "text-red-700",
  },
};

const CHECKMARK_POINTS = "3,8.5 7,12.5 14,4.5";
type GutterMarkKind = "success" | "fail";

const GUTTER_LINE_STYLES: Record<GutterMarkKind, { border: string; bg: string; text: string }> = {
  success: { border: "border-green-700", bg: "bg-green-700/15", text: "text-green-700" },
  fail: { border: "border-red-700", bg: "bg-red-700/15", text: "text-red-700" },
};

type CodePaneProps = {
  code: string;
  htmlLines: string[];
  activeLines: number[];
  gutterMarks: Record<number, GutterMarkKind>;
  filename: string;
  subtitle: string;
  tone: HighlightTone;
};

function CodePane({
  code,
  htmlLines,
  activeLines,
  gutterMarks,
  filename,
  subtitle,
  tone,
}: CodePaneProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const activeLineSet = useMemo(() => new Set(activeLines), [activeLines]);
  const gutterMarkMap = useMemo(() => new Map(Object.entries(gutterMarks).map(([k, v]) => [Number(k), v])), [gutterMarks]);
  const prevMarkRef = useRef<Map<number, GutterMarkKind>>(new Map());
  const isFullReset = gutterMarkMap.size === 0 && activeLines.length === 0;

  useEffect(() => {
    if (isFullReset) {
      prevMarkRef.current.clear();
      return;
    }

    gutterMarkMap.forEach((kind, line) => {
      prevMarkRef.current.set(line, kind);
    });
  }, [gutterMarkMap, isFullReset]);

  const highlightStyle = HIGHLIGHT_STYLES[tone];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1200);
    } catch {
      setCopyState("failed");
      window.setTimeout(() => setCopyState("idle"), 1200);
    }
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-gray-300 bg-background-100">
      <div className="flex items-center justify-between border-b border-gray-300 bg-background-100 px-4 py-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-red-700/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-700/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-700/70" />
          </div>
          <span className="text-xs font-mono text-gray-900">{filename}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-gray-900">{subtitle}</span>
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
      </div>

      <div className="max-h-[420px] flex-1 overflow-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-500/40">
        <pre className="text-[13px] leading-5">
          <code className="font-mono">
            {htmlLines.map((lineHtml, index) => {
              const lineNumber = index + 1;
              const isActive = activeLineSet.has(lineNumber);
              const markKind = gutterMarkMap.get(lineNumber);
              const displayKind = isFullReset
                ? undefined
                : markKind ?? prevMarkRef.current.get(lineNumber);
              const gutterStyle = markKind ? GUTTER_LINE_STYLES[markKind] : null;

              return (
                <div
                  key={lineNumber}
                  className={`flex min-w-max border-l-2 transition-colors duration-300 ${
                    gutterStyle
                      ? `${gutterStyle.border} ${gutterStyle.bg}`
                      : isActive
                        ? `${highlightStyle.border} ${highlightStyle.bg}`
                        : "border-transparent"
                  }`}
                >
                  <span
                    className={`flex w-4 shrink-0 items-center justify-center py-0.5 transition-opacity duration-500 ${
                      displayKind === "fail" ? "text-red-700" : "text-green-700"
                    } ${markKind ? "opacity-100" : "opacity-0"}`}
                    aria-hidden="true"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
                    >
                      {displayKind === "fail" ? (
                        <>
                          <line x1="4" y1="4" x2="12" y2="12" />
                          <line x1="12" y1="4" x2="4" y2="12" />
                        </>
                      ) : (
                        <polyline points={CHECKMARK_POINTS} />
                      )}
                    </svg>
                  </span>
                  <span
                    className={`w-8 shrink-0 select-none border-r border-gray-300/80 py-0.5 pr-2 text-right text-xs tabular-nums ${
                      gutterStyle ? gutterStyle.text : isActive ? highlightStyle.text : "text-gray-900"
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

export type AggregatorCodeWorkbenchProps = {
  workflowCode: string;
  workflowHtmlLines: string[];
  workflowActiveLines: number[];
  workflowGutterMarks: Record<number, GutterMarkKind>;
  stepCode: string;
  stepHtmlLines: string[];
  stepActiveLines: number[];
  stepGutterMarks: Record<number, GutterMarkKind>;
  tone: HighlightTone;
};

export function AggregatorCodeWorkbench({
  workflowCode,
  workflowHtmlLines,
  workflowActiveLines,
  workflowGutterMarks,
  stepCode,
  stepHtmlLines,
  stepActiveLines,
  stepGutterMarks,
  tone,
}: AggregatorCodeWorkbenchProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <CodePane
        code={workflowCode}
        htmlLines={workflowHtmlLines}
        activeLines={workflowActiveLines}
        gutterMarks={workflowGutterMarks}
        filename="workflows/aggregator.ts"
        subtitle="use workflow"
        tone={tone}
      />
      <CodePane
        code={stepCode}
        htmlLines={stepHtmlLines}
        activeLines={stepActiveLines}
        gutterMarks={stepGutterMarks}
        filename="workflows/aggregator.ts"
        subtitle="use step"
        tone={tone}
      />
    </div>
  );
}
