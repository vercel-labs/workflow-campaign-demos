"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FanOutCodeWorkbench } from "./fanout-code-workbench";

type ChannelId = "slack" | "email" | "sms" | "pagerduty";
type ChannelFailureMode = "none" | "transient" | "permanent";
type RunStatus = "fan_out" | "aggregating" | "done";
type ChannelStatus = "pending" | "sending" | "sent" | "failed" | "retrying";
type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail";

type ChannelSnapshot = {
  id: ChannelId;
  label: string;
  durationMs: number;
  status: Exclude<ChannelStatus, "pending">;
  retryCount?: number;
  error?: string;
};

type DisplayChannelSnapshot = {
  id: ChannelId;
  label: string;
  durationMs: number;
  status: ChannelStatus;
  retryCount?: number;
  error?: string;
};

type FanOutSnapshot = {
  runId: string;
  incidentId: string;
  message: string;
  status: RunStatus;
  elapsedMs: number;
  channels: ChannelSnapshot[];
  summary?: {
    ok: number;
    failed: number;
  };
};

type StartResponse = {
  runId: string;
  incidentId: string;
  message: string;
  failChannels: ChannelId[];
  permanentFailChannels: ChannelId[];
  status: "fan_out";
};

type ChannelEvent =
  | { type: "channel_sending"; channel: string }
  | { type: "channel_sent"; channel: string; providerId: string }
  | { type: "channel_failed"; channel: string; error: string; attempt: number }
  | { type: "channel_retrying"; channel: string; attempt: number }
  | { type: "aggregating" }
  | { type: "done"; summary: { ok: number; failed: number } };

type ChannelAccumulator = {
  status: ChannelStatus;
  retryCount: number;
  error?: string;
};

type FanOutAccumulator = {
  runId: string;
  incidentId: string;
  message: string;
  status: RunStatus;
  channels: Record<ChannelId, ChannelAccumulator>;
  summary?: {
    ok: number;
    failed: number;
  };
};

type WorkflowLineMap = {
  allSettled: number[];
  deliveries: number[];
  summary: number[];
  returnResult: number[];
};

type StepLineMap = Record<ChannelId, number[]>;
type StepErrorLineMap = Record<ChannelId, number[]>;
type StepSuccessLineMap = Record<ChannelId, number[]>;

