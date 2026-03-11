"use client";

import { useEffect, useRef } from "react";

type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail";

type HighlightStyle = {
  border: string;
  bg: string;
  text: string;
};

const HIGHLIGHT_STYLES: Record<HighlightTone, HighlightStyle> = {
  amber: { border: "border-amber-700", bg: "bg-amber-700/15", text: "text-amber-700" },
  cyan: { border: "border-cyan-700", bg: "bg-cyan-700/15", text: "text-cyan-700" },
  green: { border: "border-green-700", bg: "bg-green-700/15", text: "text-green-700" },
  red: { border: "border-red-700", bg: "bg-red-700/15", text: "text-red-700" },
};

const GUTTER_LINE_STYLES: Record<GutterMarkKind, { border: string; bg: string; text: string }> = {
  success: { border: "border-green-700", bg: "bg-green-700/15", text: "text-green-700" },
  fail: { border: "border-red-700", bg: "bg-red-700/15", text: "text-red-700" },
};

type CodeWorkbenchProps = {
  workflowCode: string;
  workflowLinesHtml: string[];
  workflowActiveLines: number[];
  workflowGutterMarks: Record<number, GutterMarkKind>;
  stepCode: string;
  stepLinesHtml: string[];
  stepActiveLines: number[];
  stepGutterMarks: Record<number, GutterMarkKind>;
  tone: HighlightTone;
};

export function BulkheadCodeWorkbench({
  workflowLinesHtml,
  workflowActiveLines,
  workflowGutterMarks,
  stepLinesHtml,
  stepActiveLines,
  stepGutterMarks,
  tone,
}: CodeWorkbenchProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <CodePane
        filename="bulkhead.ts"
        label="use workflow"
        linesHtml={workflowLinesHtml}
        activeLines={workflowActiveLines}
        gutterMarks={workflowGutterMarks}
        tone={tone}
      />
      <CodePane
        filename="bulkhead.ts"
        label="use step"
        linesHtml={stepLinesHtml}
        activeLines={stepActiveLines}
        gutterMarks={stepGutterMarks}
        tone={tone}
      />
    </div>
  );
}

function CodePane({
  filename,
  label,
  linesHtml,
  activeLines,
  gutterMarks,
  tone,
}: {
  filename: string;
  label: string;
  linesHtml: string[];
  activeLines: number[];
  gutterMarks: Record<number, GutterMarkKind>;
  tone: HighlightTone;
}) {
  const activeSet = new Set(activeLines);
  const style = HIGHLIGHT_STYLES[tone];

  return (
    <div className="overflow-hidden rounded-lg border border-gray-400">
      <div className="flex items-center justify-between border-b border-gray-400 bg-background-200 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-700/60" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-700/60" aria-hidden="true" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-700/60" aria-hidden="true" />
          <span className="ml-1 text-xs text-gray-900">{filename}</span>
        </div>
        <span className="rounded bg-gray-300 px-1.5 py-0.5 text-xs text-gray-900">{label}</span>
      </div>
      <pre className="overflow-x-auto bg-background-100 py-3 text-[13px] leading-5">
        <code className="font-mono">
          {linesHtml.map((lineHtml, i) => {
            const lineNumber = i + 1;
            const isActive = activeSet.has(lineNumber);
            const markKind = gutterMarks[lineNumber];
            const gutterStyle = markKind ? GUTTER_LINE_STYLES[markKind] : null;

            return (
              <div
                key={i}
                className={`flex px-3 ${
                  gutterStyle
                    ? `border-l-2 ${gutterStyle.border} ${gutterStyle.bg}`
                    : isActive ? `border-l-2 ${style.border} ${style.bg}` : "border-l-2 border-transparent"
                }`}
              >
                <span className={`mr-3 inline-block w-6 text-right text-xs tabular-nums select-none ${gutterStyle ? gutterStyle.text : "text-gray-900"}`}>
                  {markKind ? (
                    <GutterMark kind={markKind} />
                  ) : (
                    lineNumber
                  )}
                </span>
                <span dangerouslySetInnerHTML={{ __html: lineHtml || " " }} />
              </div>
            );
          })}
        </code>
      </pre>
    </div>
  );
}

function GutterMark({ kind }: { kind: GutterMarkKind }) {
  const prevRef = useRef<GutterMarkKind>(kind);
  useEffect(() => {
    prevRef.current = kind;
  }, [kind]);

  if (kind === "success") {
    return (
      <svg className="inline h-3.5 w-3.5 text-green-700 transition-opacity duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }

  return (
    <svg className="inline h-3.5 w-3.5 text-red-700 transition-opacity duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
