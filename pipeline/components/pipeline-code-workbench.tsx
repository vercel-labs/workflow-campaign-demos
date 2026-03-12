"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type PaneKey = "workflow" | "step";
type MarkStatus = "success" | "fail";
type Tone = "active" | "waiting" | "success" | "failure";
type CopyState = "idle" | "copied" | "failed";

type ToneStyle = {
  border: string;
  bg: string;
  text: string;
};

const EMPTY_LINE_LIST: number[] = [];

const GUTTER_LINE_STYLES: Record<MarkStatus, { border: string; bg: string; text: string }> = {
  success: { border: "border-green-700", bg: "bg-green-700/15", text: "text-green-700" },
  fail: { border: "border-red-700", bg: "bg-red-700/15", text: "text-red-700" },
};

const TONE_STYLES: Record<Tone, ToneStyle> = {
  active: {
    border: "border-amber-700",
    bg: "bg-amber-700/15",
    text: "text-amber-700",
  },
  waiting: {
    border: "border-cyan-700",
    bg: "bg-cyan-700/15",
    text: "text-cyan-700",
  },
  success: {
    border: "border-green-700",
    bg: "bg-green-700/15",
    text: "text-green-700",
  },
  failure: {
    border: "border-red-700",
    bg: "bg-red-700/15",
    text: "text-red-700",
  },
};

function GutterGlyph({
  mark,
  visible,
}: {
  mark: MarkStatus;
  visible: boolean;
}) {
  const color = mark === "success" ? "text-green-700" : "text-red-700";

  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-3.5 w-3.5 ${color} transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden="true"
    >
      {mark === "success" ? (
        <polyline points="3,8.5 7,12.5 14,4.5" />
      ) : (
        <>
          <line x1="4" y1="4" x2="12" y2="12" />
          <line x1="12" y1="4" x2="4" y2="12" />
        </>
      )}
    </svg>
  );
}

function CodePane({
  linesHtml,
  filename,
  directive,
  code,
  activeLines,
  tone,
  gutterMarks,
  resetKey,
}: {
  linesHtml: string[];
  filename: string;
  directive: string;
  code: string;
  activeLines: number[];
  tone: Tone;
  gutterMarks?: Record<number, MarkStatus>;
  resetKey: number;
}) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const activeLineSet = useMemo(() => new Set(activeLines), [activeLines]);
  const prevMarkRef = useRef<Record<number, MarkStatus>>({});

  useEffect(() => {
    prevMarkRef.current = {};
  }, [resetKey]);

  const toneStyle = TONE_STYLES[tone];

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
      <div className="flex items-center justify-between border-b border-gray-300 bg-background-100 px-3 py-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-red-700/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-700/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-700/70" />
          </div>
          <span className="text-xs font-mono text-gray-900">{filename}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-gray-400 px-2 py-0.5 text-xs font-mono text-gray-900">
            {directive}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="cursor-pointer rounded border border-gray-400 px-2 py-0.5 text-xs text-gray-900 transition-colors hover:border-gray-300 hover:text-gray-1000"
          >
            {copyState === "copied"
              ? "Copied"
              : copyState === "failed"
                ? "Failed"
                : "Copy"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-500/40 [&::-webkit-scrollbar-track]:bg-transparent">
        <pre className="text-[13px] leading-5">
          <code className="font-mono">
            {linesHtml.map((lineHtml, index) => {
              const lineNumber = index + 1;
              const isActive = activeLineSet.has(lineNumber);
              const liveMark = gutterMarks?.[lineNumber];
              if (liveMark) {
                prevMarkRef.current[lineNumber] = liveMark;
              }
              const stableMark = liveMark ?? prevMarkRef.current[lineNumber];
              const markVisible = liveMark !== undefined;
              const gutterStyle = liveMark ? GUTTER_LINE_STYLES[liveMark] : null;

              return (
                <div
                  key={lineNumber}
                  data-line={lineNumber}
                  className={`flex min-w-max border-l-2 transition-colors duration-300 ${
                    gutterStyle
                      ? `${gutterStyle.border} ${gutterStyle.bg}`
                      : isActive
                        ? `${toneStyle.border} ${toneStyle.bg}`
                        : "border-transparent"
                  }`}
                >
                  <span
                    className="flex w-4 shrink-0 items-center justify-center py-0.5"
                    aria-hidden="true"
                  >
                    {stableMark ? (
                      <GutterGlyph mark={stableMark} visible={markVisible} />
                    ) : null}
                  </span>
                  <span
                    className={`w-8 shrink-0 select-none border-r border-gray-300/80 py-0.5 pr-2 text-right text-xs tabular-nums ${
                      gutterStyle ? gutterStyle.text : isActive ? toneStyle.text : "text-gray-900"
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

export type PipelineCodeWorkbenchProps = {
  workflowLinesHtml: string[];
  stepLinesHtml: string[];
  workflowCode: string;
  stepCode: string;
  workflowDirective: string;
  stepDirective: string;
  workflowFilename?: string;
  stepFilename?: string;
  activeLines: Record<PaneKey, number[]>;
  activeTones?: Partial<Record<PaneKey, Tone>>;
  gutterMarks: Record<number, MarkStatus>;
  resetKey?: number;
};

export function PipelineCodeWorkbench({
  workflowLinesHtml,
  stepLinesHtml,
  workflowCode,
  stepCode,
  workflowDirective,
  stepDirective,
  workflowFilename = "workflows/pipeline.ts",
  stepFilename = "workflows/pipeline.ts",
  activeLines,
  activeTones,
  gutterMarks,
  resetKey = 0,
}: PipelineCodeWorkbenchProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <CodePane
        linesHtml={workflowLinesHtml}
        filename={workflowFilename}
        directive={workflowDirective}
        code={workflowCode}
        activeLines={activeLines.workflow ?? EMPTY_LINE_LIST}
        tone={activeTones?.workflow ?? "active"}
        gutterMarks={gutterMarks}
        resetKey={resetKey}
      />
      <CodePane
        linesHtml={stepLinesHtml}
        filename={stepFilename}
        directive={stepDirective}
        code={stepCode}
        activeLines={activeLines.step ?? EMPTY_LINE_LIST}
        tone={activeTones?.step ?? "active"}
        resetKey={resetKey}
      />
    </div>
  );
}
