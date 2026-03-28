// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExportCodeWorkbench } from "@/cancellable-export/components/export-code-workbench";

type DemoState = "idle" | "running" | "cancelling" | "completed" | "cancelled";

type HighlightLineMap = {
  generateLines: number[];
};

type CodeProps = {
  workflowCode: string;
  workflowLinesHtml: string[];
  stepCodes: string[];
  stepLinesHtml: string[][];
  highlightLineMap: HighlightLineMap;
  sectionNames: string[];
  sectionContent: string[];
};

type SectionEvent =
  | { type: "section_start"; index: number; title: string }
  | { type: "section_done"; index: number; title: string }
  | { type: "complete"; total: number }
  | { type: "cancelled"; completedCount: number; total: number };

function parseSseEventChunk(rawChunk: string): SectionEvent | null {
  const payload = rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as SectionEvent;
  } catch {
    return null;
  }
}

export function ContentPipelineDemo({
  workflowCode,
  workflowLinesHtml,
  stepCodes,
  stepLinesHtml,
  highlightLineMap,
  sectionNames,
  sectionContent,
}: CodeProps) {
  const total = sectionNames.length;
  const [state, setState] = useState<DemoState>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [completedSections, setCompletedSections] = useState(0);
  const [activeSectionIndex, setActiveSectionIndex] = useState<number | null>(null);
  const [cancelCutoff, setCancelCutoff] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const docScrollRef = useRef<HTMLDivElement | null>(null);
  const startButtonRef = useRef<HTMLButtonElement | null>(null);

  const getAbortSignal = useCallback((): AbortSignal => {
    if (!abortRef.current || abortRef.current.signal.aborted) {
      abortRef.current = new AbortController();
    }
    return abortRef.current.signal;
  }, []);

  const canCancel = state === "running" || state === "cancelling";
  const generatedCount = completedSections;
  const pct = total > 0 ? Math.round((generatedCount / total) * 100) : 0;

  // Auto-scroll document preview
  useEffect(() => {
    docScrollRef.current?.scrollTo({
      top: docScrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [generatedCount]);

  // Phase-to-highlight sync
  const workflowPhase = useMemo(() => {
    if (state === "idle") return "idle" as const;
    if (state === "completed") return "complete" as const;
    if (state === "cancelled") return "cancelled" as const;
    if (state === "cancelling") return "cancelling" as const;
    if (activeSectionIndex !== null) return "generating" as const;
    return "sleeping" as const;
  }, [state, activeSectionIndex]);

  const highlightLines = useMemo(() => {
    if (workflowPhase === "idle") return [];
    const idx = Math.min(generatedCount, highlightLineMap.generateLines.length - 1);
    const line = highlightLineMap.generateLines[Math.max(0, idx)];
    return line !== undefined ? [line] : [];
  }, [workflowPhase, highlightLineMap, generatedCount]);

  const highlightColorIndex = useMemo(() => {
    switch (workflowPhase) {
      case "generating":
      case "sleeping":
        return 0; // amber
      case "cancelling":
      case "cancelled":
        return 1; // red
      case "complete":
        return 2; // green
      default:
        return 0;
    }
  }, [workflowPhase]);

  const gutterMarks = useMemo(() => {
    const marks: Record<number, number> = {};
    for (const line of highlightLineMap.generateLines) {
      marks[line] = 0;
    }
    return marks;
  }, [highlightLineMap]);

  const activeSendSteps = useMemo(() => {
    const active = new Set<number>();
    if (completedSections > 0) active.add(0);
    return active;
  }, [completedSections]);

  // Stream connection — reads SSE from /api/readable/[runId]
  const connectToStream = useCallback(async (targetRunId: string) => {
    const signal = getAbortSignal();

    try {
      const res = await fetch(`/api/readable/${targetRunId}`, { signal });

      if (signal.aborted) return;

      if (!res.ok || !res.body) {
        throw new Error("Failed to connect to stream");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const normalized = buffer.replaceAll("\r\n", "\n");
        const chunks = normalized.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          if (signal.aborted) return;
          const event = parseSseEventChunk(chunk);
          if (!event) continue;

          switch (event.type) {
            case "section_start":
              setActiveSectionIndex(event.index);
              break;
            case "section_done":
              setCompletedSections((prev) => Math.max(prev, event.index + 1));
              setActiveSectionIndex(null);
              break;
            case "complete":
              if (!signal.aborted) setState("completed");
              break;
            case "cancelled":
              if (!signal.aborted) {
                setCancelCutoff(event.completedCount);
                setState("cancelled");
              }
              break;
          }
        }
      }

      // Flush remaining buffer
      if (buffer.trim()) {
        if (signal.aborted) return;
        const event = parseSseEventChunk(buffer.replaceAll("\r\n", "\n"));
        if (event) {
          if (event.type === "complete") setState("completed");
          if (event.type === "cancelled") {
            setCancelCutoff(event.completedCount);
            setState("cancelled");
          }
        }
      }

      // If stream ended without explicit complete/cancelled event, infer terminal state
      setState((prev) => {
        if (prev === "running") return "completed";
        if (prev === "cancelling") return "cancelled";
        return prev;
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (signal.aborted) return;
      const message = err instanceof Error ? err.message : "Stream connection failed";
      if (signal.aborted) return;
      setError(message);
    }
  }, [getAbortSignal]);

  // Start
  const startGeneration = async () => {
    abortRef.current?.abort();
    abortRef.current = null;
    const signal = getAbortSignal();
    setError(null);
    setCompletedSections(0);
    setActiveSectionIndex(null);
    setRunId(null);
    setCancelCutoff(null);
    setState("running");

    try {
      const res = await fetch("/api/cancellable-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: "acct_demo" }),
        signal,
      });

      if (signal.aborted) return;

      if (!res.ok) {
        let message = "Failed to start generation";
        try {
          const data = await res.json();
          message = data.error?.message || message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }

      const data = await res.json();
      if (signal.aborted) return;
      setRunId(data.runId);
      if (signal.aborted) return;
      void connectToStream(data.runId);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (signal.aborted) return;
      const message = err instanceof Error ? err.message : "Unknown error";
      if (signal.aborted) return;
      setError(message);
      if (signal.aborted) return;
      setState("idle");
    }
  };

  // Cancel — DELETE /api/run/[runId]
  const cancelGeneration = useCallback(async () => {
    if (!runId || !canCancel) return;
    setError(null);
    setState("cancelling");
    const signal = getAbortSignal();

    try {
      const res = await fetch(`/api/run/${runId}`, {
        method: "DELETE",
        signal,
      });

      if (signal.aborted) return;

      if (!res.ok) {
        let message = "Failed to cancel";
        try {
          const data = await res.json();
          message = data.error?.message || message;
        } catch {
          // ignore
        }
        throw new Error(message);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (signal.aborted) return;
      const message = err instanceof Error ? err.message : "Cancel failed";
      if (signal.aborted) return;
      setError(message);
      if (signal.aborted) return;
      setState("running");
    }
  }, [canCancel, getAbortSignal, runId]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState("idle");
    setRunId(null);
    setCompletedSections(0);
    setActiveSectionIndex(null);
    setCancelCutoff(null);
    setError(null);
    setTimeout(() => {
      startButtonRef.current?.focus();
    }, 0);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 min-h-[38px]">
        {state === "idle" && (
          <button
            ref={startButtonRef}
            onClick={startGeneration}
            className="px-4 py-2 rounded-md text-sm font-medium text-black bg-white hover:bg-white/80 cursor-pointer transition-colors"
          >
            Generate Report
          </button>
        )}

        {canCancel && (
          <button
            onClick={() => void cancelGeneration()}
            disabled={state === "cancelling" || !runId}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-red-700 hover:bg-red-700/80 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {state === "cancelling" ? "Cancelling..." : "Cancel Generation"}
          </button>
        )}

        {state !== "idle" && (
          <button
            onClick={handleReset}
            className="px-4 py-2 rounded-md text-sm border border-gray-400 text-gray-900 hover:border-gray-300 hover:text-gray-1000 cursor-pointer transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg border border-red-700/40 bg-red-700/10 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: progress + checklist */}
        <div className="rounded-lg border border-gray-400 bg-background-200 p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <p className="text-gray-900" role="status" aria-live="polite">
              {state === "idle" &&
                `0 sections ready`}
              {state === "running" &&
                `Generating section ${generatedCount + 1} of ${total}...`}
              {state === "cancelling" &&
                `Cancelling after ${generatedCount} of ${total} sections`}
              {state === "completed" &&
                `All ${total} sections generated`}
              {state === "cancelled" &&
                `Cancelled — ${cancelCutoff ?? generatedCount} of ${total} sections generated`}
            </p>
            <span className="text-xs font-mono text-gray-900">{pct}%</span>
          </div>

          <div className="w-full h-2 rounded-full bg-gray-500 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                state === "cancelled" || state === "cancelling"
                  ? "bg-red-700"
                  : "bg-green-700"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>

          <ul className="space-y-1">
            {sectionNames.map((name, i) => {
              const done = i < generatedCount;
              const isActive = activeSectionIndex === i;
              const isNext =
                state === "running" && !isActive && i === generatedCount;
              const skipped =
                (state === "cancelled" || state === "cancelling") &&
                i >= generatedCount;

              return (
                <li
                  key={i}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors duration-200 ${
                    done
                      ? "text-gray-1000"
                      : skipped
                        ? "text-gray-900/50"
                        : isActive || isNext
                          ? "text-gray-1000"
                          : "text-gray-900"
                  }`}
                >
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                    {done ? (
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-3.5 w-3.5 text-green-700"
                        aria-hidden="true"
                      >
                        <polyline points="3,8.5 7,12.5 13,4" />
                      </svg>
                    ) : isActive ? (
                      <span className="h-2 w-2 rounded-full bg-amber-700 animate-pulse" />
                    ) : skipped ? (
                      <span className="h-[2px] w-3 rounded-full bg-gray-900/30" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-gray-500" />
                    )}
                  </span>
                  <span className={skipped ? "line-through" : ""}>
                    {name}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Right: mock document preview */}
        <div className="relative">
          <div className="absolute inset-0 rounded-lg border border-gray-400 bg-background-100 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 border-b border-gray-400 px-4 py-2">
              <svg
                viewBox="0 0 16 16"
                fill="currentColor"
                className="h-3.5 w-3.5 text-gray-900"
                aria-hidden="true"
              >
                <path d="M3.5 1A1.5 1.5 0 0 0 2 2.5v11A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5v-8.5L9.5 1H3.5ZM10 1.5 13.5 5H10.5A.5.5 0 0 1 10 4.5V1.5ZM5 8.5a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5A.5.5 0 0 1 5 8.5Zm0 2a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 0 1h-5a.5.5 0 0 1-.5-.5Zm0 2a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1h-3a.5.5 0 0 1-.5-.5Z" />
              </svg>
              <span className="text-xs font-mono text-gray-900">
                report.md
              </span>
            </div>
            <div ref={docScrollRef} className="flex-1 overflow-y-scroll p-4 min-h-0 [color-scheme:dark]">
            {generatedCount === 0 ? (
              <p className="text-sm text-gray-900/50 italic">
                {state === "idle"
                  ? "Document preview will appear here..."
                  : "Generating first section..."}
              </p>
            ) : (
              <div className="space-y-4">
                {sectionNames.slice(0, generatedCount).map((name, i) => (
                  <div key={i}>
                    <h3 className="text-sm font-semibold text-gray-1000 mb-1">
                      {name}
                    </h3>
                    <p className="text-xs leading-relaxed text-gray-900">
                      {sectionContent[i]}
                    </p>
                  </div>
                ))}
                {state === "running" && activeSectionIndex !== null && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-1000/50 mb-1">
                      {sectionNames[activeSectionIndex]}
                    </h3>
                    <span className="inline-block h-3 w-3 rounded-full bg-amber-700 animate-pulse" />
                  </div>
                )}
                {(state === "cancelled" || state === "cancelling") && (
                  <div className="mt-2 border-t border-red-700/30 pt-3">
                    <p className="text-xs text-red-700 font-mono">
                      — generation cancelled —
                    </p>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      <ExportCodeWorkbench
        workflowCode={workflowCode}
        workflowLinesHtml={workflowLinesHtml}
        stepCodes={stepCodes}
        stepLinesHtml={stepLinesHtml}
        activeStepIndex={0}
        highlightLines={highlightLines}
        highlightColorIndex={highlightColorIndex}
        gutterMarks={gutterMarks}
        activeSendSteps={activeSendSteps}
      />
    </div>
  );
}

const demoProps = {
  workflowCode: "",
  workflowLinesHtml: [],
  stepCodes: [],
  stepLinesHtml: [],
  highlightLineMap: {},
  sectionNames: [],
  sectionContent: [],
} as unknown as Parameters<typeof ContentPipelineDemo>[0];

export default function CancellableExportNativeDemo() {
  return <ContentPipelineDemo {...demoProps} />;
}
