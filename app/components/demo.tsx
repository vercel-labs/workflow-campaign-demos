"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BulkheadCodeWorkbench } from "./bulkhead-code-workbench";

type BulkheadEvent =
  | { type: "compartment_start"; compartment: number; items: string[] }
  | { type: "item_processing"; compartment: number; item: string }
  | { type: "item_success"; compartment: number; item: string; durationMs: number }
  | { type: "item_failure"; compartment: number; item: string; error: string }
  | { type: "pacing"; compartment: number }
  | { type: "summarizing" }
  | {
      type: "done";
      summary: { total: number; succeeded: number; failed: number; compartments: number };
    };

type RunStatus = "idle" | "running" | "pacing" | "summarizing" | "done";

type ItemStatus = "pending" | "processing" | "success" | "failure";

type ItemState = {
  item: string;
  compartment: number;
  status: ItemStatus;
  durationMs?: number;
  error?: string;
};

type CompartmentState = {
  index: number;
  items: ItemState[];
  status: "pending" | "processing" | "done";
};

type Snapshot = {
  runId: string;
  status: RunStatus;
  elapsedMs: number;
  compartments: CompartmentState[];
  summary?: { total: number; succeeded: number; failed: number; compartments: number };
};

type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail";

type DemoProps = {
  workflowCode: string;
  workflowLinesHtml: string[];
  stepCode: string;
  stepLinesHtml: string[];
  workflowLineMap: WorkflowLineMap;
  stepLineMap: StepLineMap;
};

type WorkflowLineMap = {
  allSettled: number[];
  pacing: number[];
  summarize: number[];
};

type StepLineMap = {
  processing: number[];
  success: number[];
  failure: number[];
};

type StartResponse = {
  runId: string;
  jobId: string;
  items: string[];
  maxConcurrency: number;
  status: string;
};

const ELAPSED_TICK_MS = 120;
const ITEMS = [
  "order-1", "order-2", "order-3",
  "order-4", "order-5", "order-6",
  "order-7", "order-8", "order-9",
];
const MAX_CONCURRENCY = 3;

function parseSseData(rawChunk: string): string {
  return rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
}

function parseBulkheadEvent(rawChunk: string): BulkheadEvent | null {
  const payload = parseSseData(rawChunk);
  if (!payload) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;

  const event = parsed as Record<string, unknown>;
  const type = event.type;

  if (
    type === "compartment_start" &&
    typeof event.compartment === "number" &&
    Array.isArray(event.items)
  ) {
    return { type, compartment: event.compartment, items: event.items as string[] };
  }

  if (
    type === "item_processing" &&
    typeof event.compartment === "number" &&
    typeof event.item === "string"
  ) {
    return { type, compartment: event.compartment, item: event.item };
  }

  if (
    type === "item_success" &&
    typeof event.compartment === "number" &&
    typeof event.item === "string" &&
    typeof event.durationMs === "number"
  ) {
    return { type, compartment: event.compartment, item: event.item, durationMs: event.durationMs };
  }

  if (
    type === "item_failure" &&
    typeof event.compartment === "number" &&
    typeof event.item === "string" &&
    typeof event.error === "string"
  ) {
    return { type, compartment: event.compartment, item: event.item, error: event.error };
  }

  if (type === "pacing" && typeof event.compartment === "number") {
    return { type, compartment: event.compartment };
  }

  if (type === "summarizing") {
    return { type };
  }

  if (
    type === "done" &&
    event.summary &&
    typeof event.summary === "object"
  ) {
    const s = event.summary as Record<string, unknown>;
    if (
      typeof s.total === "number" &&
      typeof s.succeeded === "number" &&
      typeof s.failed === "number" &&
      typeof s.compartments === "number"
    ) {
      return {
        type,
        summary: {
          total: s.total,
          succeeded: s.succeeded,
          failed: s.failed,
          compartments: s.compartments,
        },
      };
    }
  }

  return null;
}

function createInitialCompartments(items: string[], maxConcurrency: number): CompartmentState[] {
  const compartments: CompartmentState[] = [];
  for (let i = 0; i < items.length; i += maxConcurrency) {
    const batch = items.slice(i, i + maxConcurrency);
    compartments.push({
      index: compartments.length + 1,
      items: batch.map((item) => ({
        item,
        compartment: compartments.length + 1,
        status: "pending",
      })),
      status: "pending",
    });
  }
  return compartments;
}

