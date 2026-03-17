"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RecipientListCodeWorkbench } from "./recipient-list-code-workbench";

type ChannelId = "slack" | "email" | "pagerduty" | "webhook";
type Severity = "info" | "warning" | "critical";
type ChannelFailureMode = "none" | "transient" | "permanent";
type RunStatus = "routing" | "delivering" | "done";
type ChannelStatus = "pending" | "matched" | "skipped" | "delivering" | "delivered" | "failed" | "retrying";
type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail" | "retry";

type ChannelSnapshot = {
  id: ChannelId;
  label: string;
  status: ChannelStatus;
  durationMs?: number;
  retryCount?: number;
  error?: string;
};

type RecipientListSnapshot = {
  runId: string;
  alertId: string;
  severity: Severity;
  status: RunStatus;
  elapsedMs: number;
  channels: ChannelSnapshot[];
  summary?: { delivered: number; failed: number; skipped: number };
};

type DemoFailures = {
  transient: ChannelId[];
  permanent: ChannelId[];
};

type StartResponse = {
  runId: string;
  alertId: string;
  severity: Severity;
  status: "routing";
};

type RecipientEvent =
  | { type: "rules_evaluated"; matched: string[]; skipped: string[] }
  | { type: "delivering"; channel: string }
  | { type: "delivered"; channel: string; durationMs: number }
  | { type: "delivery_failed"; channel: string; error: string; attempt: number }
  | { type: "delivery_retrying"; channel: string; attempt: number }
  | { type: "done"; summary: { delivered: number; failed: number; skipped: number } };

type ChannelAccumulator = {
  status: ChannelStatus;
  retryCount: number;
  durationMs?: number;
  error?: string;
};

type RecipientListAccumulator = {
  runId: string;
  alertId: string;
  severity: Severity;
  status: RunStatus;
  channels: Record<ChannelId, ChannelAccumulator>;
  summary?: { delivered: number; failed: number; skipped: number };
};

type WorkflowLineMap = {
  rulesEvaluated: number[];
  allSettled: number[];
  deliveries: number[];
  summary: number[];
};

type StepLineMap = Record<ChannelId, number[]>;
type StepErrorLineMap = Record<ChannelId, number[]>;
type StepRetryLineMap = Record<ChannelId, number[]>;
type StepSuccessLineMap = Record<ChannelId, number[]>;

type DemoProps = {
  workflowCode: string;
  workflowLinesHtml: string[];
  stepCode: string;
  stepLinesHtml: string[];
  workflowLineMap: WorkflowLineMap;
  stepLineMap: StepLineMap;
  stepErrorLineMap: StepErrorLineMap;
  stepRetryLineMap: StepRetryLineMap;
  stepSuccessLineMap: StepSuccessLineMap;
};

type HighlightState = {
  workflowActiveLines: number[];
  stepActiveLines: number[];
  workflowGutterMarks: Record<number, GutterMarkKind>;
  stepGutterMarks: Record<number, GutterMarkKind>;
  activeChannel: ChannelId | null;
};

const MIN_MOCK_CHANNEL_DURATION_MS = 500;
const ELAPSED_TICK_MS = 120;

export const RECIPIENT_LIST_DEMO_DEFAULTS = {
  alertId: "ALERT-7042",
  message: "Server CPU usage exceeded 95% in us-east-1",
};

const INITIAL_FAILURE_MODES: Record<ChannelId, ChannelFailureMode> = {
  slack: "none",
  email: "none",
  pagerduty: "none",
  webhook: "none",
};

const CHANNEL_OPTIONS: Array<{
  id: ChannelId;
  label: string;
  compactLabel: string;
  durationMs: number;
}> = [
  { id: "slack", label: "Slack", compactLabel: "SL", durationMs: Math.max(MIN_MOCK_CHANNEL_DURATION_MS, 650) },
  { id: "email", label: "Email", compactLabel: "EM", durationMs: Math.max(MIN_MOCK_CHANNEL_DURATION_MS, 900) },
  { id: "pagerduty", label: "PagerDuty", compactLabel: "PD", durationMs: Math.max(MIN_MOCK_CHANNEL_DURATION_MS, 750) },
  { id: "webhook", label: "Webhook", compactLabel: "WH", durationMs: Math.max(MIN_MOCK_CHANNEL_DURATION_MS, 1100) },
];

const SEVERITY_OPTIONS: Severity[] = ["info", "warning", "critical"];

function isChannelId(value: string): value is ChannelId {
  return value === "slack" || value === "email" || value === "pagerduty" || value === "webhook";
}