type DemoProps = {
  workflowCode: string;
  workflowLinesHtml: string[];
  stepCode: string;
  stepLinesHtml: string[];
  workflowLineMap: WorkflowLineMap;
  stepLineMap: StepLineMap;
  stepErrorLineMap: StepErrorLineMap;
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

export const FAN_OUT_DEMO_DEFAULTS = {
  incidentId: "INC-2041",
  message: "Database latency exceeded 1.5s threshold in us-east-1",
};

const INITIAL_FAILURE_MODES: Record<ChannelId, ChannelFailureMode> = {
  slack: "none",
  email: "none",
  sms: "none",
  pagerduty: "none",
};

const CHANNEL_OPTIONS: Array<{
  id: ChannelId;
  label: string;
  compactLabel: string;
  durationMs: number;
}> = [
  {
    id: "slack",
    label: "Slack",
    compactLabel: "SL",
    durationMs: Math.max(MIN_MOCK_CHANNEL_DURATION_MS, 650),
  },
  {
    id: "email",
    label: "Email",
    compactLabel: "EM",
    durationMs: Math.max(MIN_MOCK_CHANNEL_DURATION_MS, 900),
  },
  {
    id: "sms",
    label: "SMS",
    compactLabel: "SMS",
    durationMs: Math.max(MIN_MOCK_CHANNEL_DURATION_MS, 1150),
  },
  {
    id: "pagerduty",
    label: "PagerDuty",
    compactLabel: "PD",
    durationMs: Math.max(MIN_MOCK_CHANNEL_DURATION_MS, 750),
  },
];

const DEFAULT_CHANNEL_SNAPSHOT: DisplayChannelSnapshot[] = CHANNEL_OPTIONS.map(
  (channel) => ({
    id: channel.id,
    label: channel.label,
    durationMs: channel.durationMs,
    status: "pending",
  })
);

function isChannelId(value: string): value is ChannelId {
  return (
    value === "slack" ||
    value === "email" ||
    value === "sms" ||
    value === "pagerduty"
  );
}

function createInitialChannels(): Record<ChannelId, ChannelAccumulator> {
  return {
    slack: { status: "pending", retryCount: 0 },
    email: { status: "pending", retryCount: 0 },
    sms: { status: "pending", retryCount: 0 },
    pagerduty: { status: "pending", retryCount: 0 },
  };
}

export function createAccumulator(start: StartResponse): FanOutAccumulator {
  return {
    runId: start.runId,
    incidentId: start.incidentId,
    message: start.message,
    status: start.status,
    channels: createInitialChannels(),
  };
}

export function applyChannelEvent(
  current: FanOutAccumulator,
  event: ChannelEvent
): FanOutAccumulator {
  if (event.type === "aggregating") {
    return {
      ...current,
      status: "aggregating",
    };
  }

  if (event.type === "done") {
    return {
      ...current,
      status: "done",
      summary: event.summary,
    };
  }

  if (!isChannelId(event.channel)) {
    return current;
  }

  const previous = current.channels[event.channel];
  const channels = {
    ...current.channels,
  };

  if (event.type === "channel_sending") {
    channels[event.channel] = {
      status: "sending",
      retryCount: previous.retryCount,
      error: undefined,
    };
  } else if (event.type === "channel_retrying") {
    channels[event.channel] = {
      status: "retrying",
      retryCount: Math.max(previous.retryCount, Math.max(0, event.attempt - 1)),
      error: undefined,
    };
  } else if (event.type === "channel_sent") {
    channels[event.channel] = {
      status: "sent",
      retryCount: previous.retryCount,
      error: undefined,
    };
  } else if (event.type === "channel_failed") {
    channels[event.channel] = {
      status: "failed",
      retryCount: Math.max(previous.retryCount, Math.max(0, event.attempt - 1)),
      error: event.error,
    };
  }

  return {
    ...current,
    status: "fan_out",
    channels,
  };
}

export function toSnapshot(
  accumulator: FanOutAccumulator,
  startedAtMs: number
): FanOutSnapshot {
  const channels: ChannelSnapshot[] = CHANNEL_OPTIONS.flatMap((channel) => {
    const current = accumulator.channels[channel.id];
    if (!current || current.status === "pending") {
      return [];
    }

    return [
      {
        id: channel.id,
        label: channel.label,
        durationMs: channel.durationMs,
        status: current.status,
        retryCount: current.retryCount > 0 ? current.retryCount : undefined,
        error: current.error,
      },
    ];
  });

  return {
    runId: accumulator.runId,
    incidentId: accumulator.incidentId,
    message: accumulator.message,
    status: accumulator.status,
    elapsedMs: Math.max(0, Date.now() - startedAtMs),
    channels,
    summary: accumulator.summary,
  };
}

function mergeDisplayChannels(snapshot: FanOutSnapshot | null): DisplayChannelSnapshot[] {
  if (!snapshot) {
    return DEFAULT_CHANNEL_SNAPSHOT;
  }

  const byId = new Map(snapshot.channels.map((channel) => [channel.id, channel]));

  return CHANNEL_OPTIONS.map((channel) => {
    const current = byId.get(channel.id);
    if (!current) {
      return {
        id: channel.id,
        label: channel.label,
        durationMs: channel.durationMs,
        status: "pending",
      };
    }

    return {
      id: channel.id,
      label: channel.label,
      durationMs: channel.durationMs,
      status: current.status,
      retryCount: current.retryCount,
      error: current.error,
    };
  });
}

function parseSseData(rawChunk: string): string {
  return rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
}

export function parseChannelEvent(rawChunk: string): ChannelEvent | null {
  const payload = parseSseData(rawChunk);
  if (!payload) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const event = parsed as Record<string, unknown>;
  const type = event.type;
  if (type === "channel_sending" && typeof event.channel === "string") {
    return { type, channel: event.channel };
  }

  if (
    type === "channel_sent" &&
    typeof event.channel === "string" &&
    typeof event.providerId === "string"
  ) {
    return { type, channel: event.channel, providerId: event.providerId };
  }

  if (
    type === "channel_failed" &&
    typeof event.channel === "string" &&
    typeof event.error === "string" &&
    typeof event.attempt === "number"
  ) {
    return {
      type,
      channel: event.channel,
      error: event.error,
      attempt: event.attempt,
    };
  }

  if (
    type === "channel_retrying" &&
    typeof event.channel === "string" &&
    typeof event.attempt === "number"
  ) {
    return { type, channel: event.channel, attempt: event.attempt };
  }

  if (type === "aggregating") {
    return { type };
  }

  if (
    type === "done" &&
    event.summary &&
    typeof event.summary === "object" &&
    typeof (event.summary as { ok?: unknown }).ok === "number" &&
    typeof (event.summary as { failed?: unknown }).failed === "number"
  ) {
    const summary = event.summary as { ok: number; failed: number };
    return {
      type,
      summary: {
        ok: summary.ok,
        failed: summary.failed,
      },
    };
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

export function ensureActiveAbortController(
  existing: AbortController | null
): AbortController {
  if (!existing || existing.signal.aborted) {
    return new AbortController();
  }

  return existing;
}

function formatElapsedMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function channelColor(status: ChannelStatus): string {
  if (status === "sent") return "var(--color-green-700)";
  if (status === "failed") return "var(--color-red-700)";
  if (status === "sending" || status === "retrying") return "var(--color-amber-700)";
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

function highlightToneForSnapshot(snapshot: FanOutSnapshot | null): HighlightTone {
  if (!snapshot || snapshot.status === "fan_out") {
    return "amber";
  }

  if (snapshot.status === "aggregating") {
    return "cyan";
  }

  return snapshot.summary?.failed ? "red" : "green";
}

function pickActiveChannel(snapshot: FanOutSnapshot): ChannelId | null {
  if (snapshot.status !== "fan_out") {
    return null;
  }

  const activeChannels = snapshot.channels.filter(
    (channel) => channel.status === "sending" || channel.status === "retrying"
  );
  if (activeChannels.length === 0) {
    return null;
  }

  return activeChannels.reduce((current, channel) => {
    if (channel.durationMs < current.durationMs) {
      return channel;
    }
    return current;
  }).id;
}

function buildHighlightState(
  snapshot: FanOutSnapshot | null,
  workflowLineMap: WorkflowLineMap,
  stepLineMap: StepLineMap,
  stepErrorLineMap: StepErrorLineMap,
  stepSuccessLineMap: StepSuccessLineMap
): HighlightState {
  if (!snapshot) {
    return EMPTY_HIGHLIGHT_STATE;
  }

  const workflowGutterMarks: Record<number, GutterMarkKind> = {};
  const stepGutterMarks: Record<number, GutterMarkKind> = {};

  if (snapshot.status === "fan_out") {
    const activeChannel = pickActiveChannel(snapshot);

    for (const channel of snapshot.channels) {
      if (channel.status !== "sending" && channel.status !== "retrying") {
        const isFailed = channel.status === "failed";
        addGutterMarks(
          stepGutterMarks,
          isFailed
            ? (stepErrorLineMap[channel.id] ?? [])
            : (stepSuccessLineMap[channel.id] ?? []),
          isFailed ? "fail" : "success"
        );
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

  const snapshotChannelById = new Map(
    snapshot.channels.map((channel) => [channel.id, channel] as const)
  );

  for (const channel of CHANNEL_OPTIONS) {
    const channelStatus = snapshotChannelById.get(channel.id)?.status;
    if (channelStatus === "failed") {
      addGutterMarks(stepGutterMarks, stepErrorLineMap[channel.id] ?? [], "fail");
      continue;
    }

    if (channelStatus === "sent") {
      addGutterMarks(
        stepGutterMarks,
        stepSuccessLineMap[channel.id] ?? [],
        "success"
      );
    }
  }

  if (snapshot.status === "aggregating") {
    addGutterMarks(workflowGutterMarks, workflowLineMap.allSettled.slice(0, 1));

    return {
      workflowActiveLines: mergeUniqueLines(
        workflowLineMap.deliveries,
        workflowLineMap.summary
      ),
      stepActiveLines: [],
      workflowGutterMarks,
      stepGutterMarks,
      activeChannel: null,
    };
  }

  addGutterMarks(
    workflowGutterMarks,
    mergeUniqueLines(
      workflowLineMap.allSettled.slice(0, 1),
      workflowLineMap.summary
    )
  );

  return {
    workflowActiveLines: [],
    stepActiveLines: [],
    workflowGutterMarks,
    stepGutterMarks,
    activeChannel: null,
  };
}

function buildExecutionLog(
  snapshot: FanOutSnapshot | null,
  channels: DisplayChannelSnapshot[],
  incidentId: string,
  message: string
): string[] {
  if (!snapshot) {
    return [
      "Idle: click Dispatch Alert to start the run.",
      "Promise.allSettled() will fan out to all channels in parallel.",
    ];
  }

  const entries: string[] = [
    `[0.00s] incident ${incidentId} queued`,
    "[0.00s] Promise.allSettled() launched 4 channel sends",
  ];

  for (const channel of channels) {
    if (channel.status === "pending") {
      continue;
    }

    if (channel.status === "sending") {
      entries.push(
        `[${formatElapsedMs(Math.min(snapshot.elapsedMs, channel.durationMs))}] ${channel.id} sending...`
      );
      continue;
    }

    if (channel.status === "failed") {
      entries.push(
        `[${formatElapsedMs(channel.durationMs)}] ${channel.id} failed: ${channel.error}`
      );
      continue;
    }

    if (channel.status === "retrying") {
      entries.push(
        `[${formatElapsedMs(snapshot.elapsedMs)}] retrying ${channel.id}...`
      );
      continue;
    }

    if (channel.retryCount && channel.retryCount > 0) {
      entries.push(
        `[${formatElapsedMs(channel.durationMs)}] ${channel.id} sent (retry succeeded)`
      );
      continue;
    }

    entries.push(`[${formatElapsedMs(channel.durationMs)}] ${channel.id} sent`);
  }

  if (snapshot.status === "aggregating") {
    entries.push(
      `[${formatElapsedMs(snapshot.elapsedMs)}] aggregating deliveries and summary`
    );
  }

  if (snapshot.status === "done" && snapshot.summary) {
    entries.push(
      `[${formatElapsedMs(snapshot.elapsedMs)}] summary recorded: ok=${snapshot.summary.ok}, failed=${snapshot.summary.failed}`
    );
  }

  entries.push(`[${formatElapsedMs(snapshot.elapsedMs)}] message: ${message}`);

  return entries;
}

function statusExplanation(
  status: RunStatus | "idle",
  activeChannel: ChannelId | null,
  isRetrying: boolean
): string {
  if (status === "idle") {
    return "Waiting to start. Click Dispatch Alert to run the workflow.";
  }

  if (status === "fan_out") {
    if (isRetrying) {
      return "Fan-out active: retrying a failed channel while Promise.allSettled() waits for every branch to settle.";
    }

    if (!activeChannel) {
      return "Fan-out active: Promise.allSettled() is waiting for every channel to settle.";
    }

    return `Fan-out active: tracing ${activeChannel} while every channel continues in parallel.`;
  }

  if (status === "aggregating") {
    return "Aggregation active: mapping settled deliveries and computing summary.";
  }

  return "Completed: all channels settled and the summary checkpoint is persisted.";
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

export function cycleFailureMode(
  previous: Record<ChannelId, ChannelFailureMode>,
  channelId: ChannelId
): Record<ChannelId, ChannelFailureMode> {
  return { ...previous, [channelId]: FAILURE_MODE_CYCLE[previous[channelId]] };
}

function deriveFailArrays(modes: Record<ChannelId, ChannelFailureMode>): {
  failChannels: ChannelId[];
  permanentFailChannels: ChannelId[];
} {
  const failChannels: ChannelId[] = [];
  const permanentFailChannels: ChannelId[] = [];
  for (const [id, mode] of Object.entries(modes) as [ChannelId, ChannelFailureMode][]) {
    if (mode === "transient") failChannels.push(id);
    else if (mode === "permanent") permanentFailChannels.push(id);
  }
  return { failChannels, permanentFailChannels };
}

export function FanOutDemo({
  workflowCode,
  workflowLinesHtml,
  stepCode,
  stepLinesHtml,
  workflowLineMap,
  stepLineMap,
  stepErrorLineMap,
  stepSuccessLineMap,
}: DemoProps) {
  const [failureModes, setFailureModes] = useState<Record<ChannelId, ChannelFailureMode>>(
    INITIAL_FAILURE_MODES
  );
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<FanOutSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const accumulatorRef = useRef<FanOutAccumulator | null>(null);
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
    if (!elapsedRef.current) {
      return;
    }

    clearInterval(elapsedRef.current);
    elapsedRef.current = null;
  }, []);

  const startElapsedTicker = useCallback(() => {
    stopElapsedTicker();
    elapsedRef.current = setInterval(() => {
      const startedAtMs = startedAtRef.current;
      if (!startedAtMs) {
        return;
      }

      setSnapshot((previous) => {
        if (!previous || previous.status === "done") {
          return previous;
        }

        return {
          ...previous,
          elapsedMs: Math.max(0, Date.now() - startedAtMs),
        };
      });
    }, ELAPSED_TICK_MS);
  }, [stopElapsedTicker]);

  const ensureAbortController = useCallback((): AbortController => {
    const nextController = ensureActiveAbortController(abortRef.current);
    abortRef.current = nextController;
    return nextController;
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
          {
            cache: "no-store",
            signal,
          }
        );

        if (signal.aborted) {
          return;
        }

        if (!response.ok || !response.body) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(
            payload?.error ??
              `Readable stream request failed: ${response.status}`
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const applyEvent = (event: ChannelEvent) => {
          if (signal.aborted || !startedAtRef.current || !accumulatorRef.current) {
            return;
          }

          const nextAccumulator = applyChannelEvent(accumulatorRef.current, event);
          accumulatorRef.current = nextAccumulator;

          setSnapshot(toSnapshot(nextAccumulator, startedAtRef.current));

          if (nextAccumulator.status === "done") {
            stopElapsedTicker();
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const normalized = buffer.replaceAll("\r\n", "\n");
          const chunks = normalized.split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const chunk of chunks) {
            if (signal.aborted) {
              return;
            }

            const event = parseChannelEvent(chunk);
            if (!event) {
              continue;
            }

            applyEvent(event);
          }
        }

        if (!signal.aborted && buffer.trim()) {
          const event = parseChannelEvent(buffer.replaceAll("\r\n", "\n"));
          if (event) {
            applyEvent(event);
          }
        }
      } catch (cause: unknown) {
        if (cause instanceof Error && cause.name === "AbortError") {
          return;
        }

        if (signal.aborted) {
          return;
        }

        const detail =
          cause instanceof Error ? cause.message : "Readable stream failed";
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

    stopElapsedTicker();
    abortRef.current?.abort();
    abortRef.current = null;
    startedAtRef.current = null;
    accumulatorRef.current = null;

    try {
      const controller = ensureAbortController();
      const { failChannels, permanentFailChannels } = deriveFailArrays(failureModes);
      const payload = await postJson<StartResponse>(
        "/api/fan-out",
        {
          incidentId: FAN_OUT_DEMO_DEFAULTS.incidentId,
          message: FAN_OUT_DEMO_DEFAULTS.message,
          failChannels,
          permanentFailChannels,
        },
        controller.signal
      );
      if (controller.signal.aborted) {
        return;
      }

      const startedAt = Date.now();
      const nextAccumulator = createAccumulator(payload);
      startedAtRef.current = startedAt;
      accumulatorRef.current = nextAccumulator;
      setRunId(payload.runId);
      setSnapshot(toSnapshot(nextAccumulator, startedAt));

      if (controller.signal.aborted) {
        return;
      }

      startElapsedTicker();
      void connectToReadable(payload);
    } catch (cause: unknown) {
      if (cause instanceof Error && cause.name === "AbortError") {
        return;
      }

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
    setTimeout(() => {
      startButtonRef.current?.focus();
    }, 0);
  };

  const effectiveStatus: RunStatus | "idle" =
    snapshot?.status ?? (runId ? "fan_out" : "idle");
  const channels: DisplayChannelSnapshot[] = useMemo(
    () => mergeDisplayChannels(snapshot),
    [snapshot]
  );
  const isRunning = runId !== null && snapshot?.status !== "done";
  const canSelectFailChannels = !isRunning;

  const executionLog = useMemo(
    () =>
      buildExecutionLog(
        snapshot,
        channels,
        FAN_OUT_DEMO_DEFAULTS.incidentId,
        FAN_OUT_DEMO_DEFAULTS.message
      ),
    [snapshot, channels]
  );

  const highlights = useMemo(
    () => buildHighlightState(snapshot, workflowLineMap, stepLineMap, stepErrorLineMap, stepSuccessLineMap),
    [snapshot, workflowLineMap, stepLineMap, stepErrorLineMap, stepSuccessLineMap]
  );
  const isRetrying = useMemo(
    () => channels.some((channel) => channel.status === "retrying"),
    [channels]
  );
  const highlightTone = useMemo(
    () => highlightToneForSnapshot(snapshot),
    [snapshot]
  );

  const captionText = useMemo(() => {
    if (effectiveStatus === "fan_out" && highlights.activeChannel) {
      return `Promise.allSettled() -> every channel completes, no short-circuit. Active branch: ${highlights.activeChannel}.`;
    }

    if (effectiveStatus === "aggregating") {
      return "Promise.allSettled() -> every channel completes, no short-circuit. Aggregating deliveries + summary.";
    }

    return "Promise.allSettled() -> every channel completes, no short-circuit.";
  }, [effectiveStatus, highlights.activeChannel]);

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
                Dispatch Alert
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

              <div className="flex items-center gap-1.5 overflow-x-auto rounded-md border border-gray-400/70 bg-background-100 px-2 py-1 text-xs text-gray-900">
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
                        setFailureModes((previous) =>
                          cycleFailureMode(previous, channel.id)
                        );
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
          </div>

          <div
            className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2 text-xs text-gray-900"
            role="status"
            aria-live="polite"
          >
            {statusExplanation(effectiveStatus, highlights.activeChannel, isRetrying)}
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
              <span className="text-gray-900">Completed Channels</span>
              <span className="font-mono text-gray-1000">
                {channels.filter((channel) => channel.status !== "sending" && channel.status !== "retrying" && channel.status !== "pending").length}
                /{channels.length}
              </span>
            </div>
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">Tracing Step</span>
              <code className="font-mono text-gray-1000">
                {highlights.activeChannel ?? (effectiveStatus === "aggregating" ? "aggregateResults" : "-")}
              </code>
            </div>
          </div>


        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FanOutGraph channels={channels} status={effectiveStatus} />
        <ChannelStatusList channels={channels} />
      </div>

      <div className="rounded-md border border-gray-400 bg-background-100 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
          Execution Log
        </p>
        <ol className="space-y-1 font-mono text-xs text-gray-900">
          {executionLog.map((entry, index) => (
            <li key={`${entry}-${index}`}>{entry}</li>
          ))}
        </ol>
      </div>

      <p className="text-center text-xs italic text-gray-900">{captionText}</p>

      <FanOutCodeWorkbench
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

function FanOutGraph({ channels, status }: { channels: DisplayChannelSnapshot[]; status: RunStatus | "idle" }) {
  const byId = new Map(channels.map((channel) => [channel.id, channel]));

  const nodes: Array<{
    id: ChannelId;
    x: number;
    y: number;
    short: string;
    label: string;
  }> = [
    { id: "slack", x: 50, y: 44, short: "SL", label: "Slack" },
    { id: "email", x: 270, y: 44, short: "EM", label: "Email" },
    { id: "sms", x: 50, y: 212, short: "SM", label: "SMS" },
    { id: "pagerduty", x: 270, y: 212, short: "PD", label: "PagerDuty" },
  ];

  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Parallel Fan-Out Graph
      </p>

      <svg
        viewBox="0 0 320 256"
        role="img"
        aria-label="Workflow fan-out graph to four channels"
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

        {nodes.map((node) => {
          const channel = byId.get(node.id);
          const status = channel?.status ?? "pending";
          const color = channelColor(status);

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
                  status === "sending" || status === "retrying" ? "6 4" : undefined
                }
                className={
                  status === "sending" || status === "retrying"
                    ? "animate-pulse"
                    : undefined
                }
              />
              <circle
                cx={node.x}
                cy={node.y}
                r={18}
                fill="var(--color-background-200)"
                stroke={color}
                strokeWidth={2.5}
              />
              <text
                x={node.x}
                y={node.y + 4}
                textAnchor="middle"
                className="fill-gray-1000 font-mono text-xs"
              >
                {node.short}
              </text>
              <text
                x={node.x}
                y={node.y + 30}
                textAnchor="middle"
                className="fill-gray-900 font-mono text-xs"
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
          stroke={status === "done" ? "var(--color-green-700)" : status === "fan_out" || status === "aggregating" ? "var(--color-amber-700)" : "var(--color-blue-700)"}
          strokeWidth={2.5}
          className="transition-colors duration-500"
        />
        <text
          x={160}
          y={132}
          textAnchor="middle"
          className={`font-mono text-xs font-semibold transition-colors duration-500 ${
            status === "done" ? "fill-green-700" : status === "fan_out" || status === "aggregating" ? "fill-amber-700" : "fill-blue-700"
          }`}
        >
          WF
        </text>
      </svg>
    </div>
  );
}

function ChannelStatusList({ channels }: { channels: DisplayChannelSnapshot[] }) {
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

  if (status === "aggregating") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        aggregating
      </span>
    );
  }

  if (status === "fan_out") {
    return (
      <span className="rounded-full bg-blue-700/20 px-2 py-0.5 text-xs font-medium text-blue-700">
        fan_out
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
  if (status === "sent") {
    return (
      <span className="rounded-full bg-green-700/20 px-2 py-0.5 text-xs font-medium text-green-700">
        sent
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

  if (status === "sending") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        sending
      </span>
    );
  }

  return (
    <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-900">
      pending
    </span>
  );
}
