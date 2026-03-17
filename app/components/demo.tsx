"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CorrelationCodeWorkbench } from "./correlation-code-workbench";

type RequestStatus =
  | "pending"
  | "sent"
  | "awaiting_response"
  | "matched"
  | "delivered"
  | "timeout";
type RunStatus = "idle" | "generating" | "sending" | "awaiting" | "matching" | "done";
type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail" | "retry";

type ServiceName = "payment-api" | "inventory-api" | "shipping-api" | "notification-api";

type CorrelationEvent =
  | { type: "correlation_id_generated"; requestId: string; correlationId: string }
  | { type: "request_sent"; requestId: string; correlationId: string; service: string }
  | { type: "awaiting_response"; requestId: string; correlationId: string; timeoutMs: number }
  | { type: "response_received"; requestId: string; correlationId: string; responseService: string; latencyMs: number }
  | { type: "correlation_matched"; requestId: string; correlationId: string; requestPayloadHash: string; responsePayloadHash: string }
  | { type: "delivery_complete"; requestId: string; correlationId: string; destination: string }
  | { type: "timeout_expired"; requestId: string; correlationId: string }
  | { type: "done"; requestId: string; correlationId: string; status: RequestStatus; totalSteps: number };

type CorrelationAccumulator = {
  runId: string;
  requestId: string;
  service: ServiceName;
  payload: string;
  status: RunStatus;
  correlationId: string | null;
  latencyMs: number | null;
  requestHash: string | null;
  responseHash: string | null;
  destination: string | null;
  finalStatus: RequestStatus | null;
  totalSteps: number | null;
};

type CorrelationSnapshot = CorrelationAccumulator & {
  elapsedMs: number;
};

type StartResponse = {
  runId: string;
  requestId: string;
  service: ServiceName;
  payload: string;
  status: "pending";
};

export type WorkflowLineMap = {
  generateId: number[];
  sendRequest: number[];
  awaitResponse: number[];
  matchAndDeliver: number[];
  done: number[];
};

