"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CCCodeWorkbench } from "./cc-code-workbench";

type RunStatus = "processing" | "done";
type ItemStatus = "pending" | "claiming" | "claimed" | "processing" | "processed";
type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail";

type CCEvent =
  | { type: "claiming"; itemId: string; consumerId: string }
  | { type: "claimed"; itemId: string; consumerId: string }
  | { type: "duplicate"; itemId: string; consumerId: string; wonBy: string }
  | { type: "processing"; itemId: string; consumerId: string }
  | { type: "processed"; itemId: string; consumerId: string }
  | { type: "done"; summary: { processed: number; duplicatesBlocked: number } };

type ItemSnapshot = {
  id: string;
  status: ItemStatus;
  claimedBy?: string;
  duplicateAttempts: string[];
};

type CCSnapshot = {
  runId: string;
  status: RunStatus;
  elapsedMs: number;
  items: ItemSnapshot[];
  summary?: { processed: number; duplicatesBlocked: number };
};

type StartResponse = {
  runId: string;
  items: string[];
  consumers: string[];
  status: "processing";
};

type ItemAccumulator = {
  status: ItemStatus;
  claimedBy?: string;
  duplicateAttempts: string[];
};

type CCAccumulator = {
  runId: string;
  status: RunStatus;
  items: Record<string, ItemAccumulator>;
  orderedIds: string[];
  summary?: { processed: number; duplicatesBlocked: number };
};

type WorkflowLineMap = {
  forLoop: number[];
  returnResults: number[];
};

