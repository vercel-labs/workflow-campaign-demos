// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MRCodeWorkbench } from "@/map-reduce/app/components/mr-code-workbench";

type RunStatus = "partitioning" | "mapping" | "reducing" | "done";
type PartitionStatus = "pending" | "mapping" | "mapped";
type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail";

type MapReduceEvent =
  | { type: "partitioning"; totalItems: number; chunkCount: number }
  | { type: "partition_created"; partitionIndex: number; itemCount: number }
  | { type: "mapping"; partitionIndex: number }
  | { type: "mapped"; partitionIndex: number; partialSum: number; partialCount: number }
  | { type: "reducing" }
  | { type: "done"; summary: { totalSum: number; totalCount: number; average: number } };

type PartitionSnapshot = {
  index: number;
  itemCount: number;
  status: PartitionStatus;
  partialSum?: number;
  partialCount?: number;
};

type MRSnapshot = {
  runId: string;
  status: RunStatus;
  elapsedMs: number;
  totalItems: number;
  partitions: PartitionSnapshot[];
  summary?: { totalSum: number; totalCount: number; average: number };
};

type StartResponse = {
  runId: string;
  jobId: string;
  items: number[];
  chunkSize: number;
  status: "mapping";
};

type PartitionAccumulator = {
  index: number;
  itemCount: number;
  status: PartitionStatus;
  partialSum?: number;
  partialCount?: number;
};

type MRAccumulator = {
  runId: string;
  status: RunStatus;
  totalItems: number;
  partitions: PartitionAccumulator[];
  summary?: { totalSum: number; totalCount: number; average: number };
};

type WorkflowLineMap = {
  promiseAll: number[];
  returnReduce: number[];
};

type StepLineMap = {
  mapPartition: number[];
  reduceResults: number[];
};

type DemoProps = {
  workflowCode: string;
  workflowLinesHtml: string[];
  stepCode: string;
  stepLinesHtml: string[];
  workflowLineMap: WorkflowLineMap;
  stepLineMap: StepLineMap;
};

type HighlightState = {
  workflowActiveLines: number[];
  stepActiveLines: number[];
  workflowGutterMarks: Record<number, GutterMarkKind>;
  stepGutterMarks: Record<number, GutterMarkKind>;
};

const ELAPSED_TICK_MS = 120;

const EMPTY_HIGHLIGHT_STATE: HighlightState = {
  workflowActiveLines: [],
  stepActiveLines: [],
  workflowGutterMarks: {},
  stepGutterMarks: {},
};

function createAccumulator(start: StartResponse): MRAccumulator {
  return {
    runId: start.runId,
    status: "partitioning",
    totalItems: start.items.length,
    partitions: [],
  };
}

function applyMREvent(
  current: MRAccumulator,
  event: MapReduceEvent
): MRAccumulator {
  if (event.type === "partitioning") {
    return {
      ...current,
      status: "partitioning",
      totalItems: event.totalItems,
    };
  }

  if (event.type === "partition_created") {
    const partitions = [
      ...current.partitions,
      {
        index: event.partitionIndex,
        itemCount: event.itemCount,
        status: "pending" as PartitionStatus,
      },
    ];
    return { ...current, partitions };
  }

  if (event.type === "mapping") {
    const partitions = current.partitions.map((p) =>
      p.index === event.partitionIndex ? { ...p, status: "mapping" as PartitionStatus } : p
    );
    return { ...current, status: "mapping", partitions };
  }

  if (event.type === "mapped") {
    const partitions = current.partitions.map((p) =>
      p.index === event.partitionIndex
        ? {
            ...p,
            status: "mapped" as PartitionStatus,
            partialSum: event.partialSum,
            partialCount: event.partialCount,
          }
        : p
    );
    return { ...current, partitions };
  }

  if (event.type === "reducing") {
    return { ...current, status: "reducing" };
  }

  if (event.type === "done") {
    return { ...current, status: "done", summary: event.summary };
  }

  return current;
}

function toSnapshot(
  accumulator: MRAccumulator,
  startedAtMs: number
): MRSnapshot {
  return {
    runId: accumulator.runId,
    status: accumulator.status,
    elapsedMs: Math.max(0, Date.now() - startedAtMs),
    totalItems: accumulator.totalItems,
    partitions: accumulator.partitions.map((p) => ({
      index: p.index,
      itemCount: p.itemCount,
      status: p.status,
      partialSum: p.partialSum,
      partialCount: p.partialCount,
    })),
    summary: accumulator.summary,
  };
}

function parseSseData(rawChunk: string): string {
  return rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
}

