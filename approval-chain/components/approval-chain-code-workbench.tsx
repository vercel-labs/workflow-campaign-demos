"use client";

import { useCallback, useMemo, useRef, useState } from "react";

type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail";

type CodePaneProps = {
  filename: string;
  label: "use workflow" | "use step";
  code: string;
  htmlLines: string[];
  activeLines: number[];
  gutterMarks: Record<number, GutterMarkKind>;
  tone: HighlightTone;
};

export type ApprovalChainCodeWorkbenchProps = {
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

function getToneClasses(tone: HighlightTone) {
  switch (tone) {
    case "green":
      return {
        line: "border-l-2 border-green-700 bg-green-700/15",
        gutter: "text-green-700",
      };
    case "red":
      return {
        line: "border-l-2 border-red-700 bg-red-700/15",
        gutter: "text-red-700",
      };
    case "cyan":
      return {
        line: "border-l-2 border-cyan-700 bg-cyan-700/15",
        gutter: "text-cyan-700",
      };
    case "amber":
    default:
      return {
        line: "border-l-2 border-amber-700 bg-amber-700/15",
        gutter: "text-amber-700",
      };
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
}: CodePaneProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const activeLineSet = useMemo(() => new Set(activeLines), [activeLines]);
  const previousMarksRef = useRef<Record<number, GutterMarkKind>>({});
  const toneClasses = getToneClasses(tone);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 900);
    } catch {
      // Ignore clipboard errors.
    }
  }, [code]);

  for (const [lineKey, mark] of Object.entries(gutterMarks)) {
    const line = Number(lineKey);
    if (!Number.isNaN(line)) {
      previousMarksRef.current[line] = mark;
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-gray-400/70 bg-background-100">
      <header className="flex items-center justify-between gap-2 border-b border-gray-400/70 bg-background-200 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-red-700/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-700/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-700/70" />
          </div>
          <p className="text-xs font-mono text-gray-900">{filename}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-gray-400/70 bg-background-100 px-2 py-1 text-xs font-mono text-gray-900">
            {label}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="min-h-8 rounded-md border border-gray-400 bg-background-100 px-2.5 py-1 text-xs font-medium text-gray-900 transition-colors hover:border-gray-300 hover:text-gray-1000"
          >
            {copyState === "copied" ? "Copied" : "Copy"}
          </button>
        </div>
      </header>

      <div className="max-h-[340px] overflow-auto">
        <pre className="min-w-full text-xs leading-relaxed">
          {htmlLines.map((lineHtml, index) => {
            const lineNo = index + 1;
            const currentMark = gutterMarks[lineNo];
            const previousMark = previousMarksRef.current[lineNo];
            const markToRender = currentMark ?? previousMark;
            const showMark = Boolean(currentMark);
            const isActive = activeLineSet.has(lineNo);

            return (
              <div
                key={lineNo}
                className={[
                  "flex items-start gap-2 px-2 py-0.5 transition-colors duration-300",
                  isActive ? toneClasses.line : "border-l-2 border-transparent",
                ].join(" ")}
              >
                <span
                  className={[
                    "w-10 shrink-0 select-none text-right font-mono tabular-nums",
                    isActive ? toneClasses.gutter : "text-gray-900",
                  ].join(" ")}
                >
                  {lineNo}
                </span>

                <span className="w-5 shrink-0 select-none" aria-hidden="true">
                  {markToRender ? (
                    <span
                      className={[
                        "inline-flex transition-opacity duration-500",
                        showMark ? "opacity-100" : "opacity-0",
                      ].join(" ")}
                    >
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

export function ApprovalChainCodeWorkbench({
  workflowCode,
  workflowHtmlLines,
  workflowActiveLines,
  workflowGutterMarks,
  stepCode,
  stepHtmlLines,
  stepActiveLines,
  stepGutterMarks,
  tone,
}: ApprovalChainCodeWorkbenchProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <CodePane
        filename="workflows/approval-chain.ts"
        label="use workflow"
        code={workflowCode}
        htmlLines={workflowHtmlLines}
        activeLines={workflowActiveLines}
        gutterMarks={workflowGutterMarks}
        tone={tone}
      />
      <CodePane
        filename="workflows/approval-chain.ts"
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
