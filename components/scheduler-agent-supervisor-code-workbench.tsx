"use client";

import { useCallback, useMemo, useRef, useState } from "react";

export type HighlightTone = "amber" | "cyan" | "green" | "red";
export type GutterMarkKind = "success" | "fail";

type Props = {
  workflowCode: string;
  workflowHtmlLines: string[];
  workflowLineTones: Record<number, HighlightTone>;
  workflowGutterMarks: Record<number, GutterMarkKind>;

  stepCode: string;
  stepHtmlLines: string[];
  stepLineTones: Record<number, HighlightTone>;
  stepGutterMarks: Record<number, GutterMarkKind>;
};

function toneClasses(tone: HighlightTone) {
  switch (tone) {
    case "cyan":
      return "border-cyan-700 bg-cyan-700/10 text-cyan-700";
    case "green":
      return "border-green-700 bg-green-700/10 text-green-700";
    case "red":
      return "border-red-700 bg-red-700/10 text-red-700";
    case "amber":
    default:
      return "border-amber-700 bg-amber-700/10 text-amber-700";
  }
}

function GutterIcon({ kind }: { kind: GutterMarkKind }) {
  if (kind === "success") {
    return (
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4 text-green-700"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M6.6 11.2 3.7 8.3l1-1 1.9 1.9 5-5 1 1-6 6Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4 text-red-700"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4.2 4.2 8 8l3.8-3.8 1 1L9 9l3.8 3.8-1 1L8 10 4.2 13.8l-1-1L7 9 3.2 5.2l1-1Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CodePane({
  title,
  subtitle,
  code,
  htmlLines,
  lineTones,
  gutterMarks,
}: {
  title: string;
  subtitle: string;
  code: string;
  htmlLines: string[];
  lineTones: Record<number, HighlightTone>;
  gutterMarks: Record<number, GutterMarkKind>;
}) {
  const [copied, setCopied] = useState(false);
  const activeLines = useMemo(() => new Set(Object.keys(lineTones).map(Number)), [lineTones]);
  const prevMarkRef = useRef<Record<number, GutterMarkKind>>({});

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_000);
    } catch {
      // no-op
    }
  }, [code]);

  for (const [lineNoString, mark] of Object.entries(gutterMarks)) {
    const lineNo = Number(lineNoString);
    if (!Number.isNaN(lineNo)) {
      prevMarkRef.current[lineNo] = mark;
    }
  }

  return (
    <section className="overflow-hidden rounded-lg border border-gray-400/70 bg-background-100">
      <header className="flex items-center justify-between gap-3 border-b border-gray-400/70 bg-background-200 px-3 py-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-red-700/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-700/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-700/70" />
          </div>
          <div>
            <p className="text-xs font-mono text-gray-900">{title}</p>
            <p className="text-xs text-gray-900">{subtitle}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="min-h-8 rounded-md border border-gray-400 bg-background-100 px-2.5 py-1 text-xs font-medium text-gray-900 transition-colors hover:border-gray-300 hover:text-gray-1000"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </header>

      <div className="max-h-[250px] overflow-y-auto">
        <pre className="min-w-full text-xs leading-relaxed">
          {htmlLines.map((lineHtml, index) => {
            const lineNo = index + 1;
            const isActive = activeLines.has(lineNo);
            const mark = gutterMarks[lineNo] ?? prevMarkRef.current[lineNo];
            const markVisible = Boolean(gutterMarks[lineNo]);
            const tone = lineTones[lineNo];

            return (
              <div
                key={lineNo}
                className={[
                  "flex items-start gap-2 border-l-2 px-2 py-0.5 transition-colors duration-500",
                  isActive && tone
                    ? toneClasses(tone)
                    : "border-transparent text-gray-900",
                ].join(" ")}
              >
                <span className="w-8 shrink-0 select-none text-right font-mono tabular-nums text-gray-900">
                  {lineNo}
                </span>
                <span className="w-5 shrink-0 select-none">
                  {mark ? (
                    <span
                      className={[
                        "inline-flex transition-opacity duration-500",
                        markVisible ? "opacity-100" : "opacity-0",
                      ].join(" ")}
                    >
                      <GutterIcon kind={mark} />
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

export function SchedulerAgentSupervisorCodeWorkbench(props: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <CodePane
        title="workflows/scheduler-agent-supervisor.ts"
        subtitle="use workflow"
        code={props.workflowCode}
        htmlLines={props.workflowHtmlLines}
        lineTones={props.workflowLineTones}
        gutterMarks={props.workflowGutterMarks}
      />
      <CodePane
        title="workflows/scheduler-agent-supervisor.ts"
        subtitle="use step"
        code={props.stepCode}
        htmlLines={props.stepHtmlLines}
        lineTones={props.stepLineTones}
        gutterMarks={props.stepGutterMarks}
      />
    </div>
  );
}
