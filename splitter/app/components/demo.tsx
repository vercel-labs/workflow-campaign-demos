"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SplitterCodeWorkbench } from "./splitter-code-workbench";

type ItemStatus = "pending" | "processing" | "validated" | "reserved" | "fulfilled" | "failed";
type RunStatus = "splitting" | "aggregating" | "done";
type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail";

type SplitterEvent =
  | { type: "splitting"; orderId: string; itemCount: number }
  | { type: "item_processing"; index: number; sku: string; name: string }
  | { type: "item_validated"; index: number; sku: string }
  | { type: "item_reserved"; index: number; sku: string; warehouse: string }
  | { type: "item_fulfilled"; index: number; sku: string; hookToken: string }
  | { type: "item_failed"; index: number; sku: string; error: string }
  | { type: "aggregating" }
  | { type: "done"; summary: { fulfilled: number; failed: number; total: number } };

type ItemAccumulator = {
  index: number;
  sku: string;
  name: string;
  status: ItemStatus;
  warehouse?: string;
  hookToken?: string;
  error?: string;
};

type SplitterAccumulator = {
  runId: string;
  orderId: string;
  status: RunStatus;
  items: ItemAccumulator[];
  summary?: { fulfilled: number; failed: number; total: number };
};

type SplitterSnapshot = {
  runId: string;
  orderId: string;
  status: RunStatus;
  elapsedMs: number;
  items: ItemAccumulator[];
  activeItemIndex: number | null;
  summary?: { fulfilled: number; failed: number; total: number };
};

type StartResponse = {
  runId: string;
  orderId: string;
  itemCount: number;
  status: "splitting";
};

type WorkflowLineMap = {
  splitting: number[];
  forLoop: number[];
  aggregating: number[];
  done: number[];
};

