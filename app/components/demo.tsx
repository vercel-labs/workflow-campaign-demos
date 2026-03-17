"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RequestReplyCodeWorkbench } from "./request-reply-code-workbench";

type RunStatus = "idle" | "requesting" | "done";
type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail" | "retry";

type RequestReplyEvent =
  | { type: "request_sent"; requestId: string; service: string; payload: string }
  | { type: "waiting_for_reply"; requestId: string; service: string; deadline: string }
  | { type: "reply_received"; requestId: string; service: string; response: string; latencyMs: number }
  | { type: "timeout"; requestId: string; service: string; attempt: number }
  | { type: "retrying"; requestId: string; service: string; attempt: number; maxAttempts: number }
  | { type: "all_replies_collected"; requestId: string; results: Array<{ service: string; response: string }> }
  | { type: "failed"; requestId: string; service: string; reason: string }
  | { type: "done"; requestId: string; totalServices: number; successCount: number; failCount: number };

type ServiceState = {
  service: string;
  status: "pending" | "sending" | "waiting" | "received" | "timeout" | "retrying" | "failed";
  response: string | null;
  latencyMs: number | null;
  attempt: number;
  maxAttempts: number;
};

type Accumulator = {
  runId: string;
  requestId: string;
  status: RunStatus;
  services: ServiceState[];
  successCount: number;
  failCount: number;
};

type Snapshot = Accumulator & { elapsedMs: number };

type StartResponse = {
  runId: string;
  requestId: string;
  services: string[];
  status: "started";
};

export type WorkflowLineMap = {
  sendLoop: number[];
  emitCollected: number[];
  emitDone: number[];
};

export type StepLineMap = {
  sendRequest: number[];
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
  { id: "REQ-001", label: "3 services, default timeout", services: ["user-service", "inventory-service", "payment-service"], timeoutMs: 800, maxAttempts: 2 },
  { id: "REQ-002", label: "2 services, tight timeout", services: ["user-service", "payment-service"], timeoutMs: 400, maxAttempts: 3 },
  { id: "REQ-003", label: "All services, generous timeout", services: ["user-service", "inventory-service", "payment-service"], timeoutMs: 2000, maxAttempts: 1 },
];

const SERVICE_COLORS: Record<string, string> = {
  "user-service": "var(--color-blue-700)",
  "inventory-service": "var(--color-amber-700)",
  "payment-service": "var(--color-green-700)",
};

const SERVICE_SHORT: Record<string, string> = {
  "user-service": "USR",
  "inventory-service": "INV",
  "payment-service": "PAY",
};

function parseSseData(rawChunk: string): string {
  return rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
}

function parseEvent(rawChunk: string): RequestReplyEvent | null {
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
  if (typeof event.type !== "string") return null;

  return event as unknown as RequestReplyEvent;
}

function createAccumulator(start: StartResponse): Accumulator {
  return {
    runId: start.runId,
    requestId: start.requestId,
    status: "requesting",
    services: start.services.map((s) => ({
      service: s,
      status: "pending",
      response: null,
      latencyMs: null,
      attempt: 0,
      maxAttempts: 2,
    })),
    successCount: 0,
    failCount: 0,
  };
}

function applyEvent(current: Accumulator, event: RequestReplyEvent): Accumulator {
  const updateService = (service: string, update: Partial<ServiceState>): ServiceState[] =>
    current.services.map((s) => (s.service === service ? { ...s, ...update } : s));

  switch (event.type) {
    case "request_sent":
      return { ...current, services: updateService(event.service, { status: "sending", attempt: current.services.find((s) => s.service === event.service)!.attempt + 1 }) };
    case "waiting_for_reply":
      return { ...current, services: updateService(event.service, { status: "waiting" }) };
    case "reply_received":
      return { ...current, services: updateService(event.service, { status: "received", response: event.response, latencyMs: event.latencyMs }) };
    case "timeout":
      return { ...current, services: updateService(event.service, { status: "timeout" }) };
    case "retrying":
      return { ...current, services: updateService(event.service, { status: "retrying", maxAttempts: event.maxAttempts }) };
    case "failed":
      return { ...current, services: updateService(event.service, { status: "failed" }) };
    case "all_replies_collected":
      return current;
    case "done":
      return { ...current, status: "done", successCount: event.successCount, failCount: event.failCount };
  }
}

function toSnapshot(accumulator: Accumulator, startedAtMs: number): Snapshot {
  return { ...accumulator, elapsedMs: Math.max(0, Date.now() - startedAtMs) };
}

