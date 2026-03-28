// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GDCodeWorkbench } from "@/guaranteed-delivery/app/components/gd-code-workbench";

type RunStatus = "processing" | "done";
type MessageStatus = "pending" | "persisting" | "sending" | "acked" | "delivered" | "retrying" | "failed";
type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail";

type GDEvent =
  | { type: "persist"; messageId: string }
  | { type: "send"; messageId: string; attempt: number }
  | { type: "ack"; messageId: string; attempt: number }
  | { type: "retry"; messageId: string; attempt: number; error: string }
  | { type: "confirm"; messageId: string; attempt: number }
  | { type: "fail"; messageId: string; error: string; attempts: number }
  | { type: "done"; summary: { delivered: number; failed: number } };

type MessageSnapshot = {
  id: string;
  status: MessageStatus;
  attempts: number;
  error?: string;
};

type GDSnapshot = {
  runId: string;
  status: RunStatus;
  elapsedMs: number;
  messages: MessageSnapshot[];
  summary?: { delivered: number; failed: number };
};

type StartResponse = {
  runId: string;
  messages: string[];
  failMessages: string[];
  status: "processing";
};

type MessageAccumulator = {
  status: MessageStatus;
  attempts: number;
  error?: string;
};

type GDAccumulator = {
  runId: string;
  status: RunStatus;
  messages: Record<string, MessageAccumulator>;
  orderedIds: string[];
  summary?: { delivered: number; failed: number };
};

type WorkflowLineMap = {
  forLoop: number[];
  returnResults: number[];
};