function applyEvent(snapshot: Snapshot, event: BulkheadEvent): Snapshot {
  if (event.type === "item_processing") {
    const compartments = snapshot.compartments.map((c) => {
      if (c.index !== event.compartment) return c;
      return {
        ...c,
        status: "processing" as const,
        items: c.items.map((it) =>
          it.item === event.item ? { ...it, status: "processing" as const } : it
        ),
      };
    });
    return { ...snapshot, status: "running", compartments };
  }

  if (event.type === "item_success") {
    const compartments = snapshot.compartments.map((c) => {
      if (c.index !== event.compartment) return c;
      const items = c.items.map((it) =>
        it.item === event.item
          ? { ...it, status: "success" as const, durationMs: event.durationMs }
          : it
      );
      const allDone = items.every((it) => it.status === "success" || it.status === "failure");
      return { ...c, items, status: allDone ? ("done" as const) : c.status };
    });
    return { ...snapshot, compartments };
  }

  if (event.type === "item_failure") {
    const compartments = snapshot.compartments.map((c) => {
      if (c.index !== event.compartment) return c;
      const items = c.items.map((it) =>
        it.item === event.item
          ? { ...it, status: "failure" as const, error: event.error }
          : it
      );
      const allDone = items.every((it) => it.status === "success" || it.status === "failure");
      return { ...c, items, status: allDone ? ("done" as const) : c.status };
    });
    return { ...snapshot, compartments };
  }

  if (event.type === "pacing") {
    return { ...snapshot, status: "pacing" };
  }

  if (event.type === "summarizing") {
    return { ...snapshot, status: "summarizing" };
  }

  if (event.type === "done") {
    return { ...snapshot, status: "done", summary: event.summary };
  }

  return snapshot;
}

function formatElapsedMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

