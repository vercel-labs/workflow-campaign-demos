"use client";

import { useCallback, useMemo, useRef, useState } from "react";

type HighlightTone = "amber" | "green" | "red";
type GutterMarkKind = "success" | "fail";

type PaneProps = {
  filename: string;
  label: string;
  code: string;
  htmlLines: string[];
  activeLines: number[];
  gutterMarks: Record<number, GutterMarkKind>;
  tone: HighlightTone;
};

export type ContentEnricherCodeWorkbenchProps = {
  workflowCode: string;
  workflowHtmlLines: string[];
  workflowActiveLines: number[];
  workflowGutterMarks?: Record<number, GutterMarkKind>;
  stepCode: string;
  stepHtmlLines: string[];
  stepActiveLines: number[];
  stepGutterMarks: Record<number, GutterMarkKind>;
  tone: HighlightTone;
};

const GUTTER_LINE_STYLES: Record<GutterMarkKind, { line: string; gutter: string }> = {
  success: { line: "border-l-2 border-green-700 bg-green-700/15", gutter: "text-green-700" },
  fail: { line: "border-l-2 border-red-700 bg-red-700/15", gutter: "text-red-700" },
};

function toneClasses(tone: HighlightTone): string {
  switch (tone) {
    case "green":
      return "border-l-2 border-green-700 bg-green-700/15";
    case "red":
      return "border-l-2 border-red-700 bg-red-700/15";
    case "amber":
    default:
      return "border-l-2 border-amber-700 bg-amber-700/15";
  }
}

function GutterIcon({ kind }: { kind: GutterMarkKind }) {
  if (kind === "success") {
    return (
      <svg viewBox="0 0 16 16" className="h-4 w-4 text-green-700" fill="none" aria-hidden="true">
        <path d="M6.6 11.2 3.7 8.3l1-1 1.9 1.9 5-5 1 1-6 6Z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 text-red-700" fill="none" aria-hidden="true">
      <path d="M4.2 4.2 8 8l3.8-3.8 1 1L9 9l3.8 3.8-1 1L8 10 4.2 13.8l-1-1L7 9 3.2 5.2l1-1Z" fill="currentColor" />
    </svg>
  );
}

function CodePane({
  filename,
  label,
  code,
  htmlLines,
  activeLines,
  gutterMarks,
  tone,
}: PaneProps) {
  const [copied, setCopied] = useState(false);
  const activeLineSet = useMemo(() => new Set(activeLines), [activeLines]);
  const previousMarks = useRef<Record<number, GutterMarkKind>>({});

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 900);
    } catch {
      // no-op
    }
  }, [code]);

  for (const [line, kind] of Object.entries(gutterMarks)) {
    const lineNumber = Number(line);
    if (!Number.isNaN(lineNumber)) previousMarks.current[lineNumber] = kind;
  }

  return (
    <section className="overflow-hidden rounded-lg border border-gray-400/70 bg-background-100">
      <header className="flex items-center justify-between gap-2 border-b border-gray-400/70 bg-background-200 px-3 py-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-red-700/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-700/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-700/70" />
          </div>
          <div>
            <p className="text-xs font-mono text-gray-1000">{filename}</p>
            <p className="text-xs text-gray-900">{label}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="min-h-8 rounded-md border border-gray-400 bg-background-100 px-2.5 py-1 text-xs font-medium text-gray-900 transition-colors hover:border-gray-300 hover:text-gray-1000"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </header>

      <div className="max-h-[250px] overflow-y-auto">
        <pre className="min-w-full text-xs leading-relaxed">
          {htmlLines.map((lineHtml, index) => {
            const lineNumber = index + 1;
            const isActive = activeLineSet.has(lineNumber);
            const currentMark = gutterMarks[lineNumber];
            const previousMark = previousMarks.current[lineNumber];
            const markToRender = currentMark ?? previousMark;
            const visible = Boolean(currentMark);

            const gutterStyle = currentMark ? GUTTER_LINE_STYLES[currentMark] : null;

            return (
              <div
                key={lineNumber}
                className={[
                  "flex items-start gap-2 px-2 py-0.5 transition-colors duration-500",
                  gutterStyle
                    ? gutterStyle.line
                    : isActive ? toneClasses(tone) : "border-l-2 border-transparent",
                ].join(" ")}
              >
                <span className={[
                  "w-10 shrink-0 select-none text-right font-mono tabular-nums",
                  gutterStyle ? gutterStyle.gutter : "text-gray-900",
                ].join(" ")}>
                  {lineNumber}
                </span>
                <span className="w-5 shrink-0 select-none">
                  {markToRender ? (
                    <span className={[
                      "inline-flex transition-opacity duration-500",
                      visible ? "opacity-100" : "opacity-0",
                    ].join(" ")}>
                      <GutterIcon kind={markToRender} />
                    </span>
                  ) : null}
                </span>
                <span
                  className="min-w-0 flex-1 whitespace-pre font-mono text-gray-1000"
                  dangerouslySetInnerHTML={{ __html: lineHtml }}
                />
              </div>
            );
          })}
        </pre>
      </div>
    </section>
  );
}

export function ContentEnricherCodeWorkbench({
  workflowCode,
  workflowHtmlLines,
  workflowActiveLines,
  workflowGutterMarks = {},
  stepCode,
  stepHtmlLines,
  stepActiveLines,
  stepGutterMarks,
  tone,
}: ContentEnricherCodeWorkbenchProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <CodePane
        filename="workflows/content-enricher.ts"
        label="use workflow"
        code={workflowCode}
        htmlLines={workflowHtmlLines}
        activeLines={workflowActiveLines}
        gutterMarks={workflowGutterMarks}
        tone={tone}
      />
      <CodePane
        filename="workflows/content-enricher.ts"
        label="use step"
        code={stepCode}
        htmlLines={stepHtmlLines}
        activeLines={stepActiveLines}
        gutterMarks={stepGutterMarks}
        tone={tone}
      />
    </div>
  );
}