function createInitialChannels(): Record<ChannelId, ChannelAccumulator> {
  return {
    slack: { status: "pending", retryCount: 0 },
    email: { status: "pending", retryCount: 0 },
    pagerduty: { status: "pending", retryCount: 0 },
    webhook: { status: "pending", retryCount: 0 },
  };
}

export function createAccumulator(start: StartResponse): RecipientListAccumulator {
  return {
    runId: start.runId,
    alertId: start.alertId,
    severity: start.severity,
    status: start.status === "routing" ? "routing" : "routing",
    channels: createInitialChannels(),
  };
}

export function applyRecipientEvent(
  current: RecipientListAccumulator,
  event: RecipientEvent
): RecipientListAccumulator {
  if (event.type === "rules_evaluated") {
    const channels = { ...current.channels };
    for (const ch of event.matched) {
      if (isChannelId(ch)) channels[ch] = { status: "matched", retryCount: 0 };
    }
    for (const ch of event.skipped) {
      if (isChannelId(ch)) channels[ch] = { status: "skipped", retryCount: 0 };
    }
    return { ...current, status: "delivering", channels };
  }

  if (event.type === "done") {
    return { ...current, status: "done", summary: event.summary };
  }

  if (!("channel" in event) || !isChannelId(event.channel)) {
    return current;
  }

  const previous = current.channels[event.channel];
  const channels = { ...current.channels };

  if (event.type === "delivering") {
    channels[event.channel] = { status: "delivering", retryCount: previous.retryCount };
  } else if (event.type === "delivery_retrying") {
    channels[event.channel] = {
      status: "retrying",
      retryCount: Math.max(previous.retryCount, Math.max(0, event.attempt - 1)),
    };
  } else if (event.type === "delivered") {
    channels[event.channel] = {
      status: "delivered",
      retryCount: previous.retryCount,
      durationMs: event.durationMs,
    };
  } else if (event.type === "delivery_failed") {
    channels[event.channel] = {
      status: "failed",
      retryCount: Math.max(previous.retryCount, Math.max(0, event.attempt - 1)),
      error: event.error,
    };
  }

  return { ...current, channels };
}