export function BulkheadDemo({
  workflowCode,
  workflowLinesHtml,
  stepCode,
  stepLinesHtml,
  workflowLineMap,
  stepLineMap,
}: DemoProps) {
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const snapshotRef = useRef<Snapshot | null>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);

  const stopElapsedTicker = useCallback(() => {
    if (elapsedRef.current) {
      clearInterval(elapsedRef.current);
      elapsedRef.current = null;
    }
  }, []);

  const startElapsedTicker = useCallback(() => {
    stopElapsedTicker();
    elapsedRef.current = setInterval(() => {
      const startedAtMs = startedAtRef.current;
      if (!startedAtMs) return;

      setSnapshot((prev) => {
        if (!prev || prev.status === "done") return prev;
        return { ...prev, elapsedMs: Math.max(0, Date.now() - startedAtMs) };
      });
    }, ELAPSED_TICK_MS);
  }, [stopElapsedTicker]);

  useEffect(() => {
    return () => {
      stopElapsedTicker();
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [stopElapsedTicker]);

  const connectToReadable = useCallback(
    async (start: StartResponse) => {
      const controller = abortRef.current ?? new AbortController();
      abortRef.current = controller;
      const signal = controller.signal;

      try {
        const response = await fetch(
          `/api/readable/${encodeURIComponent(start.runId)}`,
          { cache: "no-store", signal }
        );

        if (signal.aborted) return;
        if (!response.ok || !response.body) {
          throw new Error(`Readable stream request failed: ${response.status}`);
        }

        const reader = response.body.getReader();
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
            const event = parseBulkheadEvent(chunk);
            if (!event) continue;

            const next = applyEvent(snapshotRef.current!, event);
            snapshotRef.current = next;
            setSnapshot({ ...next, elapsedMs: Math.max(0, Date.now() - (startedAtRef.current ?? Date.now())) });

            if (next.status === "done") {
              stopElapsedTicker();
            }
          }
        }

        if (!signal.aborted && buffer.trim()) {
          const event = parseBulkheadEvent(buffer.replaceAll("\r\n", "\n"));
          if (event) {
            const next = applyEvent(snapshotRef.current!, event);
            snapshotRef.current = next;
            setSnapshot({ ...next, elapsedMs: Math.max(0, Date.now() - (startedAtRef.current ?? Date.now())) });
            if (next.status === "done") stopElapsedTicker();
          }
        }
      } catch (cause: unknown) {
        if (cause instanceof Error && cause.name === "AbortError") return;
        if (signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Readable stream failed");
        stopElapsedTicker();
      }
    },
    [stopElapsedTicker]
  );

  const handleStart = async () => {
    setError(null);
    setSnapshot(null);
    setRunId(null);
    stopElapsedTicker();
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    startedAtRef.current = null;
    snapshotRef.current = null;

    try {
      const signal = abortRef.current.signal;
      const res = await fetch("/api/bulkhead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: ITEMS, maxConcurrency: MAX_CONCURRENCY }),
        signal,
      });

      if (signal.aborted) return;
      const payload = (await res.json()) as StartResponse;
      if (!res.ok) {
        setError((payload as unknown as { error?: string }).error ?? `Request failed: ${res.status}`);
        return;
      }

      const startedAt = Date.now();
      startedAtRef.current = startedAt;

      const initial: Snapshot = {
        runId: payload.runId,
        status: "running",
        elapsedMs: 0,
        compartments: createInitialCompartments(payload.items, payload.maxConcurrency),
      };
      snapshotRef.current = initial;
      setRunId(payload.runId);
      setSnapshot(initial);

      startElapsedTicker();
      void connectToReadable(payload);
    } catch (cause: unknown) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Unknown error");
    }
  };

  const handleReset = () => {
    stopElapsedTicker();
    abortRef.current?.abort();
    abortRef.current = null;
    startedAtRef.current = null;
    snapshotRef.current = null;
    setRunId(null);
    setSnapshot(null);
    setError(null);
    setTimeout(() => startButtonRef.current?.focus(), 0);
  };

  const effectiveStatus = snapshot?.status ?? "idle";
  const isRunning = runId !== null && snapshot?.status !== "done";

  const highlights = useMemo(() => {
    if (!snapshot) {
      return {
        workflowActiveLines: [] as number[],
        stepActiveLines: [] as number[],
        workflowGutterMarks: {} as Record<number, GutterMarkKind>,
        stepGutterMarks: {} as Record<number, GutterMarkKind>,
      };
    }

    const workflowGutterMarks: Record<number, GutterMarkKind> = {};
    const stepGutterMarks: Record<number, GutterMarkKind> = {};

    if (snapshot.status === "running") {
      const hasProcessing = snapshot.compartments.some((c) =>
        c.items.some((it) => it.status === "processing")
      );
      const hasFailed = snapshot.compartments.some((c) =>
        c.items.some((it) => it.status === "failure")
      );
      const hasSucceeded = snapshot.compartments.some((c) =>
        c.items.some((it) => it.status === "success")
      );
      if (hasSucceeded) {
        for (const ln of stepLineMap.success) stepGutterMarks[ln] = "success";
      }
      if (hasFailed) {
        for (const ln of stepLineMap.failure) stepGutterMarks[ln] = "fail";
      }
      return {
        workflowActiveLines: workflowLineMap.allSettled,
        stepActiveLines: hasProcessing ? stepLineMap.processing : [],
        workflowGutterMarks,
        stepGutterMarks,
      };
    }

    if (snapshot.status === "pacing") {
      return {
        workflowActiveLines: workflowLineMap.pacing,
        stepActiveLines: [],
        workflowGutterMarks,
        stepGutterMarks,
      };
    }

    if (snapshot.status === "summarizing") {
      for (const ln of workflowLineMap.allSettled.slice(0, 1)) {
        workflowGutterMarks[ln] = "success";
      }
      return {
        workflowActiveLines: workflowLineMap.summarize,
        stepActiveLines: [],
        workflowGutterMarks,
        stepGutterMarks,
      };
    }

    if (snapshot.status === "done") {
      for (const ln of workflowLineMap.allSettled.slice(0, 1)) {
        workflowGutterMarks[ln] = "success";
      }
      for (const ln of workflowLineMap.summarize) {
        workflowGutterMarks[ln] = "success";
      }
      return {
        workflowActiveLines: [],
        stepActiveLines: [],
        workflowGutterMarks,
        stepGutterMarks,
      };
    }

    return {
      workflowActiveLines: [] as number[],
      stepActiveLines: [] as number[],
      workflowGutterMarks,
      stepGutterMarks,
    };
  }, [snapshot, workflowLineMap, stepLineMap]);

  const highlightTone: HighlightTone = useMemo(() => {
    if (!snapshot) return "amber";
    if (snapshot.status === "pacing") return "cyan";
    if (snapshot.status === "done") return snapshot.summary?.failed ? "red" : "green";
    if (snapshot.status === "summarizing") return "cyan";
    return "amber";
  }, [snapshot]);

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="rounded-lg border border-red-700/40 bg-red-700/10 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-gray-400 bg-background-100 p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            ref={startButtonRef}
            onClick={() => void handleStart()}
            disabled={isRunning}
            className="cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Run Bulkhead
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={!runId}
            className={`rounded-md border px-4 py-2 text-sm transition-colors ${
              runId
                ? "cursor-pointer border-gray-400 text-gray-900 hover:border-gray-300 hover:text-gray-1000"
                : "invisible border-transparent"
            }`}
          >
            Reset
          </button>

          <div className="ml-auto flex items-center gap-3 text-xs text-gray-900">
            <RunStatusBadge status={effectiveStatus} />
            {snapshot && (
              <span className="font-mono tabular-nums">{formatElapsedMs(snapshot.elapsedMs)}</span>
            )}
          </div>
        </div>

        <div
          className="text-xs text-gray-900"
          role="status"
          aria-live="polite"
        >
          {effectiveStatus === "idle" && "9 items split into 3 compartments of 3. Compartment 2 has a deterministic failure to demonstrate isolation."}
          {effectiveStatus === "running" && "Promise.allSettled() processing items in parallel within each compartment."}
          {effectiveStatus === "pacing" && "sleep(\"1s\") — durable pacing between compartments."}
          {effectiveStatus === "summarizing" && "Aggregating results across all compartments."}
          {effectiveStatus === "done" && "All compartments settled. Failures were isolated — they did not cascade."}
        </div>

        {snapshot && (
          <div className="grid gap-3 sm:grid-cols-3">
            {snapshot.compartments.map((comp) => (
              <CompartmentCard key={comp.index} compartment={comp} />
            ))}
          </div>
        )}

        {snapshot?.summary && (
          <div className="flex flex-wrap items-center gap-4 border-t border-gray-400 pt-3 text-sm">
            <span className="text-gray-1000">{snapshot.summary.total} items</span>
            <span className="text-green-700">{snapshot.summary.succeeded} succeeded</span>
            {snapshot.summary.failed > 0 && (
              <span className="text-red-700">{snapshot.summary.failed} failed</span>
            )}
            <span className="text-gray-900">{snapshot.summary.compartments} compartments</span>
          </div>
        )}
      </div>

      <BulkheadCodeWorkbench
        workflowCode={workflowCode}
        workflowLinesHtml={workflowLinesHtml}
        workflowActiveLines={highlights.workflowActiveLines}
        workflowGutterMarks={highlights.workflowGutterMarks}
        stepCode={stepCode}
        stepLinesHtml={stepLinesHtml}
        stepActiveLines={highlights.stepActiveLines}
        stepGutterMarks={highlights.stepGutterMarks}
        tone={highlightTone}
      />
    </div>
  );
}

