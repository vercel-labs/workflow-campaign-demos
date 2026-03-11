"use client";

import { useCallback, useMemo, useRef, useState } from "react";

type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail";

type Props = {
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

const GUTTER_LINE_STYLES: Record<GutterMarkKind, { line: string; gutter: string }> = {
  success: { line: "border-l-2 border-green-700 bg-green-700/10", gutter: "text-green-700" },
  fail: { line: "border-l-2 border-red-700 bg-red-700/10", gutter: "text-red-700" },
};

function toneLineClasses(tone: HighlightTone) {
  switch (tone) {
    case "green":
      return "border-l-2 border-green-700 bg-green-700/10";
    case "red":
      return "border-l-2 border-red-700 bg-red-700/10";
    case "cyan":
      return "border-l-2 border-cyan-700 bg-cyan-700/10";
    case "amber":
    default:
      return "border-l-2 border-amber-700 bg-amber-700/10";
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
  title,
  subtitle,
  code,
  htmlLines,
  activeLines,
  gutterMarks,
  tone,
}: {
  title: string;
  subtitle: string;
  code: string;
  htmlLines: string[];
  activeLines: number[];
  gutterMarks: Record<number, GutterMarkKind>;
  tone: HighlightTone;
}) {
  const active = useMemo(() => new Set(activeLines), [activeLines]);
  const prevMarkRef = useRef<Record<number, GutterMarkKind>>({});
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 900);
    } catch {
      // ignore
    }
  }, [code]);

  for (const [lineStr, kind] of Object.entries(gutterMarks)) {
    const line = Number(lineStr);
    if (!Number.isNaN(line)) prevMarkRef.current[line] = kind;
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
          <div>
            <p className="text-sm font-semibold text-gray-1000">{title}</p>
            <p className="text-xs text-gray-900">{subtitle}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-gray-400/70 bg-background-100 px-2 py-1 text-xs font-mono text-gray-900">
            {subtitle}
          </span>
          <button
            type="button"
            onClick={onCopy}
            className="min-h-8 rounded-md border border-gray-400 bg-background-100 px-2.5 py-1 text-xs font-medium text-gray-900 transition-colors hover:border-gray-300 hover:text-gray-1000"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </header>

      <div className="max-h-[360px] overflow-auto">
        <pre className="min-w-full text-xs leading-relaxed">
          {htmlLines.map((lineHtml, index) => {
            const lineNo = index + 1;
            const currentMark = gutterMarks[lineNo];
            const prevMark = prevMarkRef.current[lineNo];
            const markToRender = currentMark ?? prevMark;
            const showMark = Boolean(currentMark);
            const isActive = active.has(lineNo);

            const gutterStyle = currentMark ? GUTTER_LINE_STYLES[currentMark] : null;

            return (
              <div
                key={lineNo}
                className={[
                  "flex items-start gap-2 px-2 py-0.5",
                  gutterStyle
                    ? gutterStyle.line
                    : isActive ? toneLineClasses(tone) : "border-l-2 border-transparent",
                ].join(" ")}
              >
                <span className={[
                  "w-10 shrink-0 select-none text-right font-mono tabular-nums",
                  gutterStyle ? gutterStyle.gutter : "text-gray-900",
                ].join(" ")}>
                  {lineNo}
                </span>
                <span className="w-5 shrink-0 select-none">
                  {markToRender ? (
                    <span className={["inline-flex transition-opacity duration-500", showMark ? "opacity-100" : "opacity-0"].join(" ")}>
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

export function ClaimCodeWorkbench(props: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <CodePane
        title="workflows/claim-check.ts"
        subtitle="use workflow"
        code={props.workflowCode}
        htmlLines={props.workflowHtmlLines}
        activeLines={props.workflowActiveLines}
        gutterMarks={props.workflowGutterMarks}
        tone={props.tone}
      />
      <CodePane
        title="workflows/claim-check.ts"
        subtitle="use step"
        code={props.stepCode}
        htmlLines={props.stepHtmlLines}
        activeLines={props.stepActiveLines}
        gutterMarks={props.stepGutterMarks}
        tone={props.tone}
      />
    </div>
  );
}