const EMPTY_HIGHLIGHT: HighlightState = {
  workflowActiveLines: [],
  stepActiveLines: [],
  workflowGutterMarks: {},
  stepGutterMarks: {},
};

function buildHighlightState(
  snapshot: Snapshot | null,
  workflowLineMap: WorkflowLineMap,
  stepLineMap: StepLineMap
): HighlightState {
  if (!snapshot) return EMPTY_HIGHLIGHT;

  const workflowGutterMarks: Record<number, GutterMarkKind> = {};
  const stepGutterMarks: Record<number, GutterMarkKind> = {};

  const activeService = snapshot.services.find(
    (s) => s.status === "sending" || s.status === "waiting" || s.status === "retrying"
  );

  if (snapshot.status === "requesting" && activeService) {
    return {
      workflowActiveLines: workflowLineMap.sendLoop,
      stepActiveLines: stepLineMap.sendRequest,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (snapshot.status === "done") {
    for (const line of workflowLineMap.emitDone.slice(0, 1)) {
      workflowGutterMarks[line] = "success";
    }
    for (const line of stepLineMap.sendRequest.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }
    return {
      workflowActiveLines: [],
      stepActiveLines: [],
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  return EMPTY_HIGHLIGHT;
}

function highlightToneForSnapshot(snapshot: Snapshot | null): HighlightTone {
  if (!snapshot) return "amber";
  if (snapshot.status === "done") return "green";
  const hasTimeout = snapshot.services.some((s) => s.status === "timeout" || s.status === "retrying");
  if (hasTimeout) return "red";
  return "cyan";
}

type LogTone = "default" | "green" | "amber" | "red" | "cyan";
type LogEntry = { text: string; tone: LogTone };

function formatElapsedMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function eventToLogEntry(event: RequestReplyEvent, elapsedMs: number): LogEntry {
  const ts = formatElapsedMs(elapsedMs);

  switch (event.type) {
    case "request_sent":
      return { text: `[${ts}] ${event.service} <- request sent (${event.payload})`, tone: "cyan" };
    case "waiting_for_reply":
      return { text: `[${ts}] ${event.service} waiting for reply (deadline: ${event.deadline})`, tone: "default" };
    case "reply_received":
      return { text: `[${ts}] ${event.service} -> reply received in ${event.latencyMs}ms`, tone: "green" };
    case "timeout":
      return { text: `[${ts}] ${event.service} timeout on attempt ${event.attempt}`, tone: "red" };
    case "retrying":
      return { text: `[${ts}] ${event.service} retrying (attempt ${event.attempt}/${event.maxAttempts})`, tone: "amber" };
    case "all_replies_collected":
      return { text: `[${ts}] all replies collected: ${event.results.length} service(s)`, tone: "green" };
    case "failed":
      return { text: `[${ts}] ${event.service} failed: ${event.reason}`, tone: "red" };
    case "done":
      return { text: `[${ts}] done -- ${event.successCount} succeeded, ${event.failCount} failed`, tone: "green" };
  }
}

const IDLE_LOG: LogEntry[] = [
  { text: "Idle: select a request scenario to start the request-reply flow.", tone: "default" },
  { text: "Each service receives a request and must reply within the deadline.", tone: "default" },
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

function statusExplanation(status: RunStatus, services: ServiceState[]): string {
  if (status === "idle") return "Waiting to start. Select a scenario to run the request-reply flow.";

  const activeService = services.find(
    (s) => s.status === "sending" || s.status === "waiting" || s.status === "retrying"
  );
  if (activeService) {
    if (activeService.status === "retrying") {
      return `Retrying ${activeService.service} -- previous attempt timed out.`;
    }
    return `Requesting ${activeService.service} -- waiting for correlated reply within deadline.`;
  }

  if (status === "done") return "All services queried. Replies collected (or timed out).";

  return "Processing request-reply flow...";
}

export function RequestReplyDemo({
  workflowCode,
  workflowLinesHtml,
  stepCode,
  stepLinesHtml,
  workflowLineMap,
  stepLineMap,
}: DemoProps) {
  const [selectedScenario, setSelectedScenario] = useState(0);
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<LogEntry[]>(IDLE_LOG);

  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const accumulatorRef = useRef<Accumulator | null>(null);
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
    if (!runId) hasScrolledRef.current = false;
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
      setSnapshot((prev) => {
        if (!prev || prev.status === "done") return prev;
        return { ...prev, elapsedMs: Math.max(0, Date.now() - startedAtMs) };
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

        const apply = (event: RequestReplyEvent) => {
          if (signal.aborted || !startedAtRef.current || !accumulatorRef.current) return;
          const elapsedMs = Math.max(0, Date.now() - startedAtRef.current);
          const next = applyEvent(accumulatorRef.current, event);
          accumulatorRef.current = next;
          setSnapshot(toSnapshot(next, startedAtRef.current));
          setEventLog((prev) => [...prev, eventToLogEntry(event, elapsedMs)]);
          if (next.status === "done") stopElapsedTicker();
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
            const event = parseEvent(chunk);
            if (event) apply(event);
          }
        }

        if (!signal.aborted && buffer.trim()) {
          const event = parseEvent(buffer.replaceAll("\r\n", "\n"));
          if (event) apply(event);
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
    setEventLog([]);

    stopElapsedTicker();
    abortRef.current?.abort();
    abortRef.current = null;
    startedAtRef.current = null;
    accumulatorRef.current = null;

    const scenario = SAMPLE_REQUESTS[selectedScenario];

    try {
      const controller = ensureAbortController();
      const payload = await postJson<StartResponse>(
        "/api/request-reply",
        {
          requestId: scenario.id,
          services: scenario.services,
          timeoutMs: scenario.timeoutMs,
          maxAttempts: scenario.maxAttempts,
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
        { text: `[0.00s] request ${scenario.id} started -- querying ${scenario.services.length} service(s)`, tone: "default" },
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

  const effectiveStatus: RunStatus = snapshot?.status ?? (runId ? "requesting" : "idle");
  const isRunning = runId !== null && snapshot?.status !== "done";

  const highlights = useMemo(
    () => buildHighlightState(snapshot, workflowLineMap, stepLineMap),
    [snapshot, workflowLineMap, stepLineMap]
  );
  const highlightTone = useMemo(() => highlightToneForSnapshot(snapshot), [snapshot]);

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
              Request Scenarios
            </p>
            <div className="space-y-1.5">
              {SAMPLE_REQUESTS.map((scenario, index) => (
                <button
                  key={scenario.id}
                  type="button"
                  disabled={isRunning}
                  onClick={() => setSelectedScenario(index)}
                  className={`w-full cursor-pointer rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    selectedScenario === index
                      ? "border-blue-700/60 bg-blue-700/10 text-gray-1000"
                      : "border-gray-400/70 bg-background-100 text-gray-900 hover:border-gray-300 hover:text-gray-1000"
                  }`}
                >
                  <span className="font-mono text-xs text-gray-900">{scenario.id}</span>
                  <span className="ml-2">{scenario.label}</span>
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
                Send Requests
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
            {statusExplanation(effectiveStatus, snapshot?.services ?? [])}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-gray-400 bg-background-100 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-900">
              Request-Reply Status
            </span>
            <StatusBadge status={effectiveStatus} />
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">runId</span>
              <code className="font-mono text-xs text-gray-1000">
                {runId ?? "not started"}
              </code>
            </div>
          </div>

          {snapshot?.services.map((svc) => (
            <ServiceStatusRow key={svc.service} service={svc} />
          ))}

          {snapshot?.status === "done" && (
            <div className="rounded-md border border-green-700/40 bg-green-700/10 px-3 py-2">
              <p className="text-xs text-green-700">
                {snapshot.successCount} succeeded, {snapshot.failCount} failed
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <RequestReplyGraph services={snapshot?.services ?? []} status={effectiveStatus} />
        <ServiceTimeline services={snapshot?.services ?? []} status={effectiveStatus} />
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
        Request-Reply: send a request, wait for a correlated reply, timeout and retry.
      </p>

      <RequestReplyCodeWorkbench
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

function ServiceStatusRow({ service }: { service: ServiceState }) {
  const color = SERVICE_COLORS[service.service] ?? "var(--color-gray-700)";
  const statusText =
    service.status === "pending" ? "pending" :
    service.status === "sending" ? "sending..." :
    service.status === "waiting" ? "awaiting reply..." :
    service.status === "received" ? `${service.latencyMs}ms` :
    service.status === "timeout" ? "timeout" :
    service.status === "retrying" ? `retry ${service.attempt}/${service.maxAttempts}` :
    "failed";

  const statusColor =
    service.status === "received" ? "text-green-700" :
    service.status === "timeout" || service.status === "failed" ? "text-red-700" :
    service.status === "retrying" ? "text-amber-700" :
    "text-gray-900";

  return (
    <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="text-gray-900">{service.service}</span>
        </span>
        <span className={`font-mono text-xs ${statusColor}`}>{statusText}</span>
      </div>
    </div>
  );
}

function RequestReplyGraph({
  services,
  status,
}: {
  services: ServiceState[];
  status: RunStatus;
}) {
  const servicePositions = [
    { id: "user-service", x: 260, y: 50 },
    { id: "inventory-service", x: 260, y: 128 },
    { id: "payment-service", x: 260, y: 206 },
  ];

  const centerColor =
    status === "done"
      ? "var(--color-green-700)"
      : status === "requesting"
        ? "var(--color-cyan-700)"
        : "var(--color-blue-700)";

  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Request-Reply Graph
      </p>

      <svg
        viewBox="0 0 320 256"
        role="img"
        aria-label="Request-reply graph showing requester and three service nodes"
        className="h-auto w-full"
      >
        <rect x={0} y={0} width={320} height={256} fill="var(--color-background-100)" rx={8} />

        {servicePositions.map((pos) => {
          const svc = services.find((s) => s.service === pos.id);
          const isActive = svc && (svc.status === "sending" || svc.status === "waiting" || svc.status === "retrying");
          const isDone = svc && (svc.status === "received");
          const isFailed = svc && (svc.status === "failed" || svc.status === "timeout");
          const color = isDone
            ? "var(--color-green-700)"
            : isFailed
              ? "var(--color-red-700)"
              : isActive
                ? (SERVICE_COLORS[pos.id] ?? "var(--color-gray-500)")
                : "var(--color-gray-500)";

          return (
            <g key={pos.id}>
              <line
                x1={80}
                y1={128}
                x2={pos.x}
                y2={pos.y}
                stroke={color}
                strokeWidth={isActive ? 2.5 : 1.5}
                strokeDasharray={isActive ? "6 4" : undefined}
                className={isActive ? "animate-pulse" : undefined}
              />
              <circle
                cx={pos.x}
                cy={pos.y}
                r={18}
                fill="var(--color-background-200)"
                stroke={color}
                strokeWidth={isActive || isDone || isFailed ? 2.5 : 1.5}
              />
              <text
                x={pos.x}
                y={pos.y + 4}
                textAnchor="middle"
                className={`font-mono text-xs ${isDone ? "fill-green-700" : isFailed ? "fill-red-700" : isActive ? "fill-gray-1000" : "fill-gray-500"}`}
              >
                {SERVICE_SHORT[pos.id] ?? "SVC"}
              </text>
              <text
                x={pos.x}
                y={pos.y + 30}
                textAnchor="middle"
                className={`font-mono text-[10px] ${isDone || isActive ? "fill-gray-900" : "fill-gray-500"}`}
              >
                {pos.id.replace("-service", "")}
              </text>
            </g>
          );
        })}

        <circle
          cx={80}
          cy={128}
          r={26}
          fill="var(--color-background-200)"
          stroke={centerColor}
          strokeWidth={2.5}
          className="transition-colors duration-500"
        />
        <text
          x={80}
          y={132}
          textAnchor="middle"
          className={`font-mono text-xs font-semibold transition-colors duration-500 ${
            status === "done" ? "fill-green-700" : status === "requesting" ? "fill-cyan-700" : "fill-blue-700"
          }`}
        >
          REQ
        </text>
      </svg>
    </div>
  );
}

function ServiceTimeline({
  services,
  status,
}: {
  services: ServiceState[];
  status: RunStatus;
}) {
  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Service Timeline
      </p>
      <ul className="space-y-2">
        {services.length === 0 ? (
          <li className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2 text-sm text-gray-900">
            {status === "idle" ? "No requests sent" : "Waiting for service events..."}
          </li>
        ) : (
          services.map((svc) => {
            const color = SERVICE_COLORS[svc.service] ?? "var(--color-gray-700)";
            return (
              <li
                key={svc.service}
                className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-mono text-white"
                    style={{ backgroundColor: color }}
                  >
                    {svc.attempt || "-"}
                  </span>
                  <span className="text-sm text-gray-1000">{svc.service}</span>
                  <span className={`ml-auto text-xs font-mono ${
                    svc.status === "received" ? "text-green-700" :
                    svc.status === "failed" ? "text-red-700" :
                    svc.status === "timeout" ? "text-red-700" :
                    svc.status === "retrying" ? "text-amber-700" :
                    "text-gray-900"
                  }`}>
                    {svc.status === "received" && svc.latencyMs !== null ? `${svc.latencyMs}ms` : svc.status}
                  </span>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: RunStatus }) {
  if (status === "done") {
    return (
      <span className="rounded-full bg-green-700/20 px-2 py-0.5 text-xs font-medium text-green-700">
        done
      </span>
    );
  }
  if (status === "requesting") {
    return (
      <span className="rounded-full bg-cyan-700/20 px-2 py-0.5 text-xs font-medium text-cyan-700">
        requesting
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-900">
      idle
    </span>
  );
}