function parseMREvent(rawChunk: string): MapReduceEvent | null {
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

  if (type === "partitioning" && typeof event.totalItems === "number" && typeof event.chunkCount === "number") {
    return { type, totalItems: event.totalItems, chunkCount: event.chunkCount };
  }
  if (type === "partition_created" && typeof event.partitionIndex === "number" && typeof event.itemCount === "number") {
    return { type, partitionIndex: event.partitionIndex, itemCount: event.itemCount };
  }
  if (type === "mapping" && typeof event.partitionIndex === "number") {
    return { type, partitionIndex: event.partitionIndex };
  }
  if (type === "mapped" && typeof event.partitionIndex === "number" && typeof event.partialSum === "number" && typeof event.partialCount === "number") {
    return { type, partitionIndex: event.partitionIndex, partialSum: event.partialSum, partialCount: event.partialCount };
  }
  if (type === "reducing") {
    return { type };
  }
  if (type === "done" && event.summary && typeof event.summary === "object") {
    const summary = event.summary as { totalSum?: unknown; totalCount?: unknown; average?: unknown };
    if (typeof summary.totalSum === "number" && typeof summary.totalCount === "number" && typeof summary.average === "number") {
      return { type, summary: { totalSum: summary.totalSum, totalCount: summary.totalCount, average: summary.average } };
    }
  }

  return null;
}

function formatElapsedMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function buildHighlightState(
  snapshot: MRSnapshot | null,
  workflowLineMap: WorkflowLineMap,
  stepLineMap: StepLineMap
): HighlightState {
  if (!snapshot) return EMPTY_HIGHLIGHT_STATE;

  const workflowGutterMarks: Record<number, GutterMarkKind> = {};
  const stepGutterMarks: Record<number, GutterMarkKind> = {};

  if (snapshot.status === "partitioning") {
    return {
      workflowActiveLines: workflowLineMap.promiseAll,
      stepActiveLines: [],
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (snapshot.status === "mapping") {
    return {
      workflowActiveLines: workflowLineMap.promiseAll,
      stepActiveLines: stepLineMap.mapPartition,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (snapshot.status === "reducing") {
    return {
      workflowActiveLines: workflowLineMap.returnReduce,
      stepActiveLines: stepLineMap.reduceResults,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (snapshot.status === "done") {
    for (const line of workflowLineMap.promiseAll) {
      workflowGutterMarks[line] = "success";
    }
    for (const line of workflowLineMap.returnReduce) {
      workflowGutterMarks[line] = "success";
    }
    for (const line of stepLineMap.mapPartition) {
      stepGutterMarks[line] = "success";
    }
    for (const line of stepLineMap.reduceResults) {
      stepGutterMarks[line] = "success";
    }

    return {
      workflowActiveLines: [],
      stepActiveLines: [],
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  return EMPTY_HIGHLIGHT_STATE;
}

function highlightToneForSnapshot(snapshot: MRSnapshot | null): HighlightTone {
  if (!snapshot) return "amber";
  if (snapshot.status === "done") return "green";
  if (snapshot.status === "reducing") return "cyan";
  return "amber";
}

async function postJson<TResponse>(
  url: string,
  body: unknown,
  signal?: AbortSignal
): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed: ${response.status}`);
  }

  return payload as TResponse;
}

export function MapReduceDemo({
  workflowCode,
  workflowLinesHtml,
  stepCode,
  stepLinesHtml,
  workflowLineMap,
  stepLineMap,
}: DemoProps) {
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<MRSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const accumulatorRef = useRef<MRAccumulator | null>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);

  const stopElapsedTicker = useCallback(() => {
    if (!elapsedRef.current) return;
    clearInterval(elapsedRef.current);
    elapsedRef.current = null;
  }, []);

  const startElapsedTicker = useCallback(() => {
    stopElapsedTicker();
    elapsedRef.current = setInterval(() => {
      const startedAtMs = startedAtRef.current;
      if (!startedAtMs) return;
      setSnapshot((previous) => {
        if (!previous || previous.status === "done") return previous;
        return { ...previous, elapsedMs: Math.max(0, Date.now() - startedAtMs) };
      });
    }, ELAPSED_TICK_MS);
  }, [stopElapsedTicker]);

  const ensureAbortController = useCallback((): AbortController => {
    if (abortRef.current && !abortRef.current.signal.aborted) {
      return abortRef.current;
    }
    const next = new AbortController();
    abortRef.current = next;
    return next;
  }, []);

  useEffect(() => {
    return () => {
      stopElapsedTicker();
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [stopElapsedTicker]);

  const connectToReadable = useCallback(
    async (start: StartResponse) => {
      const controller = ensureAbortController();
      const signal = controller.signal;

      try {
        const response = await fetch(
          `/api/readable/${encodeURIComponent(start.runId)}`,
          { cache: "no-store", signal }
        );

        if (signal.aborted) return;

        if (!response.ok || !response.body) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(
            payload?.error ?? `Readable stream request failed: ${response.status}`
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const applyEvent = (event: MapReduceEvent) => {
          if (signal.aborted || !startedAtRef.current || !accumulatorRef.current) return;
          const nextAccumulator = applyMREvent(accumulatorRef.current, event);
          accumulatorRef.current = nextAccumulator;
          setSnapshot(toSnapshot(nextAccumulator, startedAtRef.current));
          if (nextAccumulator.status === "done") stopElapsedTicker();
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const normalized = buffer.replaceAll("\r\n", "\n");
          const chunks = normalized.split("\n\n");
          buffer = chunks.pop() ?? "";
          for (const chunk of chunks) {
            if (signal.aborted) return;
            const event = parseMREvent(chunk);
            if (event) applyEvent(event);
          }
        }

        if (!signal.aborted && buffer.trim()) {
          const event = parseMREvent(buffer.replaceAll("\r\n", "\n"));
          if (event) applyEvent(event);
        }
      } catch (cause: unknown) {
        if (cause instanceof Error && cause.name === "AbortError") return;
        if (signal.aborted) return;
        const detail = cause instanceof Error ? cause.message : "Readable stream failed";
        setError(detail);
        stopElapsedTicker();
      } finally {
        if (accumulatorRef.current?.status === "done") stopElapsedTicker();
      }
    },
    [ensureAbortController, stopElapsedTicker]
  );

  const handleStart = async () => {
    setError(null);
    setSnapshot(null);
    setRunId(null);
    stopElapsedTicker();
    abortRef.current?.abort();
    abortRef.current = null;
    startedAtRef.current = null;
    accumulatorRef.current = null;

    try {
      const controller = ensureAbortController();
      const payload = await postJson<StartResponse>(
        "/api/map-reduce",
        { jobId: `mr-${Date.now()}`, items: [10, 20, 30, 40, 50, 60, 70, 80, 90], chunkSize: 3 },
        controller.signal
      );
      if (controller.signal.aborted) return;

      const startedAt = Date.now();
      const nextAccumulator = createAccumulator(payload);
      startedAtRef.current = startedAt;
      accumulatorRef.current = nextAccumulator;
      setRunId(payload.runId);
      setSnapshot(toSnapshot(nextAccumulator, startedAt));

      if (controller.signal.aborted) return;
      startElapsedTicker();
      void connectToReadable(payload);
    } catch (cause: unknown) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      const detail = cause instanceof Error ? cause.message : "Unknown error";
      setError(detail);
    }
  };

  const handleReset = () => {
    stopElapsedTicker();
    abortRef.current?.abort();
    abortRef.current = null;
    startedAtRef.current = null;
    accumulatorRef.current = null;
    setRunId(null);
    setSnapshot(null);
    setError(null);
    setTimeout(() => startButtonRef.current?.focus(), 0);
  };

  const effectiveStatus: RunStatus | "idle" =
    snapshot?.status ?? (runId ? "partitioning" : "idle");
  const isRunning = runId !== null && snapshot?.status !== "done";

  const highlights = useMemo(
    () => buildHighlightState(snapshot, workflowLineMap, stepLineMap),
    [snapshot, workflowLineMap, stepLineMap]
  );
  const highlightTone = useMemo(
    () => highlightToneForSnapshot(snapshot),
    [snapshot]
  );

  const partitions: PartitionSnapshot[] = snapshot?.partitions ?? [];

  const mappedCount = partitions.filter((p) => p.status === "mapped").length;
  const activePartition = partitions.find((p) => p.status === "mapping");

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-700/40 bg-red-700/10 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-gray-400 bg-background-100 p-4">
          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                ref={startButtonRef}
                onClick={() => void handleStart()}
                disabled={isRunning}
                className="cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Run Map-Reduce
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
                Reset Demo
              </button>

              <div className="flex items-center gap-2 rounded-md border border-gray-400/70 bg-background-100 px-2 py-1 text-xs text-gray-900">
                <span className="font-semibold uppercase tracking-wide text-gray-900">
                  Items
                </span>
                <code className="font-mono text-cyan-700">9</code>
              </div>

              <div className="flex items-center gap-2 rounded-md border border-gray-400/70 bg-background-100 px-2 py-1 text-xs text-gray-900">
                <span className="font-semibold uppercase tracking-wide text-gray-900">
                  Chunk Size
                </span>
                <code className="font-mono text-cyan-700">3</code>
              </div>
            </div>
          </div>

          <div
            className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2 text-xs text-gray-900"
            role="status"
            aria-live="polite"
          >
            {effectiveStatus === "idle"
              ? "Waiting to start. Click Run Map-Reduce to partition, map, and reduce."
              : effectiveStatus === "partitioning"
                ? "Partitioning input into chunks..."
                : effectiveStatus === "mapping"
                  ? activePartition
                    ? `Mapping partition ${activePartition.index}... (${mappedCount}/${partitions.length} complete)`
                    : `Mapping ${partitions.length} partitions in parallel...`
                  : effectiveStatus === "reducing"
                    ? "Reducing partition results into final aggregate..."
                    : `Done: sum=${snapshot?.summary?.totalSum ?? 0}, count=${snapshot?.summary?.totalCount ?? 0}, avg=${snapshot?.summary?.average?.toFixed(1) ?? 0}`}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-gray-400 bg-background-100 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-900">
              Workflow Phase
            </span>
            <RunStatusBadge status={effectiveStatus} />
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">runId</span>
              <code className="font-mono text-xs text-gray-1000">
                {runId ?? "not started"}
              </code>
            </div>
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">Elapsed</span>
              <span className="font-mono text-gray-1000 tabular-nums">
                {snapshot ? formatElapsedMs(snapshot.elapsedMs) : "0.00s"}
              </span>
            </div>
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">Active Step</span>
              <code className="font-mono text-gray-1000">
                {effectiveStatus === "mapping"
                  ? activePartition
                    ? `mapPartition(${activePartition.index})`
                    : "mapPartition"
                  : effectiveStatus === "reducing"
                    ? "reduceResults"
                    : effectiveStatus === "done"
                      ? "reduceResults"
                      : "-"}
              </code>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-gray-400 bg-background-100 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
          Partitions
        </p>
        <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
          {partitions.length === 0 ? (
            <div className="text-xs text-gray-900 px-3 py-1.5">
              No partitions yet. Click Run Map-Reduce to begin.
            </div>
          ) : (
            partitions.map((partition) => (
              <div
                key={partition.index}
                className="flex items-center justify-between rounded-md border border-gray-400/70 bg-background-200 px-3 py-1.5"
              >
                <div className="flex items-center gap-3">
                  <code className="font-mono text-sm text-gray-1000">
                    partition[{partition.index}]
                  </code>
                  <span className="font-mono text-xs text-gray-900">
                    {partition.itemCount} items
                  </span>
                  {partition.status === "mapped" && partition.partialSum !== undefined && (
                    <span className="font-mono text-xs text-cyan-700">
                      sum={partition.partialSum}
                    </span>
                  )}
                </div>
                <PartitionStatusBadge status={partition.status} />
              </div>
            ))
          )}
        </div>
      </div>

      {snapshot?.status === "done" && snapshot.summary && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md border border-green-700/40 bg-green-700/10 px-4 py-3 text-center">
            <p className="text-2xl font-semibold text-green-700 tabular-nums">
              {snapshot.summary.totalSum}
            </p>
            <p className="text-xs text-gray-900">Total Sum</p>
          </div>
          <div className="rounded-md border border-cyan-700/40 bg-cyan-700/10 px-4 py-3 text-center">
            <p className="text-2xl font-semibold text-cyan-700 tabular-nums">
              {snapshot.summary.totalCount}
            </p>
            <p className="text-xs text-gray-900">Total Count</p>
          </div>
          <div className="rounded-md border border-violet-700/40 bg-violet-700/10 px-4 py-3 text-center">
            <p className="text-2xl font-semibold text-violet-700 tabular-nums">
              {snapshot.summary.average.toFixed(1)}
            </p>
            <p className="text-xs text-gray-900">Average</p>
          </div>
        </div>
      )}

      <MRCodeWorkbench
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

function RunStatusBadge({ status }: { status: RunStatus | "idle" }) {
  if (status === "done") {
    return (
      <span className="rounded-full bg-green-700/20 px-2 py-0.5 text-xs font-medium text-green-700">
        done
      </span>
    );
  }
  if (status === "reducing") {
    return (
      <span className="rounded-full bg-cyan-700/20 px-2 py-0.5 text-xs font-medium text-cyan-700">
        reducing
      </span>
    );
  }
  if (status === "mapping" || status === "partitioning") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        {status}
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-900">
      idle
    </span>
  );
}

function PartitionStatusBadge({ status }: { status: PartitionStatus }) {
  if (status === "mapped") {
    return (
      <span className="rounded-full bg-green-700/20 px-2 py-0.5 text-xs font-medium text-green-700">
        mapped
      </span>
    );
  }
  if (status === "mapping") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        mapping...
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-900">
      pending
    </span>
  );
}

const demoProps = {
  workflowCode: "",
  workflowLinesHtml: [],
  stepCode: "",
  stepLinesHtml: [],
  workflowLineMap: {},
  stepLineMap: {},
} as unknown as Parameters<typeof MapReduceDemo>[0];

export default function MapReduceNativeDemo() {
  return <MapReduceDemo {...demoProps} />;
}