export type StepLineMap = {
  generateCorrelationId: number[];
  sendRequest: number[];
  awaitResponse: number[];
  matchAndDeliver: number[];
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

export const SAMPLE_REQUESTS: Array<{ id: string; service: ServiceName; payload: string }> = [
  { id: "REQ-4001", service: "payment-api", payload: "charge $49.99 to card ending 4242" },
  { id: "REQ-4002", service: "inventory-api", payload: "reserve 3x SKU-7890 in warehouse-east" },
  { id: "REQ-4003", service: "shipping-api", payload: "create label for order #ORD-1122" },
  { id: "REQ-4004", service: "notification-api", payload: "send order confirmation to user@example.com" },
];

const SERVICE_COLORS: Record<ServiceName, string> = {
  "payment-api": "var(--color-amber-700)",
  "inventory-api": "var(--color-cyan-700)",
  "shipping-api": "var(--color-blue-700)",
  "notification-api": "var(--color-green-700)",
};

const SERVICE_LABELS: Record<ServiceName, string> = {
  "payment-api": "Payment",
  "inventory-api": "Inventory",
  "shipping-api": "Shipping",
  "notification-api": "Notification",
};

const SERVICE_SHORT: Record<ServiceName, string> = {
  "payment-api": "PAY",
  "inventory-api": "INV",
  "shipping-api": "SHP",
  "notification-api": "NTF",
};

export function cycleSelectedRequest(current: number): number {
  return (current + 1) % SAMPLE_REQUESTS.length;
}

function parseSseData(rawChunk: string): string {
  return rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
}

export function parseCorrelationEvent(rawChunk: string): CorrelationEvent | null {
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

  if (type === "correlation_id_generated" && typeof event.requestId === "string" && typeof event.correlationId === "string") {
    return { type, requestId: event.requestId, correlationId: event.correlationId };
  }
  if (type === "request_sent" && typeof event.requestId === "string" && typeof event.correlationId === "string" && typeof event.service === "string") {
    return { type, requestId: event.requestId, correlationId: event.correlationId, service: event.service };
  }
  if (type === "awaiting_response" && typeof event.requestId === "string" && typeof event.correlationId === "string" && typeof event.timeoutMs === "number") {
    return { type, requestId: event.requestId, correlationId: event.correlationId, timeoutMs: event.timeoutMs };
  }
  if (type === "response_received" && typeof event.requestId === "string" && typeof event.correlationId === "string" && typeof event.responseService === "string" && typeof event.latencyMs === "number") {
    return { type, requestId: event.requestId, correlationId: event.correlationId, responseService: event.responseService, latencyMs: event.latencyMs };
  }
  if (type === "correlation_matched" && typeof event.requestId === "string" && typeof event.correlationId === "string" && typeof event.requestPayloadHash === "string" && typeof event.responsePayloadHash === "string") {
    return { type, requestId: event.requestId, correlationId: event.correlationId, requestPayloadHash: event.requestPayloadHash, responsePayloadHash: event.responsePayloadHash };
  }
  if (type === "delivery_complete" && typeof event.requestId === "string" && typeof event.correlationId === "string" && typeof event.destination === "string") {
    return { type, requestId: event.requestId, correlationId: event.correlationId, destination: event.destination };
  }
  if (type === "timeout_expired" && typeof event.requestId === "string" && typeof event.correlationId === "string") {
    return { type, requestId: event.requestId, correlationId: event.correlationId };
  }
  if (type === "done" && typeof event.requestId === "string" && typeof event.correlationId === "string" && typeof event.status === "string" && typeof event.totalSteps === "number") {
    return { type, requestId: event.requestId, correlationId: event.correlationId, status: event.status as RequestStatus, totalSteps: event.totalSteps };
  }

  return null;
}

export function createAccumulator(start: StartResponse): CorrelationAccumulator {
  return {
    runId: start.runId,
    requestId: start.requestId,
    service: start.service,
    payload: start.payload,
    status: "generating",
    correlationId: null,
    latencyMs: null,
    requestHash: null,
    responseHash: null,
    destination: null,
    finalStatus: null,
    totalSteps: null,
  };
}

export function applyCorrelationEvent(current: CorrelationAccumulator, event: CorrelationEvent): CorrelationAccumulator {
  switch (event.type) {
    case "correlation_id_generated":
      return { ...current, correlationId: event.correlationId, status: "sending" };
    case "request_sent":
      return { ...current, status: "awaiting" };
    case "awaiting_response":
      return current;
    case "response_received":
      return { ...current, latencyMs: event.latencyMs, status: "matching" };
    case "correlation_matched":
      return { ...current, requestHash: event.requestPayloadHash, responseHash: event.responsePayloadHash };
    case "delivery_complete":
      return { ...current, destination: event.destination };
    case "timeout_expired":
      return { ...current, finalStatus: "timeout", status: "done" };
    case "done":
      return { ...current, finalStatus: event.status, totalSteps: event.totalSteps, status: "done" };
  }
}

function toSnapshot(accumulator: CorrelationAccumulator, startedAtMs: number): CorrelationSnapshot {
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
  snapshot: CorrelationSnapshot | null,
  workflowLineMap: WorkflowLineMap,
  stepLineMap: StepLineMap
): HighlightState {
  if (!snapshot) return EMPTY_HIGHLIGHT_STATE;

  const workflowGutterMarks: Record<number, GutterMarkKind> = {};
  const stepGutterMarks: Record<number, GutterMarkKind> = {};

  if (snapshot.status === "generating") {
    return {
      workflowActiveLines: workflowLineMap.generateId,
      stepActiveLines: stepLineMap.generateCorrelationId,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (snapshot.status === "sending") {
    for (const line of stepLineMap.generateCorrelationId.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }
    return {
      workflowActiveLines: workflowLineMap.sendRequest,
      stepActiveLines: stepLineMap.sendRequest,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (snapshot.status === "awaiting") {
    for (const line of stepLineMap.generateCorrelationId.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }
    for (const line of stepLineMap.sendRequest.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }
    return {
      workflowActiveLines: workflowLineMap.awaitResponse,
      stepActiveLines: stepLineMap.awaitResponse,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (snapshot.status === "matching") {
    for (const line of stepLineMap.generateCorrelationId.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }
    for (const line of stepLineMap.sendRequest.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }
    for (const line of stepLineMap.awaitResponse.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }
    return {
      workflowActiveLines: workflowLineMap.matchAndDeliver,
      stepActiveLines: stepLineMap.matchAndDeliver,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (snapshot.status === "done") {
    for (const line of workflowLineMap.done.slice(0, 1)) {
      workflowGutterMarks[line] = snapshot.finalStatus === "timeout" ? "fail" : "success";
    }
    for (const line of stepLineMap.generateCorrelationId.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }
    for (const line of stepLineMap.sendRequest.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }
    for (const line of stepLineMap.awaitResponse.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }
    if (snapshot.finalStatus !== "timeout") {
      for (const line of stepLineMap.matchAndDeliver.slice(0, 1)) {
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

  return EMPTY_HIGHLIGHT_STATE;
}

function highlightToneForSnapshot(snapshot: CorrelationSnapshot | null): HighlightTone {
  if (!snapshot) return "amber";
  if (snapshot.status === "generating") return "cyan";
  if (snapshot.status === "awaiting") return "amber";
  if (snapshot.status === "done" && snapshot.finalStatus === "timeout") return "red";
  if (snapshot.status === "done") return "green";
  return "amber";
}

type LogTone = "default" | "green" | "amber" | "red" | "cyan";
type LogEntry = { text: string; tone: LogTone };

function formatElapsedMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function eventToLogEntry(event: CorrelationEvent, elapsedMs: number): LogEntry {
  const ts = formatElapsedMs(elapsedMs);

  switch (event.type) {
    case "correlation_id_generated":
      return { text: `[${ts}] generated correlation ID: ${event.correlationId}`, tone: "cyan" };
    case "request_sent":
      return { text: `[${ts}] request sent to ${event.service} with corr-id ${event.correlationId}`, tone: "default" };
    case "awaiting_response":
      return { text: `[${ts}] awaiting async response (timeout: ${event.timeoutMs}ms)`, tone: "amber" };
    case "response_received":
      return { text: `[${ts}] response received from ${event.responseService} (${event.latencyMs}ms)`, tone: "cyan" };
    case "correlation_matched":
      return { text: `[${ts}] correlation matched: req=${event.requestPayloadHash} res=${event.responsePayloadHash}`, tone: "green" };
    case "delivery_complete":
      return { text: `[${ts}] delivered to ${event.destination}`, tone: "green" };
    case "timeout_expired":
      return { text: `[${ts}] timeout expired — no matching response`, tone: "red" };
    case "done":
      return { text: `[${ts}] done — status: ${event.status}, ${event.totalSteps} steps`, tone: event.status === "timeout" ? "red" : "green" };
  }
}

const IDLE_LOG: LogEntry[] = [
  { text: "Idle: select a request to start the correlation identifier flow.", tone: "default" },
  { text: "Each request gets a unique correlation ID to match async responses.", tone: "default" },
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
  status: RunStatus,
  finalStatus: RequestStatus | null
): string {
  if (status === "idle") {
    return "Waiting to start. Select a sample request to run the workflow.";
  }
  if (status === "generating") {
    return "Generating: creating a unique correlation ID for this request.";
  }
  if (status === "sending") {
    return "Sending: dispatching the request with correlation ID attached.";
  }
  if (status === "awaiting") {
    return "Awaiting: waiting for the async response, matching by correlation ID.";
  }
  if (status === "matching") {
    return "Matching: verifying response correlation ID matches the original request.";
  }
  if (status === "done" && finalStatus === "timeout") {
    return "Timeout: no matching response received within the timeout window.";
  }
  return "Completed: response matched by correlation ID and delivered to caller.";
}

export function CorrelationIdentifierDemo({
  workflowCode,
  workflowLinesHtml,
  stepCode,
  stepLinesHtml,
  workflowLineMap,
  stepLineMap,
}: DemoProps) {
  const [selectedRequest, setSelectedRequest] = useState(0);
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<CorrelationSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<LogEntry[]>(IDLE_LOG);

  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const accumulatorRef = useRef<CorrelationAccumulator | null>(null);
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

        const applyEvent = (event: CorrelationEvent) => {
          if (signal.aborted || !startedAtRef.current || !accumulatorRef.current) return;
          const elapsedMs = Math.max(0, Date.now() - startedAtRef.current);
          const nextAccumulator = applyCorrelationEvent(accumulatorRef.current, event);
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
            const event = parseCorrelationEvent(chunk);
            if (event) applyEvent(event);
          }
        }

        if (!signal.aborted && buffer.trim()) {
          const event = parseCorrelationEvent(buffer.replaceAll("\r\n", "\n"));
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

    const request = SAMPLE_REQUESTS[selectedRequest];

    try {
      const controller = ensureAbortController();
      const payload = await postJson<StartResponse>(
        "/api/correlation-identifier",
        { requestId: request.id, service: request.service, payload: request.payload },
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
        { text: `[0.00s] request ${request.id} submitted to ${request.service}`, tone: "default" },
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

  const effectiveStatus: RunStatus = snapshot?.status ?? (runId ? "generating" : "idle");
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
              Sample Requests
            </p>
            <div className="space-y-1.5">
              {SAMPLE_REQUESTS.map((request, index) => (
                <button
                  key={request.id}
                  type="button"
                  disabled={isRunning}
                  onClick={() => setSelectedRequest(index)}
                  className={`w-full cursor-pointer rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    selectedRequest === index
                      ? "border-blue-700/60 bg-blue-700/10 text-gray-1000"
                      : "border-gray-400/70 bg-background-100 text-gray-900 hover:border-gray-300 hover:text-gray-1000"
                  }`}
                >
                  <span className="font-mono text-xs text-gray-900">{request.id}</span>
                  <span
                    className="ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${SERVICE_COLORS[request.service]} 20%, transparent)`,
                      color: SERVICE_COLORS[request.service],
                    }}
                  >
                    {SERVICE_LABELS[request.service]}
                  </span>
                  <span className="ml-2 text-gray-900">{request.payload}</span>
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                ref={startButtonRef}
                onClick={() => { void handleStart(); }}
                disabled={isRunning}
                className="cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send Request
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
            {statusExplanation(effectiveStatus, snapshot?.finalStatus ?? null)}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-gray-400 bg-background-100 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-900">
              Correlation State
            </span>
            <RunStatusBadge status={effectiveStatus} finalStatus={snapshot?.finalStatus ?? null} />
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
              <span className="text-gray-900">Correlation ID</span>
              <code className="font-mono text-xs text-gray-1000">
                {snapshot?.correlationId ?? "pending"}
              </code>
            </div>
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">Response Latency</span>
              <span className="font-mono text-gray-1000">
                {snapshot?.latencyMs != null ? `${snapshot.latencyMs}ms` : "pending"}
              </span>
            </div>
          </div>

          {snapshot?.requestHash && snapshot?.responseHash && (
            <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-gray-900">Hash Match</span>
                <span className="font-mono text-xs text-gray-1000">
                  req={snapshot.requestHash} / res={snapshot.responseHash}
                </span>
              </div>
            </div>
          )}

          {snapshot?.destination && (
            <div className="rounded-md border border-green-700/40 bg-green-700/10 px-3 py-2">
              <p className="text-xs text-green-700">Delivered to {snapshot.destination}</p>
            </div>
          )}

          {snapshot?.finalStatus === "timeout" && (
            <div className="rounded-md border border-red-700/40 bg-red-700/10 px-3 py-2">
              <p className="text-xs text-red-700">Request timed out — no matching response</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <CorrelationGraph
          service={snapshot?.service ?? SAMPLE_REQUESTS[selectedRequest].service}
          status={effectiveStatus}
          correlationId={snapshot?.correlationId ?? null}
        />
        <CorrelationTimeline snapshot={snapshot} />
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
        Correlation Identifier: tag each async request with a unique ID so responses can be matched to their originating request.
      </p>

      <CorrelationCodeWorkbench
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

function CorrelationGraph({
  service,
  status,
  correlationId,
}: {
  service: ServiceName;
  status: RunStatus;
  correlationId: string | null;
}) {
  const services: Array<{ id: ServiceName; x: number; y: number }> = [
    { id: "payment-api", x: 270, y: 44 },
    { id: "inventory-api", x: 270, y: 108 },
    { id: "shipping-api", x: 270, y: 172 },
    { id: "notification-api", x: 270, y: 236 },
  ];

  const senderColor =
    status === "done"
      ? "var(--color-green-700)"
      : status === "generating"
        ? "var(--color-cyan-700)"
        : status === "awaiting"
          ? "var(--color-amber-700)"
          : "var(--color-blue-700)";

  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Request / Response Pairing
      </p>

      <svg
        viewBox="0 0 320 280"
        role="img"
        aria-label="Correlation identifier graph showing request-response pairing with services"
        className="h-auto w-full"
      >
        <rect x={0} y={0} width={320} height={280} fill="var(--color-background-100)" rx={8} />

        {services.map((node) => {
          const isActive = service === node.id;
          const color = isActive
            ? SERVICE_COLORS[node.id]
            : "var(--color-gray-500)";

          return (
            <g key={node.id}>
              {/* Request arrow (right) */}
              <line
                x1={80}
                y1={140}
                x2={node.x - 22}
                y2={node.y}
                stroke={color}
                strokeWidth={isActive ? 2 : 1}
                strokeDasharray={isActive && (status === "sending" || status === "awaiting") ? "6 4" : undefined}
                className={isActive && status === "sending" ? "animate-pulse" : undefined}
              />
              {/* Response arrow (left, dashed) */}
              {isActive && (status === "awaiting" || status === "matching" || status === "done") && (
                <line
                  x1={node.x - 22}
                  y1={node.y}
                  x2={80}
                  y2={140}
                  stroke={status === "done" ? "var(--color-green-700)" : color}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                  className={status === "awaiting" ? "animate-pulse" : undefined}
                />
              )}
              <circle
                cx={node.x}
                cy={node.y}
                r={18}
                fill="var(--color-background-200)"
                stroke={color}
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              <text
                x={node.x}
                y={node.y + 4}
                textAnchor="middle"
                className={`font-mono text-xs ${isActive ? "fill-gray-1000" : "fill-gray-500"}`}
              >
                {SERVICE_SHORT[node.id]}
              </text>
            </g>
          );
        })}

        {/* Sender node */}
        <circle
          cx={50}
          cy={140}
          r={26}
          fill="var(--color-background-200)"
          stroke={senderColor}
          strokeWidth={2.5}
          className="transition-colors duration-500"
        />
        <text
          x={50}
          y={135}
          textAnchor="middle"
          className="font-mono text-[10px] fill-gray-900"
        >
          CORR
        </text>
        <text
          x={50}
          y={148}
          textAnchor="middle"
          className="font-mono text-[10px] fill-gray-900"
        >
          ID
        </text>

        {/* Correlation ID label */}
        {correlationId && (
          <text
            x={160}
            y={270}
            textAnchor="middle"
            className="font-mono text-[9px] fill-gray-900"
          >
            {correlationId}
          </text>
        )}
      </svg>
    </div>
  );
}

function CorrelationTimeline({
  snapshot,
}: {
  snapshot: CorrelationSnapshot | null;
}) {
  const steps: Array<{ label: string; status: "pending" | "active" | "done" | "error" }> = [
    {
      label: "Generate Correlation ID",
      status: !snapshot ? "pending" :
        snapshot.status === "generating" ? "active" :
        snapshot.correlationId ? "done" : "pending",
    },
    {
      label: "Send Request",
      status: !snapshot ? "pending" :
        snapshot.status === "sending" ? "active" :
        snapshot.status === "awaiting" || snapshot.status === "matching" || snapshot.status === "done" ? "done" : "pending",
    },
    {
      label: "Await Response",
      status: !snapshot ? "pending" :
        snapshot.status === "awaiting" ? "active" :
        snapshot.latencyMs != null ? "done" :
        snapshot.finalStatus === "timeout" ? "error" : "pending",
    },
    {
      label: "Match & Deliver",
      status: !snapshot ? "pending" :
        snapshot.status === "matching" ? "active" :
        snapshot.destination ? "done" :
        snapshot.finalStatus === "timeout" ? "error" : "pending",
    },
  ];

  const STEP_STYLES = {
    pending: "border-gray-400/70 bg-background-200 text-gray-900",
    active: "border-amber-700/60 bg-amber-700/10 text-amber-700",
    done: "border-green-700/60 bg-green-700/10 text-green-700",
    error: "border-red-700/60 bg-red-700/10 text-red-700",
  };

  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Workflow Steps
      </p>
      <ul className="space-y-2">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className={`rounded-md border px-3 py-2 ${STEP_STYLES[step.status]}`}
          >
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-300 text-[10px] font-mono text-gray-1000">
                {index + 1}
              </span>
              <span className="text-sm">{step.label}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RunStatusBadge({ status, finalStatus }: { status: RunStatus; finalStatus: RequestStatus | null }) {
  if (status === "done" && finalStatus === "timeout") {
    return (
      <span className="rounded-full bg-red-700/20 px-2 py-0.5 text-xs font-medium text-red-700">
        timeout
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="rounded-full bg-green-700/20 px-2 py-0.5 text-xs font-medium text-green-700">
        delivered
      </span>
    );
  }
  if (status === "generating") {
    return (
      <span className="rounded-full bg-cyan-700/20 px-2 py-0.5 text-xs font-medium text-cyan-700">
        generating
      </span>
    );
  }
  if (status === "awaiting") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        awaiting
      </span>
    );
  }
  if (status === "sending" || status === "matching") {
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
