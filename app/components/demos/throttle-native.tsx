// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QueueCodeWorkbench } from "@/throttle/app/components/queue-code-workbench";

type RunStatus = "queued" | "evaluating" | "done";
type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail" | "retry";

type ThrottleEvent =
  | { type: "config"; capacity: number; refillRate: number; requestCount: number }
  | { type: "request_received"; requestId: string; position: number }
  | { type: "token_check"; requestId: string; tokensAvailable: number }
  | { type: "request_accepted"; requestId: string; tokensRemaining: number }
  | { type: "request_rejected"; requestId: string; retryAfterMs: number }
  | { type: "token_refilled"; tokensAvailable: number }
  | { type: "done"; accepted: number; rejected: number; total: number };

type RequestDecision = {
  requestId: string;
  label: string;
  accepted: boolean;
  tokensAtCheck: number;
};

type ThrottleAccumulator = {
  runId: string;
  status: RunStatus;
  capacity: number;
  tokensAvailable: number;
  requestCount: number;
  decisions: RequestDecision[];
  currentRequest: { requestId: string; position: number } | null;
  accepted: number;
  rejected: number;
};

type ThrottleSnapshot = ThrottleAccumulator & {
  elapsedMs: number;
};

type StartResponse = {
  runId: string;
  requestCount: number;
  status: "queued";
};

export type WorkflowLineMap = {
  config: number[];
  evaluate: number[];
  refill: number[];
  done: number[];
};