function CompartmentCard({ compartment }: { compartment: CompartmentState }) {
  const hasFailed = compartment.items.some((it) => it.status === "failure");
  const allDone = compartment.status === "done";

  const borderColor = allDone
    ? hasFailed
      ? "border-red-700/40"
      : "border-green-700/40"
    : compartment.status === "processing"
    ? "border-amber-700/40"
    : "border-gray-400/40";

  return (
    <div className={`rounded-md border ${borderColor} bg-background-200 px-3 py-2`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-1000">
          Compartment {compartment.index}
        </span>
        <CompartmentBadge status={compartment.status} hasFailed={hasFailed} />
      </div>
      <ul className="space-y-1">
        {compartment.items.map((it) => (
          <li key={it.item} className="flex items-center justify-between text-xs">
            <span className="font-mono text-gray-1000">{it.item}</span>
            <ItemBadge status={it.status} error={it.error} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CompartmentBadge({ status, hasFailed }: { status: string; hasFailed: boolean }) {
  if (status === "done" && hasFailed) {
    return (
      <span className="rounded-full bg-red-700/10 px-2 py-0.5 text-xs font-medium text-red-700">
        partial
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="rounded-full bg-green-700/20 px-2 py-0.5 text-xs font-medium text-green-700">
        done
      </span>
    );
  }
  if (status === "processing") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        processing
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-900">
      pending
    </span>
  );
}

function ItemBadge({ status, error }: { status: ItemStatus; error?: string }) {
  if (status === "success") {
    return (
      <span className="flex items-center gap-1">
        <svg className="h-3.5 w-3.5 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  if (status === "failure") {
    return (
      <span className="flex items-center gap-1" title={error}>
        <svg className="h-3.5 w-3.5 text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </span>
    );
  }
  if (status === "processing") {
    return <span className="h-2 w-2 animate-pulse rounded-full bg-amber-700" />;
  }
  return <span className="h-2 w-2 rounded-full bg-gray-500" />;
}

function RunStatusBadge({ status }: { status: RunStatus }) {
  if (status === "done") {
    return (
      <span className="rounded-full bg-green-700/20 px-2 py-0.5 text-xs font-medium text-green-700">
        done
      </span>
    );
  }
  if (status === "summarizing") {
    return (
      <span className="rounded-full bg-cyan-700/20 px-2 py-0.5 text-xs font-medium text-cyan-700">
        summarizing
      </span>
    );
  }
  if (status === "pacing") {
    return (
      <span className="rounded-full bg-cyan-700/20 px-2 py-0.5 text-xs font-medium text-cyan-700">
        pacing
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        running
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-900">
      idle
    </span>
  );
}