export function toSnapshot(
  accumulator: RecipientListAccumulator,
  startedAtMs: number
): RecipientListSnapshot {
  const channels: ChannelSnapshot[] = CHANNEL_OPTIONS.map((channel) => {
    const current = accumulator.channels[channel.id];
    return {
      id: channel.id,
      label: channel.label,
      status: current.status,
      durationMs: current.durationMs,
      retryCount: current.retryCount && current.retryCount > 0 ? current.retryCount : undefined,
      error: current.error,
    };
  });

  return {
    runId: accumulator.runId,
    alertId: accumulator.alertId,
    severity: accumulator.severity,
    status: accumulator.status,
    elapsedMs: Math.max(0, Date.now() - startedAtMs),
    channels,
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

export function parseRecipientEvent(rawChunk: string): RecipientEvent | null {
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

  if (type === "rules_evaluated" && Array.isArray(event.matched) && Array.isArray(event.skipped)) {
    return { type, matched: event.matched as string[], skipped: event.skipped as string[] };
  }

  if (type === "delivering" && typeof event.channel === "string") {
    return { type, channel: event.channel };
  }

  if (type === "delivered" && typeof event.channel === "string" && typeof event.durationMs === "number") {
    return { type, channel: event.channel, durationMs: event.durationMs };
  }

  if (type === "delivery_failed" && typeof event.channel === "string" && typeof event.error === "string" && typeof event.attempt === "number") {
    return { type, channel: event.channel, error: event.error, attempt: event.attempt };
  }

  if (type === "delivery_retrying" && typeof event.channel === "string" && typeof event.attempt === "number") {
    return { type, channel: event.channel, attempt: event.attempt };
  }

  if (type === "done" && event.summary && typeof event.summary === "object") {
    const summary = event.summary as { delivered?: unknown; failed?: unknown; skipped?: unknown };
    if (typeof summary.delivered === "number" && typeof summary.failed === "number" && typeof summary.skipped === "number") {
      return { type, summary: { delivered: summary.delivered, failed: summary.failed, skipped: summary.skipped } };
    }
  }

  return null;
}

const EMPTY_HIGHLIGHT_STATE: HighlightState = {
  workflowActiveLines: [],
  stepActiveLines: [],
  workflowGutterMarks: {},
  stepGutterMarks: {},
  activeChannel: null,
};

function formatElapsedMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function channelColor(status: ChannelStatus): string {
  if (status === "delivered") return "var(--color-green-700)";
  if (status === "failed") return "var(--color-red-700)";
  if (status === "delivering" || status === "retrying") return "var(--color-amber-700)";
  if (status === "skipped") return "var(--color-gray-700)";
  if (status === "matched") return "var(--color-blue-700)";
  return "var(--color-gray-500)";
}

function mergeUniqueLines(...lineGroups: number[][]): number[] {
  return [...new Set(lineGroups.flat())].sort((a, b) => a - b);
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

function highlightToneForSnapshot(snapshot: RecipientListSnapshot | null): HighlightTone {
  if (!snapshot || snapshot.status === "routing" || snapshot.status === "delivering") return "amber";
  return snapshot.summary?.failed ? "red" : "green";
}

function pickActiveChannel(snapshot: RecipientListSnapshot): ChannelId | null {
  if (snapshot.status !== "delivering") return null;
  const activeChannels = snapshot.channels.filter(
    (ch) => ch.status === "delivering" || ch.status === "retrying"
  );
  if (activeChannels.length === 0) return null;
  return activeChannels[0].id;
}

function gutterKindForChannel(channel: ChannelSnapshot): GutterMarkKind {
  if (channel.status === "failed") return "fail";
  if (channel.retryCount && channel.retryCount > 0) return "retry";
  return "success";
}

function buildHighlightState(
  snapshot: RecipientListSnapshot | null,
  workflowLineMap: WorkflowLineMap,
  stepLineMap: StepLineMap,
  stepErrorLineMap: StepErrorLineMap,
  stepRetryLineMap: StepRetryLineMap,
  stepSuccessLineMap: StepSuccessLineMap
): HighlightState {
  if (!snapshot) return EMPTY_HIGHLIGHT_STATE;

  const workflowGutterMarks: Record<number, GutterMarkKind> = {};
  const stepGutterMarks: Record<number, GutterMarkKind> = {};

  const gutterLinesForChannel = (channel: ChannelSnapshot): number[] => {
    const kind = gutterKindForChannel(channel);
    if (kind === "fail") return stepErrorLineMap[channel.id] ?? [];
    if (kind === "retry") return stepRetryLineMap[channel.id] ?? [];
    return stepSuccessLineMap[channel.id] ?? [];
  };

  if (snapshot.status === "routing") {
    return {
      workflowActiveLines: workflowLineMap.rulesEvaluated,
      stepActiveLines: [],
      workflowGutterMarks,
      stepGutterMarks,
      activeChannel: null,
    };
  }

  if (snapshot.status === "delivering") {
    const activeChannel = pickActiveChannel(snapshot);

    for (const channel of snapshot.channels) {
      if (channel.status === "delivered" || channel.status === "failed") {
        addGutterMarks(stepGutterMarks, gutterLinesForChannel(channel), gutterKindForChannel(channel));
      }
    }

    return {
      workflowActiveLines: workflowLineMap.allSettled,
      stepActiveLines: activeChannel ? stepLineMap[activeChannel] ?? [] : [],
      workflowGutterMarks,
      stepGutterMarks,
      activeChannel,
    };
  }

  // done
  for (const channel of snapshot.channels) {
    if (channel.status === "delivered" || channel.status === "failed") {
      addGutterMarks(stepGutterMarks, gutterLinesForChannel(channel), gutterKindForChannel(channel));
    }
  }

  addGutterMarks(
    workflowGutterMarks,
    mergeUniqueLines(workflowLineMap.allSettled.slice(0, 1), workflowLineMap.summary)
  );

  return {
    workflowActiveLines: [],
    stepActiveLines: [],
    workflowGutterMarks,
    stepGutterMarks,
    activeChannel: null,
  };
}

type LogTone = "default" | "green" | "amber" | "red" | "cyan";
type LogEntry = { text: string; tone: LogTone };

function eventToLogEntry(event: RecipientEvent, elapsedMs: number): LogEntry {
  const ts = formatElapsedMs(elapsedMs);

  switch (event.type) {
    case "rules_evaluated":
      return { text: `[${ts}] rules evaluated — matched: ${event.matched.join(", ")}; skipped: ${event.skipped.join(", ") || "none"}`, tone: "cyan" };
    case "delivering":
      return { text: `[${ts}] ${event.channel} delivering...`, tone: "default" };
    case "delivery_retrying":
      return { text: `[${ts}] ${event.channel} retrying (attempt ${event.attempt})...`, tone: "amber" };
    case "delivered":
      return { text: `[${ts}] ${event.channel} delivered (${event.durationMs}ms)`, tone: "green" };
    case "delivery_failed":
      return { text: `[${ts}] ${event.channel} failed: ${event.error}`, tone: "red" };
    case "done": {
      const tone: LogTone = event.summary.failed > 0 ? "red" : "green";
      return { text: `[${ts}] done — delivered=${event.summary.delivered}, failed=${event.summary.failed}, skipped=${event.summary.skipped}`, tone };
    }
  }
}

const IDLE_LOG: LogEntry[] = [
  { text: "Idle: click Route Alert to evaluate rules and deliver to matching channels.", tone: "default" },
  { text: "Routing rules determine which channels receive the alert based on severity.", tone: "default" },
];

const LOG_TONE_CLASS: Record<LogTone, string> = {
  default: "text-gray-900",
  green: "text-green-700",
  amber: "text-amber-700",
  red: "text-red-700",
  cyan: "text-cyan-700",
};

function statusExplanation(
  status: RunStatus | "idle",
  severity: Severity,
  activeChannel: ChannelId | null
): string {
  if (status === "idle") {
    return "Waiting to start. Select a severity level and click Route Alert.";
  }

  if (status === "routing") {
    return `Evaluating routing rules for severity="${severity}" to determine matched channels.`;
  }

  if (status === "delivering") {
    if (activeChannel) {
      return `Delivering to matched recipients via Promise.allSettled(). Tracing: ${activeChannel}.`;
    }
    return `Delivering to matched recipients via Promise.allSettled().`;
  }

  return "Completed: all matched channels settled and the summary is persisted.";
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

const FAILURE_MODE_CYCLE: Record<ChannelFailureMode, ChannelFailureMode> = {
  none: "transient",
  transient: "permanent",
  permanent: "none",
};

function deriveFailures(modes: Record<ChannelId, ChannelFailureMode>): DemoFailures {
  const transient: ChannelId[] = [];
  const permanent: ChannelId[] = [];
  for (const [id, mode] of Object.entries(modes) as [ChannelId, ChannelFailureMode][]) {
    if (mode === "transient") transient.push(id);
    else if (mode === "permanent") permanent.push(id);
  }
  return { transient, permanent };
}

export function RecipientListDemo({
  workflowCode,
  workflowLinesHtml,
  stepCode,
  stepLinesHtml,
  workflowLineMap,
  stepLineMap,
  stepErrorLineMap,
  stepRetryLineMap,
  stepSuccessLineMap,
}: DemoProps) {
  const [severity, setSeverity] = useState<Severity>("warning");
  const [failureModes, setFailureModes] = useState<Record<ChannelId, ChannelFailureMode>>(
    INITIAL_FAILURE_MODES
  );
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RecipientListSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<LogEntry[]>(IDLE_LOG);

  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const accumulatorRef = useRef<RecipientListAccumulator | null>(null);
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

        const applyEvent = (event: RecipientEvent) => {
          if (signal.aborted || !startedAtRef.current || !accumulatorRef.current) return;

          const elapsedMs = Math.max(0, Date.now() - startedAtRef.current);
          const nextAccumulator = applyRecipientEvent(accumulatorRef.current, event);
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
            const event = parseRecipientEvent(chunk);
            if (!event) continue;
            applyEvent(event);
          }
        }

        if (!signal.aborted && buffer.trim()) {
          const event = parseRecipientEvent(buffer.replaceAll("\r\n", "\n"));
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
      const failures = deriveFailures(failureModes);
      const payload = await postJson<StartResponse>(
        "/api/recipient-list",
        {
          alertId: RECIPIENT_LIST_DEMO_DEFAULTS.alertId,
          message: RECIPIENT_LIST_DEMO_DEFAULTS.message,
          severity,
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
        { text: `[0.00s] alert ${RECIPIENT_LIST_DEMO_DEFAULTS.alertId} queued (severity=${severity})`, tone: "default" },
        { text: "[0.00s] evaluating routing rules against severity...", tone: "default" },
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
    snapshot?.status ?? (runId ? "routing" : "idle");
  const isRunning = runId !== null && snapshot?.status !== "done";
  const canSelectFailChannels = !isRunning;

  const highlights = useMemo(
    () => buildHighlightState(snapshot, workflowLineMap, stepLineMap, stepErrorLineMap, stepRetryLineMap, stepSuccessLineMap),
    [snapshot, workflowLineMap, stepLineMap, stepErrorLineMap, stepRetryLineMap, stepSuccessLineMap]
  );
  const isRetrying = useMemo(
    () => snapshot?.channels.some((ch) => ch.status === "retrying") ?? false,
    [snapshot]
  );
  const highlightTone = useMemo(() => highlightToneForSnapshot(snapshot), [snapshot]);

  const captionText = useMemo(() => {
    if (effectiveStatus === "routing") {
      return `Evaluating RULES.filter(r => r.match("${severity}")) to determine matched channels.`;
    }

    if (effectiveStatus === "delivering" && highlights.activeChannel) {
      return `Promise.allSettled() -> delivering to matched channels. Active: ${highlights.activeChannel}.`;
    }

    if (effectiveStatus === "delivering") {
      return "Promise.allSettled() -> delivering to matched channels in parallel.";
    }

    return "RULES.filter() determines the recipient list. Promise.allSettled() delivers to each independently.";
  }, [effectiveStatus, highlights.activeChannel, severity]);

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
                onClick={() => { void handleStart(); }}
                disabled={isRunning}
                className="cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Route Alert
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
                  Severity
                </span>
                {SEVERITY_OPTIONS.map((sev) => (
                  <button
                    key={sev}
                    type="button"
                    disabled={isRunning}
                    onClick={() => setSeverity(sev)}
                    className={`cursor-pointer rounded px-2 py-0.5 font-mono transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      sev === severity
                        ? sev === "critical"
                          ? "bg-red-700/20 text-red-700"
                          : sev === "warning"
                            ? "bg-amber-700/20 text-amber-700"
                            : "bg-blue-700/20 text-blue-700"
                        : "bg-background-200 text-gray-900"
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-md border border-gray-400/70 bg-background-100 px-2 py-1 text-xs text-gray-900">
                <span className="font-semibold uppercase tracking-wide text-gray-900">
                  Fail
                </span>
                {CHANNEL_OPTIONS.map((channel) => {
                  const mode = failureModes[channel.id];
                  return (
                    <button
                      key={channel.id}
                      type="button"
                      disabled={!canSelectFailChannels}
                      aria-label={`${channel.label}: ${mode === "none" ? "no failure" : mode === "transient" ? "transient failure" : "permanent failure"} (click to cycle)`}
                      onClick={() => {
                        setFailureModes((prev) => ({
                          ...prev,
                          [channel.id]: FAILURE_MODE_CYCLE[prev[channel.id]],
                        }));
                      }}
                      className={`cursor-pointer rounded px-2 py-0.5 font-mono transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        mode === "none"
                          ? "bg-background-200 text-gray-900"
                          : mode === "transient"
                            ? "bg-amber-700/20 text-amber-700"
                            : "bg-red-700/20 text-red-700"
                      }`}
                    >
                      {channel.compactLabel}
                      {mode !== "none" && (
                        <span className="ml-0.5 text-[10px]">
                          {mode === "transient" ? "T" : "P"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-gray-900">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded bg-background-200 border border-gray-400/70" />
                Pass
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded bg-amber-700/20 border border-amber-700/40" />
                Transient <span className="text-gray-700">(retry succeeds)</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded bg-red-700/20 border border-red-700/40" />
                Permanent <span className="text-gray-700">(FatalError)</span>
              </span>
            </div>
          </div>

          <div
            className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2 text-xs text-gray-900"
            role="status"
            aria-live="polite"
          >
            {statusExplanation(effectiveStatus, severity, highlights.activeChannel)}
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
              <span className="text-gray-900">Severity</span>
              <code className="font-mono text-xs text-gray-1000">{severity}</code>
            </div>
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">Completed Channels</span>
              <span className="font-mono text-gray-1000">
                {snapshot?.channels.filter((ch) => ch.status === "delivered" || ch.status === "failed" || ch.status === "skipped").length ?? 0}
                /{snapshot?.channels.length ?? 4}
              </span>
            </div>
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">Tracing Step</span>
              <code className="font-mono text-gray-1000">
                {highlights.activeChannel ?? "-"}
              </code>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <RecipientListGraph channels={snapshot?.channels ?? CHANNEL_OPTIONS.map((c) => ({ id: c.id, label: c.label, status: "pending" as ChannelStatus }))} status={effectiveStatus} />
        <ChannelStatusList channels={snapshot?.channels ?? CHANNEL_OPTIONS.map((c) => ({ id: c.id, label: c.label, status: "pending" as ChannelStatus }))} />
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

      <RecipientListCodeWorkbench
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

function RecipientListGraph({
  channels,
  status,
}: {
  channels: ChannelSnapshot[];
  status: RunStatus | "idle";
}) {
  const byId = new Map(channels.map((ch) => [ch.id, ch]));

  const nodes: Array<{ id: ChannelId; x: number; y: number; short: string; label: string }> = [
    { id: "slack", x: 50, y: 44, short: "SL", label: "Slack" },
    { id: "email", x: 270, y: 44, short: "EM", label: "Email" },
    { id: "pagerduty", x: 50, y: 212, short: "PD", label: "PagerDuty" },
    { id: "webhook", x: 270, y: 212, short: "WH", label: "Webhook" },
  ];

  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Recipient List Graph
      </p>

      <svg
        viewBox="0 0 320 256"
        role="img"
        aria-label="Recipient list routing graph to four channels"
        className="h-auto w-full"
      >
        <rect x={0} y={0} width={320} height={256} fill="var(--color-background-100)" rx={8} />

        {nodes.map((node) => {
          const channel = byId.get(node.id);
          const chStatus = channel?.status ?? "pending";
          const color = channelColor(chStatus);
          const isSkipped = chStatus === "skipped";

          return (
            <g key={node.id}>
              <line
                x1={160}
                y1={128}
                x2={node.x}
                y2={node.y}
                stroke={color}
                strokeWidth={2.5}
                strokeDasharray={
                  isSkipped
                    ? "4 6"
                    : chStatus === "delivering" || chStatus === "retrying"
                      ? "6 4"
                      : undefined
                }
                className={
                  chStatus === "delivering" || chStatus === "retrying"
                    ? "animate-pulse"
                    : undefined
                }
                opacity={isSkipped ? 0.4 : 1}
              />
              <circle
                cx={node.x}
                cy={node.y}
                r={18}
                fill="var(--color-background-200)"
                stroke={color}
                strokeWidth={2.5}
                opacity={isSkipped ? 0.4 : 1}
              />
              <text
                x={node.x}
                y={node.y + 4}
                textAnchor="middle"
                className="fill-gray-1000 font-mono text-xs"
                opacity={isSkipped ? 0.4 : 1}
              >
                {node.short}
              </text>
              <text
                x={node.x}
                y={node.y + 30}
                textAnchor="middle"
                className="fill-gray-900 font-mono text-xs"
                opacity={isSkipped ? 0.4 : 1}
              >
                {node.label}
              </text>
            </g>
          );
        })}

        <circle
          cx={160}
          cy={128}
          r={26}
          fill="var(--color-background-200)"
          stroke={
            status === "done"
              ? "var(--color-green-700)"
              : status === "routing" || status === "delivering"
                ? "var(--color-amber-700)"
                : "var(--color-blue-700)"
          }
          strokeWidth={2.5}
          className="transition-colors duration-500"
        />
        <text
          x={160}
          y={132}
          textAnchor="middle"
          className={`font-mono text-xs font-semibold transition-colors duration-500 ${
            status === "done"
              ? "fill-green-700"
              : status === "routing" || status === "delivering"
                ? "fill-amber-700"
                : "fill-blue-700"
          }`}
        >
          RL
        </text>
      </svg>
    </div>
  );
}

function ChannelStatusList({ channels }: { channels: ChannelSnapshot[] }) {
  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Channel Results
      </p>
      <ul className="space-y-2">
        {channels.map((channel) => (
          <li
            key={channel.id}
            className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm text-gray-1000">{channel.label}</span>
              <StatusBadge status={channel.status} />
            </div>
            {channel.status === "failed" && channel.error ? (
              <p className="mt-1 text-xs text-red-700">{channel.error}</p>
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

  if (status === "delivering") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        delivering
      </span>
    );
  }

  if (status === "routing") {
    return (
      <span className="rounded-full bg-blue-700/20 px-2 py-0.5 text-xs font-medium text-blue-700">
        routing
      </span>
    );
  }

  return (
    <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-900">
      idle
    </span>
  );
}

function StatusBadge({ status }: { status: ChannelStatus }) {
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

  if (status === "delivering") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        delivering
      </span>
    );
  }

  if (status === "skipped") {
    return (
      <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-700">
        skipped
      </span>
    );
  }

  if (status === "matched") {
    return (
      <span className="rounded-full bg-blue-700/20 px-2 py-0.5 text-xs font-medium text-blue-700">
        matched
      </span>
    );
  }

  return (
    <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-900">
      pending
    </span>
  );
}