export type StepLineMap = {
  evaluateRequest: number[];
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

const SAMPLE_REQUESTS = [
  { id: "REQ-01", label: "GET /api/users" },
  { id: "REQ-02", label: "POST /api/orders" },
  { id: "REQ-03", label: "GET /api/products" },
  { id: "REQ-04", label: "PUT /api/settings" },
  { id: "REQ-05", label: "GET /api/analytics" },
  { id: "REQ-06", label: "POST /api/webhooks" },
  { id: "REQ-07", label: "GET /api/users/me" },
  { id: "REQ-08", label: "DELETE /api/cache" },
  { id: "REQ-09", label: "POST /api/upload" },
  { id: "REQ-10", label: "GET /api/health" },
];

const REQUEST_LABEL_MAP = new Map(SAMPLE_REQUESTS.map((r) => [r.id, r.label]));

function parseSseData(rawChunk: string): string {
  return rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
}

function parseThrottleEvent(rawChunk: string): ThrottleEvent | null {
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

  if (type === "config" && typeof event.capacity === "number") {
    return { type, capacity: event.capacity, refillRate: event.refillRate as number, requestCount: event.requestCount as number };
  }
  if (type === "request_received" && typeof event.requestId === "string") {
    return { type, requestId: event.requestId, position: event.position as number };
  }
  if (type === "token_check" && typeof event.requestId === "string") {
    return { type, requestId: event.requestId, tokensAvailable: event.tokensAvailable as number };
  }
  if (type === "request_accepted" && typeof event.requestId === "string") {
    return { type, requestId: event.requestId, tokensRemaining: event.tokensRemaining as number };
  }
  if (type === "request_rejected" && typeof event.requestId === "string") {
    return { type, requestId: event.requestId, retryAfterMs: event.retryAfterMs as number };
  }
  if (type === "token_refilled" && typeof event.tokensAvailable === "number") {
    return { type, tokensAvailable: event.tokensAvailable };
  }
  if (type === "done" && typeof event.accepted === "number") {
    return { type, accepted: event.accepted, rejected: event.rejected as number, total: event.total as number };
  }

  return null;
}

function createAccumulator(start: StartResponse): ThrottleAccumulator {
  return {
    runId: start.runId,
    status: "queued",
    capacity: 3,
    tokensAvailable: 3,
    requestCount: start.requestCount,
    decisions: [],
    currentRequest: null,
    accepted: 0,
    rejected: 0,
  };
}

function applyThrottleEvent(current: ThrottleAccumulator, event: ThrottleEvent): ThrottleAccumulator {
  switch (event.type) {
    case "config":
      return { ...current, capacity: event.capacity, tokensAvailable: event.capacity };
    case "request_received":
      return {
        ...current,
        status: "evaluating",
        currentRequest: { requestId: event.requestId, position: event.position },
      };
    case "token_check":
      return { ...current, tokensAvailable: event.tokensAvailable };
    case "request_accepted":
      return {
        ...current,
        decisions: [...current.decisions, {
          requestId: event.requestId,
          label: REQUEST_LABEL_MAP.get(event.requestId) ?? event.requestId,
          accepted: true,
          tokensAtCheck: event.tokensRemaining + 1,
        }],
        tokensAvailable: event.tokensRemaining,
        accepted: current.accepted + 1,
        currentRequest: null,
      };
    case "request_rejected":
      return {
        ...current,
        decisions: [...current.decisions, {
          requestId: event.requestId,
          label: REQUEST_LABEL_MAP.get(event.requestId) ?? event.requestId,
          accepted: false,
          tokensAtCheck: 0,
        }],
        rejected: current.rejected + 1,
        currentRequest: null,
      };
    case "token_refilled":
      return { ...current, tokensAvailable: event.tokensAvailable };
    case "done":
      return { ...current, status: "done", accepted: event.accepted, rejected: event.rejected };
  }
}

function toSnapshot(accumulator: ThrottleAccumulator, startedAtMs: number): ThrottleSnapshot {
  return {
    ...accumulator,
    elapsedMs: Math.max(0, Date.now() - startedAtMs),
  };
}

const EMPTY_HIGHLIGHT_STATE: HighlightState = {
  workflowActiveLines: [],
  stepActiveLines: [],
  workflowGutterMarks: {},
  stepGutterMarks: {},
};

function buildHighlightState(
  snapshot: ThrottleSnapshot | null,
  workflowLineMap: WorkflowLineMap,
  stepLineMap: StepLineMap
): HighlightState {
  if (!snapshot) return EMPTY_HIGHLIGHT_STATE;

  const workflowGutterMarks: Record<number, GutterMarkKind> = {};
  const stepGutterMarks: Record<number, GutterMarkKind> = {};

  if (snapshot.status === "evaluating") {
    return {
      workflowActiveLines: workflowLineMap.evaluate,
      stepActiveLines: stepLineMap.evaluateRequest,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (snapshot.status === "done") {
    for (const line of workflowLineMap.done.slice(0, 1)) {
      workflowGutterMarks[line] = "success";
    }
    for (const line of stepLineMap.evaluateRequest.slice(0, 1)) {
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

function highlightToneForSnapshot(snapshot: ThrottleSnapshot | null): HighlightTone {
  if (!snapshot) return "amber";
  if (snapshot.status === "evaluating") return "cyan";
  return "green";
}

type LogTone = "default" | "green" | "amber" | "red" | "cyan";
type LogEntry = { text: string; tone: LogTone };

function formatElapsedMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function eventToLogEntry(event: ThrottleEvent, elapsedMs: number): LogEntry {
  const ts = formatElapsedMs(elapsedMs);

  switch (event.type) {
    case "config":
      return { text: `[${ts}] bucket configured — capacity:${event.capacity} refillRate:${event.refillRate} requests:${event.requestCount}`, tone: "default" };
    case "request_received":
      return { text: `[${ts}] [#${event.position}] ${event.requestId} received`, tone: "default" };
    case "token_check":
      return { text: `[${ts}] ${event.requestId} checking tokens — ${event.tokensAvailable} available`, tone: "cyan" };
    case "request_accepted":
      return { text: `[${ts}] ${event.requestId} accepted (${event.tokensRemaining} tokens remaining)`, tone: "green" };
    case "request_rejected":
      return { text: `[${ts}] ${event.requestId} rejected — retry after ${event.retryAfterMs}ms`, tone: "red" };
    case "token_refilled":
      return { text: `[${ts}] token refilled — ${event.tokensAvailable} available`, tone: "amber" };
    case "done":
      return { text: `[${ts}] done — ${event.accepted} accepted, ${event.rejected} rejected, ${event.total} total`, tone: "green" };
  }
}

const IDLE_LOG: LogEntry[] = [
  { text: "Idle: click Run Throttle to evaluate requests against the token bucket.", tone: "default" },
  { text: "Requests are accepted while tokens are available; rejected when the bucket is empty.", tone: "default" },
];

const LOG_TONE_CLASS: Record<LogTone, string> = {
  default: "text-gray-900",
  green: "text-green-700",
  amber: "text-amber-700",
  red: "text-red-700",
  cyan: "text-cyan-700",
};

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

function statusExplanation(
  status: RunStatus | "idle",
  accepted: number,
  rejected: number,
  total: number
): string {
  if (status === "idle") {
    return "Waiting to start. Click Run Throttle to evaluate requests against the token bucket.";
  }
  if (status === "evaluating") {
    return `Evaluating: ${accepted + rejected} of ${total} requests processed.`;
  }
  return `Completed: ${accepted} accepted, ${rejected} rejected out of ${total} requests.`;
}

export function ThrottleDemo({
  workflowCode,
  workflowLinesHtml,
  stepCode,
  stepLinesHtml,
  workflowLineMap,
  stepLineMap,
}: DemoProps) {
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ThrottleSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<LogEntry[]>(IDLE_LOG);

  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const accumulatorRef = useRef<ThrottleAccumulator | null>(null);
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
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? `Readable stream request failed: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const applyEvent = (event: ThrottleEvent) => {
          if (signal.aborted || !startedAtRef.current || !accumulatorRef.current) return;
          const elapsedMs = Math.max(0, Date.now() - startedAtRef.current);
          const nextAccumulator = applyThrottleEvent(accumulatorRef.current, event);
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
            const event = parseThrottleEvent(chunk);
            if (event) applyEvent(event);
          }
        }

        if (!signal.aborted && buffer.trim()) {
          const event = parseThrottleEvent(buffer.replaceAll("\r\n", "\n"));
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
      const payload = await postJson<StartResponse>(
        "/api/throttle",
        { capacity: 3, refillRate: 3, requests: SAMPLE_REQUESTS },
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
        { text: `[0.00s] ${payload.requestCount} requests submitted to throttle`, tone: "default" },
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
    setTimeout(() => { startButtonRef.current?.focus(); }, 0);
  };

  const effectiveStatus: RunStatus | "idle" = snapshot?.status ?? (runId ? "queued" : "idle");
  const isRunning = runId !== null && snapshot?.status !== "done";

  const highlights = useMemo(
    () => buildHighlightState(snapshot, workflowLineMap, stepLineMap),
    [snapshot, workflowLineMap, stepLineMap]
  );
  const highlightTone = useMemo(
    () => highlightToneForSnapshot(snapshot),
    [snapshot]
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
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
              Incoming Requests
            </p>
            <ul className="space-y-1.5">
              {SAMPLE_REQUESTS.map((req) => {
                const decision = snapshot?.decisions.find((d) => d.requestId === req.id);
                const isCurrent = snapshot?.currentRequest?.requestId === req.id;

                return (
                  <li
                    key={req.id}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                      decision
                        ? decision.accepted
                          ? "border-green-700/40 bg-green-700/10 text-gray-1000"
                          : "border-red-700/40 bg-red-700/10 text-gray-1000"
                        : isCurrent
                          ? "border-cyan-700/40 bg-cyan-700/10 text-gray-1000"
                          : "border-gray-400/70 bg-background-100 text-gray-900"
                    }`}
                  >
                    <span className="font-mono text-xs text-gray-900">{req.id}</span>
                    <span className="flex-1 font-mono text-xs">{req.label}</span>
                    {decision && decision.accepted && <span className="text-xs text-green-700">200 OK</span>}
                    {decision && !decision.accepted && <span className="text-xs text-red-700">429</span>}
                    {isCurrent && <span className="text-xs text-cyan-700 animate-pulse">evaluating</span>}
                  </li>
                );
              })}
            </ul>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                ref={startButtonRef}
                onClick={() => { void handleStart(); }}
                disabled={isRunning}
                className="cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Run Throttle
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
            </div>
          </div>

          <div
            className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2 text-xs text-gray-900"
            role="status"
            aria-live="polite"
          >
            {statusExplanation(
              effectiveStatus,
              snapshot?.accepted ?? 0,
              snapshot?.rejected ?? 0,
              snapshot?.requestCount ?? SAMPLE_REQUESTS.length
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-gray-400 bg-background-100 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-900">
              Token Bucket
            </span>
            <RunStatusBadge status={effectiveStatus} />
          </div>

          <TokenBucketViz
            capacity={snapshot?.capacity ?? 3}
            tokensAvailable={snapshot?.tokensAvailable ?? 3}
            status={effectiveStatus}
          />

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
              <span className="text-gray-900">Accepted / Rejected</span>
              <span className="font-mono text-gray-1000">
                <span className="text-green-700">{snapshot?.accepted ?? 0}</span>
                {" / "}
                <span className="text-red-700">{snapshot?.rejected ?? 0}</span>
                {" of "}
                {snapshot?.requestCount ?? SAMPLE_REQUESTS.length}
              </span>
            </div>
          </div>

          {snapshot?.status === "done" && (
            <div className="rounded-md border border-green-700/40 bg-green-700/10 px-3 py-2">
              <p className="text-xs text-green-700">
                All requests evaluated — {snapshot.accepted} accepted, {snapshot.rejected} rejected
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DecisionTimeline decisions={snapshot?.decisions ?? []} status={effectiveStatus} />
        <DecisionSummary
          decisions={snapshot?.decisions ?? []}
          status={effectiveStatus}
        />
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

      <p className="text-center text-xs italic text-gray-900">
        Throttle: evaluate incoming requests against a token bucket — accept while tokens are available, reject when empty.
      </p>

      <QueueCodeWorkbench
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

function TokenBucketViz({
  capacity,
  tokensAvailable,
  status,
}: {
  capacity: number;
  tokensAvailable: number;
  status: RunStatus | "idle";
}) {
  const tokens = Array.from({ length: capacity }, (_, i) => i < tokensAvailable);

  return (
    <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-900">Tokens</span>
        <span className="font-mono text-xs text-gray-1000">
          {tokensAvailable} / {capacity}
        </span>
      </div>
      <div className="flex gap-2">
        {tokens.map((filled, index) => (
          <div
            key={index}
            className={`flex-1 h-8 rounded-md border-2 transition-all duration-300 ${
              filled
                ? "border-green-700 bg-green-700/30"
                : "border-gray-500 bg-background-100"
            }`}
          />
        ))}
      </div>
      {status === "evaluating" && tokensAvailable === 0 && (
        <p className="mt-2 text-xs text-red-700 animate-pulse">Bucket empty — requests will be rejected</p>
      )}
    </div>
  );
}

function DecisionTimeline({
  decisions,
  status,
}: {
  decisions: RequestDecision[];
  status: RunStatus | "idle";
}) {
  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Decision Timeline
      </p>

      <svg
        viewBox="0 0 320 200"
        role="img"
        aria-label="Token bucket decision timeline"
        className="h-auto w-full"
      >
        <rect x={0} y={0} width={320} height={200} fill="var(--color-background-100)" rx={8} />

        {/* Axis */}
        <line x1={40} y1={170} x2={310} y2={170} stroke="var(--color-gray-500)" strokeWidth={1} />
        <text x={175} y={195} textAnchor="middle" className="font-mono text-[10px] fill-gray-900">
          request sequence
        </text>

        {decisions.length === 0 ? (
          <text x={175} y={90} textAnchor="middle" className="font-mono text-xs fill-gray-900">
            {status === "idle" ? "No decisions yet" : "Waiting..."}
          </text>
        ) : (
          decisions.map((d, i) => {
            const x = 50 + i * (250 / Math.max(decisions.length, 1));
            const y = d.accepted ? 60 : 130;
            const color = d.accepted ? "var(--color-green-700)" : "var(--color-red-700)";

            return (
              <g key={d.requestId}>
                <line x1={x} y1={170} x2={x} y2={y + 12} stroke={color} strokeWidth={1} strokeDasharray="3,2" />
                <circle cx={x} cy={y} r={8} fill={`color-mix(in srgb, ${color} 30%, transparent)`} stroke={color} strokeWidth={2} />
                <text x={x} y={y + 4} textAnchor="middle" className="font-mono text-[9px]" fill={color}>
                  {d.accepted ? "OK" : "429"}
                </text>
                <text
                  x={x}
                  y={170 + 12}
                  textAnchor="middle"
                  className="font-mono text-[8px] fill-gray-900"
                  transform={`rotate(-45, ${x}, ${170 + 12})`}
                >
                  {d.requestId.replace("REQ-", "#")}
                </text>
              </g>
            );
          })
        )}

        {/* Legend */}
        <circle cx={55} cy={20} r={5} fill="color-mix(in srgb, var(--color-green-700) 30%, transparent)" stroke="var(--color-green-700)" strokeWidth={1.5} />
        <text x={65} y={24} className="font-mono text-[10px] fill-green-700">accepted</text>
        <circle cx={145} cy={20} r={5} fill="color-mix(in srgb, var(--color-red-700) 30%, transparent)" stroke="var(--color-red-700)" strokeWidth={1.5} />
        <text x={155} y={24} className="font-mono text-[10px] fill-red-700">rejected</text>
      </svg>
    </div>
  );
}

function DecisionSummary({
  decisions,
  status,
}: {
  decisions: RequestDecision[];
  status: RunStatus | "idle";
}) {
  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Decisions
      </p>
      <ul className="space-y-2">
        {decisions.length === 0 ? (
          <li className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2 text-sm text-gray-900">
            {status === "idle" ? "No requests evaluated" : "Waiting for decisions..."}
          </li>
        ) : (
          decisions.map((d, index) => (
            <li
              key={`${d.requestId}-${index}`}
              className={`rounded-md border px-3 py-2 ${
                d.accepted
                  ? "border-green-700/40 bg-green-700/10"
                  : "border-red-700/40 bg-red-700/10"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-300 text-[10px] font-mono text-gray-1000">
                  {index + 1}
                </span>
                <span className="font-mono text-xs text-gray-900">{d.requestId}</span>
                <span className="flex-1 text-sm text-gray-1000">{d.label}</span>
                <span className={`text-xs font-medium ${d.accepted ? "text-green-700" : "text-red-700"}`}>
                  {d.accepted ? "200 OK" : "429 Rejected"}
                </span>
              </div>
            </li>
          ))
        )}
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
  if (status === "evaluating" || status === "queued") {
    return (
      <span className="rounded-full bg-cyan-700/20 px-2 py-0.5 text-xs font-medium text-cyan-700">
        evaluating
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-900">
      idle
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
} as unknown as Parameters<typeof ThrottleDemo>[0];

export default function ThrottleNativeDemo() {
  return <ThrottleDemo {...demoProps} />;
}