type StepLineMap = {
  processItem: number[];
  recordResults: number[];
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

const DEFAULT_ITEMS = ["order-101", "order-102", "order-103", "order-104"];
const DEFAULT_CONSUMERS = ["worker-A", "worker-B", "worker-C"];

const EMPTY_HIGHLIGHT_STATE: HighlightState = {
  workflowActiveLines: [],
  stepActiveLines: [],
  workflowGutterMarks: {},
  stepGutterMarks: {},
};

function createAccumulator(start: StartResponse): CCAccumulator {
  const items: Record<string, ItemAccumulator> = {};
  for (const id of start.items) {
    items[id] = { status: "pending", duplicateAttempts: [] };
  }
  return {
    runId: start.runId,
    status: "processing",
    items,
    orderedIds: start.items,
  };
}

function applyCCEvent(
  current: CCAccumulator,
  event: CCEvent
): CCAccumulator {
  if (event.type === "done") {
    return { ...current, status: "done", summary: event.summary };
  }

  if (event.type === "claiming") {
    const items = { ...current.items };
    items[event.itemId] = {
      ...items[event.itemId],
      status: "claiming",
    };
    return { ...current, items };
  }

  if (event.type === "claimed") {
    const items = { ...current.items };
    items[event.itemId] = {
      ...items[event.itemId],
      status: "claimed",
      claimedBy: event.consumerId,
    };
    return { ...current, items };
  }

  if (event.type === "duplicate") {
    const items = { ...current.items };
    const prev = items[event.itemId];
    items[event.itemId] = {
      ...prev,
      duplicateAttempts: [...(prev?.duplicateAttempts ?? []), event.consumerId],
    };
    return { ...current, items };
  }

  if (event.type === "processing") {
    const items = { ...current.items };
    items[event.itemId] = {
      ...items[event.itemId],
      status: "processing",
    };
    return { ...current, items };
  }

  if (event.type === "processed") {
    const items = { ...current.items };
    items[event.itemId] = {
      ...items[event.itemId],
      status: "processed",
    };
    return { ...current, items };
  }

  return current;
}

function toSnapshot(
  accumulator: CCAccumulator,
  startedAtMs: number
): CCSnapshot {
  const items: ItemSnapshot[] = accumulator.orderedIds.map((id) => {
    const item = accumulator.items[id];
    return {
      id,
      status: item?.status ?? "pending",
      claimedBy: item?.claimedBy,
      duplicateAttempts: item?.duplicateAttempts ?? [],
    };
  });

  return {
    runId: accumulator.runId,
    status: accumulator.status,
    elapsedMs: Math.max(0, Date.now() - startedAtMs),
    items,
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

function parseCCEvent(rawChunk: string): CCEvent | null {
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

  if (type === "claiming" && typeof event.itemId === "string" && typeof event.consumerId === "string") {
    return { type, itemId: event.itemId, consumerId: event.consumerId };
  }
  if (type === "claimed" && typeof event.itemId === "string" && typeof event.consumerId === "string") {
    return { type, itemId: event.itemId, consumerId: event.consumerId };
  }
  if (type === "duplicate" && typeof event.itemId === "string" && typeof event.consumerId === "string" && typeof event.wonBy === "string") {
    return { type, itemId: event.itemId, consumerId: event.consumerId, wonBy: event.wonBy };
  }
  if (type === "processing" && typeof event.itemId === "string" && typeof event.consumerId === "string") {
    return { type, itemId: event.itemId, consumerId: event.consumerId };
  }
  if (type === "processed" && typeof event.itemId === "string" && typeof event.consumerId === "string") {
    return { type, itemId: event.itemId, consumerId: event.consumerId };
  }
  if (type === "done" && event.summary && typeof event.summary === "object") {
    const summary = event.summary as { processed?: unknown; duplicatesBlocked?: unknown };
    if (typeof summary.processed === "number" && typeof summary.duplicatesBlocked === "number") {
      return { type, summary: { processed: summary.processed, duplicatesBlocked: summary.duplicatesBlocked } };
    }
  }

  return null;
}

function formatElapsedMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function buildHighlightState(
  snapshot: CCSnapshot | null,
  workflowLineMap: WorkflowLineMap,
  stepLineMap: StepLineMap
): HighlightState {
  if (!snapshot) return EMPTY_HIGHLIGHT_STATE;

  const workflowGutterMarks: Record<number, GutterMarkKind> = {};
  const stepGutterMarks: Record<number, GutterMarkKind> = {};

  const activeItem = snapshot.items.find(
    (item) =>
      item.status === "claiming" ||
      item.status === "claimed" ||
      item.status === "processing"
  );

  if (snapshot.status === "processing" && activeItem) {
    return {
      workflowActiveLines: workflowLineMap.forLoop,
      stepActiveLines: stepLineMap.processItem,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (snapshot.status === "done") {
    for (const line of workflowLineMap.forLoop) {
      workflowGutterMarks[line] = "success";
    }
    for (const line of stepLineMap.recordResults) {
      stepGutterMarks[line] = "success";
    }

    return {
      workflowActiveLines: [],
      stepActiveLines: [],
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  return {
    workflowActiveLines: workflowLineMap.forLoop,
    stepActiveLines: [],
    workflowGutterMarks,
    stepGutterMarks,
  };
}

function highlightToneForSnapshot(snapshot: CCSnapshot | null): HighlightTone {
  if (!snapshot) return "amber";
  if (snapshot.status === "processing") return "amber";
  return "green";
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

export function CCDemo({
  workflowCode,
  workflowLinesHtml,
  stepCode,
  stepLinesHtml,
  workflowLineMap,
  stepLineMap,
}: DemoProps) {
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<CCSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const accumulatorRef = useRef<CCAccumulator | null>(null);
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

        const applyEvent = (event: CCEvent) => {
          if (signal.aborted || !startedAtRef.current || !accumulatorRef.current) return;
          const nextAccumulator = applyCCEvent(accumulatorRef.current, event);
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
            const event = parseCCEvent(chunk);
            if (event) applyEvent(event);
          }
        }

        if (!signal.aborted && buffer.trim()) {
          const event = parseCCEvent(buffer.replaceAll("\r\n", "\n"));
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
        "/api/competing-consumers",
        { items: DEFAULT_ITEMS, consumers: DEFAULT_CONSUMERS },
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
    snapshot?.status ?? (runId ? "processing" : "idle");
  const isRunning = runId !== null && snapshot?.status !== "done";

  const highlights = useMemo(
    () => buildHighlightState(snapshot, workflowLineMap, stepLineMap),
    [snapshot, workflowLineMap, stepLineMap]
  );
  const highlightTone = useMemo(
    () => highlightToneForSnapshot(snapshot),
    [snapshot]
  );

  const items: ItemSnapshot[] = snapshot?.items ?? DEFAULT_ITEMS.map((id) => ({
    id,
    status: "pending" as ItemStatus,
    duplicateAttempts: [],
  }));

  const activeItemId = snapshot?.items.find(
    (item) =>
      item.status === "claiming" ||
      item.status === "claimed" ||
      item.status === "processing"
  )?.id;

  const totalDuplicates = items.reduce(
    (sum, item) => sum + item.duplicateAttempts.length,
    0
  );

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
                Process Queue
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
                  Consumers
                </span>
                <code className="font-mono text-cyan-700">{DEFAULT_CONSUMERS.length}</code>
              </div>
            </div>
          </div>

          <div
            className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2 text-xs text-gray-900"
            role="status"
            aria-live="polite"
          >
            {effectiveStatus === "idle"
              ? "Waiting to start. Click Process Queue to run the workflow."
              : effectiveStatus === "processing"
                ? activeItemId
                  ? `Consumers competing for ${activeItemId}... Deterministic IDs deduplicate duplicate claims.`
                  : "Processing queue items with competing consumers..."
                : `Completed: ${snapshot?.summary?.processed ?? 0} processed, ${snapshot?.summary?.duplicatesBlocked ?? 0} duplicates blocked.`}
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
                {activeItemId ? `processItem(${activeItemId})` : effectiveStatus === "done" ? "recordResults" : "-"}
              </code>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-gray-400 bg-background-100 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
          Queue Items
        </p>
        <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-md border border-gray-400/70 bg-background-200 px-3 py-1.5"
            >
              <div className="flex items-center gap-3">
                <code className="font-mono text-sm text-gray-1000">{item.id}</code>
                {item.claimedBy && (
                  <span className="font-mono text-xs text-cyan-700">
                    {item.claimedBy}
                  </span>
                )}
                {item.duplicateAttempts.length > 0 && (
                  <span className="font-mono text-xs text-gray-900">
                    {item.duplicateAttempts.length} blocked
                  </span>
                )}
              </div>
              <ItemStatusBadge status={item.status} />
            </div>
          ))}
        </div>
      </div>

      {snapshot?.status === "done" && snapshot.summary && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-green-700/40 bg-green-700/10 px-4 py-3 text-center">
            <p className="text-2xl font-semibold text-green-700 tabular-nums">
              {snapshot.summary.processed}
            </p>
            <p className="text-xs text-gray-900">Processed</p>
          </div>
          <div className="rounded-md border border-cyan-700/40 bg-cyan-700/10 px-4 py-3 text-center">
            <p className="text-2xl font-semibold text-cyan-700 tabular-nums">
              {snapshot.summary.duplicatesBlocked}
            </p>
            <p className="text-xs text-gray-900">Duplicates Blocked</p>
          </div>
        </div>
      )}

      <CCCodeWorkbench
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
  if (status === "processing") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        processing
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-900">
      idle
    </span>
  );
}

function ItemStatusBadge({ status }: { status: ItemStatus }) {
  if (status === "processed") {
    return (
      <span className="rounded-full bg-green-700/20 px-2 py-0.5 text-xs font-medium text-green-700">
        processed
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
  if (status === "claiming") {
    return (
      <span className="rounded-full bg-cyan-700/20 px-2 py-0.5 text-xs font-medium text-cyan-700">
        claiming...
      </span>
    );
  }
  if (status === "claimed") {
    return (
      <span className="rounded-full bg-cyan-700/20 px-2 py-0.5 text-xs font-medium text-cyan-700">
        claimed
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-900">
      pending
    </span>
  );
}