type StepLineMap = {
  processing: number[];
  validated: number[];
  failed: number[];
  reserved: number[];
  fulfilled: number[];
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

const DEFAULT_ITEMS = [
  { sku: "WIDGET-A1", name: "Widget Alpha", quantity: 2, warehouse: "us-east-1" },
  { sku: "GADGET-B2", name: "Gadget Beta", quantity: 1, warehouse: "us-west-2" },
  { sku: "SPRING-C3", name: "Spring Coil", quantity: 5, warehouse: "eu-west-1" },
];

export function createAccumulator(start: StartResponse): SplitterAccumulator {
  return {
    runId: start.runId,
    orderId: start.orderId,
    status: "splitting",
    items: [],
  };
}

export function applySplitEvent(
  current: SplitterAccumulator,
  event: SplitterEvent
): SplitterAccumulator {
  if (event.type === "splitting") {
    return { ...current, status: "splitting" };
  }

  if (event.type === "aggregating") {
    return { ...current, status: "aggregating" };
  }

  if (event.type === "done") {
    return { ...current, status: "done", summary: event.summary };
  }

  if (event.type === "item_processing") {
    const existing = current.items.find((it) => it.index === event.index);
    if (existing) {
      return {
        ...current,
        items: current.items.map((it) =>
          it.index === event.index ? { ...it, status: "processing" as const } : it
        ),
      };
    }
    return {
      ...current,
      items: [
        ...current.items,
        { index: event.index, sku: event.sku, name: event.name, status: "processing" },
      ],
    };
  }

  if (event.type === "item_validated") {
    return {
      ...current,
      items: current.items.map((it) =>
        it.index === event.index ? { ...it, status: "validated" as const } : it
      ),
    };
  }

  if (event.type === "item_reserved") {
    return {
      ...current,
      items: current.items.map((it) =>
        it.index === event.index
          ? { ...it, status: "reserved" as const, warehouse: event.warehouse }
          : it
      ),
    };
  }

  if (event.type === "item_fulfilled") {
    return {
      ...current,
      items: current.items.map((it) =>
        it.index === event.index
          ? { ...it, status: "fulfilled" as const, hookToken: event.hookToken }
          : it
      ),
    };
  }

  if (event.type === "item_failed") {
    return {
      ...current,
      items: current.items.map((it) =>
        it.index === event.index
          ? { ...it, status: "failed" as const, error: event.error }
          : it
      ),
    };
  }

  return current;
}

function toSnapshot(
  accumulator: SplitterAccumulator,
  startedAtMs: number
): SplitterSnapshot {
  const activeItem = accumulator.items.find(
    (it) =>
      it.status === "processing" ||
      it.status === "validated" ||
      it.status === "reserved"
  );

  return {
    runId: accumulator.runId,
    orderId: accumulator.orderId,
    status: accumulator.status,
    elapsedMs: Math.max(0, Date.now() - startedAtMs),
    items: accumulator.items,
    activeItemIndex: activeItem?.index ?? null,
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

export function parseSplitterEvent(rawChunk: string): SplitterEvent | null {
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

  if (type === "splitting" && typeof event.orderId === "string" && typeof event.itemCount === "number") {
    return { type, orderId: event.orderId, itemCount: event.itemCount };
  }
  if (type === "item_processing" && typeof event.index === "number" && typeof event.sku === "string" && typeof event.name === "string") {
    return { type, index: event.index, sku: event.sku, name: event.name };
  }
  if (type === "item_validated" && typeof event.index === "number" && typeof event.sku === "string") {
    return { type, index: event.index, sku: event.sku };
  }
  if (type === "item_reserved" && typeof event.index === "number" && typeof event.sku === "string" && typeof event.warehouse === "string") {
    return { type, index: event.index, sku: event.sku, warehouse: event.warehouse };
  }
  if (type === "item_fulfilled" && typeof event.index === "number" && typeof event.sku === "string" && typeof event.hookToken === "string") {
    return { type, index: event.index, sku: event.sku, hookToken: event.hookToken };
  }
  if (type === "item_failed" && typeof event.index === "number" && typeof event.sku === "string" && typeof event.error === "string") {
    return { type, index: event.index, sku: event.sku, error: event.error };
  }
  if (type === "aggregating") {
    return { type };
  }
  if (
    type === "done" &&
    event.summary &&
    typeof event.summary === "object" &&
    typeof (event.summary as { fulfilled?: unknown }).fulfilled === "number" &&
    typeof (event.summary as { failed?: unknown }).failed === "number" &&
    typeof (event.summary as { total?: unknown }).total === "number"
  ) {
    const summary = event.summary as { fulfilled: number; failed: number; total: number };
    return { type, summary };
  }

  return null;
}

const EMPTY_HIGHLIGHT_STATE: HighlightState = {
  workflowActiveLines: [],
  stepActiveLines: [],
  workflowGutterMarks: {},
  stepGutterMarks: {},
};

function formatElapsedMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function addGutterMarks(
  target: Record<number, GutterMarkKind>,
  lines: number[],
  kind: GutterMarkKind = "success"
) {
  for (const lineNumber of lines) {
    target[lineNumber] = kind;
  }
}

function highlightToneForSnapshot(snapshot: SplitterSnapshot | null): HighlightTone {
  if (!snapshot) return "amber";
  if (snapshot.status === "splitting") return "amber";
  if (snapshot.status === "aggregating") return "cyan";
  return snapshot.summary?.failed ? "red" : "green";
}

function buildHighlightState(
  snapshot: SplitterSnapshot | null,
  workflowLineMap: WorkflowLineMap,
  stepLineMap: StepLineMap
): HighlightState {
  if (!snapshot) return EMPTY_HIGHLIGHT_STATE;

  const workflowGutterMarks: Record<number, GutterMarkKind> = {};
  const stepGutterMarks: Record<number, GutterMarkKind> = {};

  if (snapshot.status === "splitting") {
    const activeItem = snapshot.items.find(
      (it) => it.status === "processing" || it.status === "validated" || it.status === "reserved"
    );

    // Mark completed items in step pane
    for (const item of snapshot.items) {
      if (item.status === "fulfilled") {
        addGutterMarks(stepGutterMarks, stepLineMap.fulfilled, "success");
      } else if (item.status === "failed") {
        addGutterMarks(stepGutterMarks, stepLineMap.failed, "fail");
      }
    }

    let stepActiveLines: number[] = [];
    if (activeItem) {
      if (activeItem.status === "processing") stepActiveLines = stepLineMap.processing;
      else if (activeItem.status === "validated") stepActiveLines = stepLineMap.validated;
      else if (activeItem.status === "reserved") stepActiveLines = stepLineMap.reserved;
    }

    return {
      workflowActiveLines: workflowLineMap.forLoop,
      stepActiveLines,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (snapshot.status === "aggregating") {
    addGutterMarks(workflowGutterMarks, workflowLineMap.forLoop.slice(0, 1));

    for (const item of snapshot.items) {
      if (item.status === "fulfilled") {
        addGutterMarks(stepGutterMarks, stepLineMap.fulfilled, "success");
      } else if (item.status === "failed") {
        addGutterMarks(stepGutterMarks, stepLineMap.failed, "fail");
      }
    }

    return {
      workflowActiveLines: workflowLineMap.aggregating,
      stepActiveLines: [],
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  // done
  addGutterMarks(
    workflowGutterMarks,
    [...workflowLineMap.forLoop.slice(0, 1), ...workflowLineMap.aggregating.slice(0, 1)]
  );

  for (const item of snapshot.items) {
    if (item.status === "fulfilled") {
      addGutterMarks(stepGutterMarks, stepLineMap.fulfilled, "success");
    } else if (item.status === "failed") {
      addGutterMarks(stepGutterMarks, stepLineMap.failed, "fail");
    }
  }

  return {
    workflowActiveLines: workflowLineMap.done,
    stepActiveLines: [],
    workflowGutterMarks,
    stepGutterMarks,
  };
}

type LogTone = "default" | "green" | "amber" | "red" | "cyan";
type LogEntry = { text: string; tone: LogTone };

function eventToLogEntry(event: SplitterEvent, elapsedMs: number): LogEntry {
  const ts = formatElapsedMs(elapsedMs);

  switch (event.type) {
    case "splitting":
      return { text: `[${ts}] splitting order ${event.orderId} into ${event.itemCount} items`, tone: "default" };
    case "item_processing":
      return { text: `[${ts}] processing item[${event.index}] ${event.sku} (${event.name})`, tone: "default" };
    case "item_validated":
      return { text: `[${ts}] item[${event.index}] ${event.sku} validated`, tone: "amber" };
    case "item_reserved":
      return { text: `[${ts}] item[${event.index}] ${event.sku} reserved at ${event.warehouse}`, tone: "amber" };
    case "item_fulfilled":
      return { text: `[${ts}] item[${event.index}] ${event.sku} fulfilled`, tone: "green" };
    case "item_failed":
      return { text: `[${ts}] item[${event.index}] ${event.sku} failed: ${event.error}`, tone: "red" };
    case "aggregating":
      return { text: `[${ts}] aggregating results`, tone: "cyan" };
    case "done": {
      const tone: LogTone = event.summary.failed > 0 ? "red" : "green";
      return { text: `[${ts}] done — fulfilled=${event.summary.fulfilled}, failed=${event.summary.failed}, total=${event.summary.total}`, tone };
    }
  }
}

const IDLE_LOG: LogEntry[] = [
  { text: "Idle: click Split Order to start the run.", tone: "default" },
  { text: "Each line item will be processed through validate -> reserve -> fulfill.", tone: "default" },
];

const LOG_TONE_CLASS: Record<LogTone, string> = {
  default: "text-gray-900",
  green: "text-green-700",
  amber: "text-amber-700",
  red: "text-red-700",
  cyan: "text-cyan-700",
};

function itemStatusColor(status: ItemStatus): string {
  if (status === "fulfilled") return "var(--color-green-700)";
  if (status === "failed") return "var(--color-red-700)";
  if (status === "processing" || status === "validated" || status === "reserved")
    return "var(--color-amber-700)";
  return "var(--color-gray-500)";
}

function statusExplanation(
  status: RunStatus | "idle",
  activeItemIndex: number | null
): string {
  if (status === "idle") {
    return "Waiting to start. Click Split Order to decompose a composite order into line items.";
  }
  if (status === "splitting") {
    if (activeItemIndex !== null) {
      return `Splitting active: processing item[${activeItemIndex}] through validate -> reserve -> fulfill.`;
    }
    return "Splitting active: processing line items sequentially.";
  }
  if (status === "aggregating") {
    return "Aggregation active: computing fulfillment summary from all item results.";
  }
  return "Completed: all items processed and summary checkpoint persisted.";
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

export function SplitterDemo({
  workflowCode,
  workflowLinesHtml,
  stepCode,
  stepLinesHtml,
  workflowLineMap,
  stepLineMap,
}: DemoProps) {
  const [failIndices, setFailIndices] = useState<Set<number>>(new Set());
  const [itemCount, setItemCount] = useState(DEFAULT_ITEMS.length);
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SplitterSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<LogEntry[]>(IDLE_LOG);

  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const accumulatorRef = useRef<SplitterAccumulator | null>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    if (runId && !hasScrolledRef.current) {
      hasScrolledRef.current = true;
      const heading = document.getElementById("try-it-heading");
      if (heading) {
        const top = heading.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top, behavior: "smooth" });
      }
    }
    if (!runId) {
      hasScrolledRef.current = false;
    }
  }, [runId]);

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
    if (!abortRef.current || abortRef.current.signal.aborted) {
      abortRef.current = new AbortController();
    }
    return abortRef.current;
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

        const applyEvent = (event: SplitterEvent) => {
          if (signal.aborted || !startedAtRef.current || !accumulatorRef.current) return;

          const elapsedMs = Math.max(0, Date.now() - startedAtRef.current);
          const nextAccumulator = applySplitEvent(accumulatorRef.current, event);
          accumulatorRef.current = nextAccumulator;

          setSnapshot(toSnapshot(nextAccumulator, startedAtRef.current));
          setEventLog((prev) => [...prev, eventToLogEntry(event, elapsedMs)]);

          if (nextAccumulator.status === "done") {
            stopElapsedTicker();
          }
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
            const event = parseSplitterEvent(chunk);
            if (event) applyEvent(event);
          }
        }

        if (!signal.aborted && buffer.trim()) {
          const event = parseSplitterEvent(buffer.replaceAll("\r\n", "\n"));
          if (event) applyEvent(event);
        }
      } catch (cause: unknown) {
        if (cause instanceof Error && cause.name === "AbortError") return;
        if (signal.aborted) return;

        const detail = cause instanceof Error ? cause.message : "Readable stream failed";
        setError(detail);
        stopElapsedTicker();
      } finally {
        if (accumulatorRef.current?.status === "done") {
          stopElapsedTicker();
        }
      }
    },
    [ensureAbortController, stopElapsedTicker]
  );

  const handleStart = async () => {
    setError(null);
    setSnapshot(null);
    setRunId(null);
    setEventLog([]);

    stopElapsedTicker();
    abortRef.current?.abort();
    abortRef.current = null;
    startedAtRef.current = null;
    accumulatorRef.current = null;

    try {
      const controller = ensureAbortController();
      const items = DEFAULT_ITEMS.slice(0, itemCount);
      const failures = { failIndices: [...failIndices].filter((i) => i < itemCount) };

      const payload = await postJson<StartResponse>(
        "/api/splitter",
        {
          orderId: `ORD-${Date.now().toString(36).toUpperCase()}`,
          items,
          failures,
        },
        controller.signal
      );
      if (controller.signal.aborted) return;

      const startedAt = Date.now();
      const nextAccumulator = createAccumulator(payload);
      startedAtRef.current = startedAt;
      accumulatorRef.current = nextAccumulator;
      setRunId(payload.runId);
      setSnapshot(toSnapshot(nextAccumulator, startedAt));
      setEventLog([
        { text: `[0.00s] order ${payload.orderId} queued with ${payload.itemCount} items`, tone: "default" },
      ]);

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
    setEventLog(IDLE_LOG);
    setTimeout(() => {
      startButtonRef.current?.focus();
    }, 0);
  };

  const effectiveStatus: RunStatus | "idle" =
    snapshot?.status ?? (runId ? "splitting" : "idle");
  const isRunning = runId !== null && snapshot?.status !== "done";

  const highlights = useMemo(
    () => buildHighlightState(snapshot, workflowLineMap, stepLineMap),
    [snapshot, workflowLineMap, stepLineMap]
  );
  const highlightTone = useMemo(
    () => highlightToneForSnapshot(snapshot),
    [snapshot]
  );

  const displayItems = useMemo(() => {
    if (!snapshot || snapshot.items.length === 0) {
      return DEFAULT_ITEMS.slice(0, itemCount).map((item, i) => ({
        index: i,
        sku: item.sku,
        name: item.name,
        status: "pending" as ItemStatus,
      }));
    }
    const byIndex = new Map(snapshot.items.map((it) => [it.index, it]));
    return DEFAULT_ITEMS.slice(0, itemCount).map((item, i) => {
      const current = byIndex.get(i);
      return {
        index: i,
        sku: current?.sku ?? item.sku,
        name: current?.name ?? item.name,
        status: current?.status ?? ("pending" as ItemStatus),
        error: current?.error,
      };
    });
  }, [snapshot, itemCount]);

  const captionText = useMemo(() => {
    if (effectiveStatus === "splitting" && snapshot?.activeItemIndex !== null) {
      return `Sequential split: processing item[${snapshot?.activeItemIndex}] through validate -> reserve -> fulfill.`;
    }
    if (effectiveStatus === "aggregating") {
      return "All items processed. Aggregating fulfillment results into summary.";
    }
    return "Splitter pattern: decompose composite message into individual items for sequential processing.";
  }, [effectiveStatus, snapshot?.activeItemIndex]);

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
                onClick={() => {
                  void handleStart();
                }}
                disabled={isRunning}
                className="cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Split Order
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

              <div className="flex items-center gap-1.5 rounded-md border border-gray-400/70 bg-background-100 px-2 py-1 text-xs text-gray-900">
                <span className="font-semibold uppercase tracking-wide text-gray-900">
                  Fail
                </span>
                {DEFAULT_ITEMS.slice(0, itemCount).map((item, i) => {
                  const isFailing = failIndices.has(i);
                  return (
                    <button
                      key={item.sku}
                      type="button"
                      disabled={isRunning}
                      aria-label={`${item.sku}: ${isFailing ? "will fail" : "will pass"} (click to toggle)`}
                      onClick={() => {
                        setFailIndices((prev) => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i);
                          else next.add(i);
                          return next;
                        });
                      }}
                      className={`cursor-pointer rounded px-2 py-0.5 font-mono transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        isFailing
                          ? "bg-red-700/20 text-red-700"
                          : "bg-background-200 text-gray-900"
                      }`}
                    >
                      {i}
                      {isFailing && <span className="ml-0.5 text-[10px]">F</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-gray-900">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded bg-background-200 border border-gray-400/70" />
                Pass
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded bg-red-700/20 border border-red-700/40" />
                Fail <span className="text-gray-700">(FatalError)</span>
              </span>
            </div>
          </div>

          <div
            className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2 text-xs text-gray-900"
            role="status"
            aria-live="polite"
          >
            {statusExplanation(effectiveStatus, snapshot?.activeItemIndex ?? null)}
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
              <span className="text-gray-900">Items Completed</span>
              <span className="font-mono text-gray-1000">
                {displayItems.filter((it) => it.status === "fulfilled" || it.status === "failed").length}
                /{displayItems.length}
              </span>
            </div>
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">Active Item</span>
              <code className="font-mono text-gray-1000">
                {snapshot?.activeItemIndex !== null && snapshot?.activeItemIndex !== undefined
                  ? `item[${snapshot.activeItemIndex}]`
                  : effectiveStatus === "aggregating"
                    ? "aggregating"
                    : "-"}
              </code>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SplitterGraph items={displayItems} status={effectiveStatus} />
        <ItemStatusList items={displayItems} />
      </div>

      <div className="rounded-md border border-gray-400 bg-background-100 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
          Execution Log
        </p>
        <ol className="space-y-1 font-mono text-xs">
          {eventLog.map((entry, index) => (
            <li key={`${entry.text}-${index}`} className={LOG_TONE_CLASS[entry.tone]}>{entry.text}</li>
          ))}
        </ol>
      </div>

      <p className="text-center text-xs italic text-gray-900">{captionText}</p>

      <SplitterCodeWorkbench
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

type DisplayItem = {
  index: number;
  sku: string;
  name: string;
  status: ItemStatus;
  error?: string;
};

function SplitterGraph({ items, status }: { items: DisplayItem[]; status: RunStatus | "idle" }) {
  const itemCount = items.length;
  const nodeSpacing = 280 / Math.max(itemCount, 1);
  const startY = 128 - ((itemCount - 1) * nodeSpacing) / 2;

  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Splitter Graph
      </p>

      <svg
        viewBox="0 0 320 256"
        role="img"
        aria-label="Splitter pattern graph decomposing order into line items"
        className="h-auto w-full"
      >
        <rect
          x={0}
          y={0}
          width={320}
          height={256}
          fill="var(--color-background-100)"
          rx={8}
        />

        {items.map((item, i) => {
          const nodeY = startY + i * nodeSpacing;
          const color = itemStatusColor(item.status);

          return (
            <g key={item.index}>
              <line
                x1={80}
                y1={128}
                x2={240}
                y2={nodeY}
                stroke={color}
                strokeWidth={2.5}
                strokeDasharray={
                  item.status === "processing" || item.status === "validated" || item.status === "reserved"
                    ? "6 4"
                    : undefined
                }
                className={
                  item.status === "processing" || item.status === "validated" || item.status === "reserved"
                    ? "animate-pulse"
                    : undefined
                }
              />
              <circle
                cx={240}
                cy={nodeY}
                r={16}
                fill="var(--color-background-200)"
                stroke={color}
                strokeWidth={2.5}
              />
              <text
                x={240}
                y={nodeY + 4}
                textAnchor="middle"
                className="fill-gray-1000 font-mono text-[10px]"
              >
                {item.index}
              </text>
            </g>
          );
        })}

        <circle
          cx={80}
          cy={128}
          r={26}
          fill="var(--color-background-200)"
          stroke={
            status === "done"
              ? "var(--color-green-700)"
              : status === "splitting" || status === "aggregating"
                ? "var(--color-amber-700)"
                : "var(--color-blue-700)"
          }
          strokeWidth={2.5}
          className="transition-colors duration-500"
        />
        <text
          x={80}
          y={132}
          textAnchor="middle"
          className={`font-mono text-xs font-semibold transition-colors duration-500 ${
            status === "done"
              ? "fill-green-700"
              : status === "splitting" || status === "aggregating"
                ? "fill-amber-700"
                : "fill-blue-700"
          }`}
        >
          WF
        </text>
      </svg>
    </div>
  );
}

function ItemStatusList({ items }: { items: DisplayItem[] }) {
  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Line Item Results
      </p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.index}
            className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm text-gray-1000">
                [{item.index}] {item.sku}
              </span>
              <ItemStatusBadge status={item.status} />
            </div>
            <p className="mt-0.5 text-xs text-gray-900">{item.name}</p>
            {item.status === "failed" && item.error ? (
              <p className="mt-1 text-xs text-red-700">{item.error}</p>
            ) : null}
          </li>
        ))}
      </ul>
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
  if (status === "aggregating") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        aggregating
      </span>
    );
  }
  if (status === "splitting") {
    return (
      <span className="rounded-full bg-blue-700/20 px-2 py-0.5 text-xs font-medium text-blue-700">
        splitting
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
  if (status === "fulfilled") {
    return (
      <span className="rounded-full bg-green-700/20 px-2 py-0.5 text-xs font-medium text-green-700">
        fulfilled
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="rounded-full bg-red-700/10 px-2 py-0.5 text-xs font-medium text-red-700">
        failed
      </span>
    );
  }
  if (status === "reserved") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        reserved
      </span>
    );
  }
  if (status === "validated") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        validated
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