type StepLineMap = {
  deliverMessage: number[];
  finalizeDelivery: number[];
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

const DEFAULT_MESSAGES = ["msg-001", "msg-002", "msg-003", "msg-004", "msg-005"];
const DEFAULT_FAIL = ["msg-003"];

const EMPTY_HIGHLIGHT_STATE: HighlightState = {
  workflowActiveLines: [],
  stepActiveLines: [],
  workflowGutterMarks: {},
  stepGutterMarks: {},
};

function createAccumulator(start: StartResponse): GDAccumulator {
  const messages: Record<string, MessageAccumulator> = {};
  for (const id of start.messages) {
    messages[id] = { status: "pending", attempts: 0 };
  }
  return {
    runId: start.runId,
    status: "processing",
    messages,
    orderedIds: start.messages,
  };
}

function applyGDEvent(
  current: GDAccumulator,
  event: GDEvent
): GDAccumulator {
  if (event.type === "done") {
    return { ...current, status: "done", summary: event.summary };
  }

  if (event.type === "persist") {
    const messages = { ...current.messages };
    messages[event.messageId] = {
      ...messages[event.messageId],
      status: "persisting",
    };
    return { ...current, messages };
  }

  if (event.type === "send") {
    const messages = { ...current.messages };
    messages[event.messageId] = {
      ...messages[event.messageId],
      status: "sending",
      attempts: event.attempt,
    };
    return { ...current, messages };
  }

  if (event.type === "ack") {
    const messages = { ...current.messages };
    messages[event.messageId] = {
      ...messages[event.messageId],
      status: "acked",
      attempts: event.attempt,
    };
    return { ...current, messages };
  }

  if (event.type === "confirm") {
    const messages = { ...current.messages };
    messages[event.messageId] = {
      status: "delivered",
      attempts: event.attempt,
      error: undefined,
    };
    return { ...current, messages };
  }

  if (event.type === "retry") {
    const messages = { ...current.messages };
    messages[event.messageId] = {
      status: "retrying",
      attempts: event.attempt,
      error: event.error,
    };
    return { ...current, messages };
  }

  if (event.type === "fail") {
    const messages = { ...current.messages };
    messages[event.messageId] = {
      status: "failed",
      attempts: event.attempts,
      error: event.error,
    };
    return { ...current, messages };
  }

  return current;
}

function toSnapshot(
  accumulator: GDAccumulator,
  startedAtMs: number
): GDSnapshot {
  const messages: MessageSnapshot[] = accumulator.orderedIds.map((id) => {
    const msg = accumulator.messages[id];
    return {
      id,
      status: msg?.status ?? "pending",
      attempts: msg?.attempts ?? 0,
      error: msg?.error,
    };
  });

  return {
    runId: accumulator.runId,
    status: accumulator.status,
    elapsedMs: Math.max(0, Date.now() - startedAtMs),
    messages,
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

function parseGDEvent(rawChunk: string): GDEvent | null {
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

  if (type === "persist" && typeof event.messageId === "string") {
    return { type, messageId: event.messageId };
  }
  if (type === "send" && typeof event.messageId === "string" && typeof event.attempt === "number") {
    return { type, messageId: event.messageId, attempt: event.attempt };
  }
  if (type === "ack" && typeof event.messageId === "string" && typeof event.attempt === "number") {
    return { type, messageId: event.messageId, attempt: event.attempt };
  }
  if (type === "retry" && typeof event.messageId === "string" && typeof event.attempt === "number" && typeof event.error === "string") {
    return { type, messageId: event.messageId, attempt: event.attempt, error: event.error };
  }
  if (type === "confirm" && typeof event.messageId === "string" && typeof event.attempt === "number") {
    return { type, messageId: event.messageId, attempt: event.attempt };
  }
  if (type === "fail" && typeof event.messageId === "string" && typeof event.error === "string" && typeof event.attempts === "number") {
    return { type, messageId: event.messageId, error: event.error, attempts: event.attempts };
  }
  if (type === "done" && event.summary && typeof event.summary === "object") {
    const summary = event.summary as { delivered?: unknown; failed?: unknown };
    if (typeof summary.delivered === "number" && typeof summary.failed === "number") {
      return { type, summary: { delivered: summary.delivered, failed: summary.failed } };
    }
  }

  return null;
}

function formatElapsedMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function buildHighlightState(
  snapshot: GDSnapshot | null,
  workflowLineMap: WorkflowLineMap,
  stepLineMap: StepLineMap
): HighlightState {
  if (!snapshot) return EMPTY_HIGHLIGHT_STATE;

  const workflowGutterMarks: Record<number, GutterMarkKind> = {};
  const stepGutterMarks: Record<number, GutterMarkKind> = {};

  const activeMsg = snapshot.messages.find(
    (m) => m.status === "persisting" || m.status === "sending" || m.status === "acked" || m.status === "retrying"
  );

  if (snapshot.status === "processing" && activeMsg) {
    return {
      workflowActiveLines: workflowLineMap.forLoop,
      stepActiveLines: stepLineMap.deliverMessage,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (snapshot.status === "done") {
    for (const line of workflowLineMap.forLoop) {
      workflowGutterMarks[line] = "success";
    }

    const hasFailed = snapshot.messages.some(
      (m) => m.status === "failed"
    );
    if (hasFailed) {
      for (const line of stepLineMap.finalizeDelivery) {
        stepGutterMarks[line] = "fail";
      }
    } else {
      for (const line of stepLineMap.finalizeDelivery) {
        stepGutterMarks[line] = "success";
      }
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

function highlightToneForSnapshot(snapshot: GDSnapshot | null): HighlightTone {
  if (!snapshot) return "amber";
  if (snapshot.status === "processing") return "amber";
  if (snapshot.summary?.failed) return "red";
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

export function GDDemo({
  workflowCode,
  workflowLinesHtml,
  stepCode,
  stepLinesHtml,
  workflowLineMap,
  stepLineMap,
}: DemoProps) {
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<GDSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const accumulatorRef = useRef<GDAccumulator | null>(null);
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

        const applyEvent = (event: GDEvent) => {
          if (signal.aborted || !startedAtRef.current || !accumulatorRef.current) return;
          const nextAccumulator = applyGDEvent(accumulatorRef.current, event);
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
            const event = parseGDEvent(chunk);
            if (event) applyEvent(event);
          }
        }

        if (!signal.aborted && buffer.trim()) {
          const event = parseGDEvent(buffer.replaceAll("\r\n", "\n"));
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
        "/api/guaranteed-delivery",
        { messages: DEFAULT_MESSAGES, failMessages: DEFAULT_FAIL },
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

  const messages = snapshot?.messages ?? DEFAULT_MESSAGES.map((id) => ({
    id,
    status: "pending" as MessageStatus,
    attempts: 0,
  }));

  const activeMessageId = snapshot?.messages.find(
    (m) => m.status === "persisting" || m.status === "sending" || m.status === "acked" || m.status === "retrying"
  )?.id;

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
                Send Messages
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
                  Fail
                </span>
                <code className="font-mono text-red-700">{DEFAULT_FAIL.join(", ")}</code>
              </div>
            </div>
          </div>

          <div
            className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2 text-xs text-gray-900"
            role="status"
            aria-live="polite"
          >
            {effectiveStatus === "idle"
              ? "Waiting to start. Click Send Messages to run the workflow."
              : effectiveStatus === "processing"
                ? activeMessageId
                  ? `Delivering ${activeMessageId}... Persist → Send → Ack → Confirm. Retries exhaust after 3 attempts.`
                  : "Delivering messages with guaranteed delivery..."
                : `Completed: ${snapshot?.summary?.delivered ?? 0} delivered, ${snapshot?.summary?.failed ?? 0} failed.`}
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
                {activeMessageId ? `deliverMessage(${activeMessageId})` : effectiveStatus === "done" ? "finalizeDelivery" : "-"}
              </code>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-gray-400 bg-background-100 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
          Message Delivery
        </p>
        <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className="flex items-center justify-between rounded-md border border-gray-400/70 bg-background-200 px-3 py-1.5"
            >
              <div className="flex items-center gap-3">
                <code className="font-mono text-sm text-gray-1000">{msg.id}</code>
                {msg.attempts > 0 && (
                  <span className="font-mono text-xs text-gray-900">
                    attempt {msg.attempts}/3
                  </span>
                )}
              </div>
              <MessageStatusBadge status={msg.status} />
            </div>
          ))}
        </div>
      </div>

      {snapshot?.status === "done" && snapshot.summary && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md border border-green-700/40 bg-green-700/10 px-4 py-3 text-center">
            <p className="text-2xl font-semibold text-green-700 tabular-nums">
              {snapshot.summary.delivered}
            </p>
            <p className="text-xs text-gray-900">Delivered</p>
          </div>
          <div className="rounded-md border border-red-700/40 bg-red-700/10 px-4 py-3 text-center">
            <p className="text-2xl font-semibold text-red-700 tabular-nums">
              {snapshot.summary.failed}
            </p>
            <p className="text-xs text-gray-900">Failed</p>
          </div>
        </div>
      )}

      <GDCodeWorkbench
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

function MessageStatusBadge({ status }: { status: MessageStatus }) {
  if (status === "delivered") {
    return (
      <span className="rounded-full bg-green-700/20 px-2 py-0.5 text-xs font-medium text-green-700">
        delivered
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
  if (status === "retrying") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        retrying...
      </span>
    );
  }
  if (status === "sending" || status === "persisting" || status === "acked") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        {status}
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
} as unknown as Parameters<typeof GDDemo>[0];

export default function GuaranteedDeliveryNativeDemo() {
  return <GDDemo {...demoProps} />;
}
