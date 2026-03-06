"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DigestCodeWorkbench } from "./digest-code-workbench";

type LifecycleState = "idle" | "collecting" | "sending" | "completed" | "empty";
type HighlightTone = "amber" | "cyan" | "green" | "red";

type DigestEvent = {
  type: string;
  message: string;
  arrivedAtMs: number;
};

type DigestLogEvent = {
  kind: string;
  message: string;
  atMs: number;
};

type DigestWorkflowLineMap = {
  createToken: number[];
  raceLoop: number[];
  pushEvent: number[];
  sendDigest: number[];
  returnSent: number[];
  returnEmpty: number[];
};

type DigestStepLineMap = {
  sendBody: number[];
  returnLine: number[];
};

type ScheduledDigestDemoProps = {
  workflowCode: string;
  workflowHtmlLines: string[];
  workflowLineMap: DigestWorkflowLineMap;
  stepCode: string;
  stepHtmlLines: string[];
  stepLineMap: DigestStepLineMap;
};

const EVENT_PRESETS: Array<{ type: string; message: string; label: string }> = [
  { type: "comment", message: "Alice commented on your post", label: "Comment" },
  { type: "like", message: "Bob liked your photo", label: "Like" },
  { type: "mention", message: "Carol mentioned you in a thread", label: "Mention" },
  { type: "follow", message: "Dave started following you", label: "Follow" },
];

function formatElapsedLabel(durationMs: number): string {
  const seconds = (durationMs / 1000).toFixed(2);
  return `${seconds}s`;
}

function parseSseChunk(rawChunk: string): unknown | null {
  const payload = rawChunk
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trim())
    .join("\n");

  if (!payload) return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export function ScheduledDigestDemo({
  workflowCode,
  workflowHtmlLines,
  workflowLineMap,
  stepCode,
  stepHtmlLines,
  stepLineMap,
}: ScheduledDigestDemoProps) {
  const [lifecycle, setLifecycle] = useState<LifecycleState>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [events, setEvents] = useState<DigestEvent[]>([]);
  const [executionLog, setExecutionLog] = useState<DigestLogEvent[]>([]);
  const [windowMs, setWindowMs] = useState(6_000);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const startedAtRef = useRef<number>(0);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const windowProgressPct = useMemo(() => {
    if (lifecycle !== "collecting" || windowMs <= 0) return 0;
    return Math.min(100, (elapsedMs / windowMs) * 100);
  }, [elapsedMs, windowMs, lifecycle]);

  const stopElapsedTimer = useCallback(() => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopElapsedTimer();
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [stopElapsedTimer]);

  const startElapsedTimer = useCallback(() => {
    stopElapsedTimer();
    startedAtRef.current = Date.now();
    elapsedTimerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 50);
  }, [stopElapsedTimer]);

  const addLogEvent = useCallback((kind: string, message: string) => {
    const atMs = startedAtRef.current > 0 ? Date.now() - startedAtRef.current : 0;
    setExecutionLog((prev) => [...prev, { kind, message, atMs }]);
  }, []);

  const connectSse = useCallback(
    async (targetRunId: string, signal: AbortSignal) => {
      try {
        const res = await fetch(`/api/readable/${targetRunId}`, { signal });
        if (!res.ok || !res.body) {
          throw new Error(`SSE stream unavailable (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.replaceAll("\r\n", "\n").split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const chunk of chunks) {
            const event = parseSseChunk(chunk) as Record<string, unknown> | null;
            if (!event || typeof event.type !== "string") continue;

            switch (event.type) {
              case "window_open":
                addLogEvent("window_open", `Collection window opened (${(event.windowMs as number) / 1000}s)`);
                break;

              case "event_received": {
                const evt = event.event as { type: string; message: string };
                const count = event.eventCount as number;
                const atMs = startedAtRef.current > 0 ? Date.now() - startedAtRef.current : 0;
                setEvents((prev) => [
                  ...prev,
                  { type: evt.type, message: evt.message, arrivedAtMs: atMs },
                ]);
                addLogEvent("event_received", `Event #${count}: ${evt.type} — ${evt.message}`);
                break;
              }

              case "window_closed":
                addLogEvent("window_closed", `Window closed with ${event.eventCount} event(s)`);
                break;

              case "sending_digest":
                setLifecycle("sending");
                addLogEvent("sending_digest", `Sending digest with ${event.eventCount} event(s)`);
                break;

              case "digest_sent":
                addLogEvent("digest_sent", `Digest sent with ${event.eventCount} event(s)`);
                break;

              case "digest_empty":
                addLogEvent("digest_empty", "No events received — digest skipped");
                break;

              case "done": {
                const status = event.status as string;
                stopElapsedTimer();
                if (status === "sent") {
                  setLifecycle("completed");
                  addLogEvent("done", `Workflow complete — digest sent (${event.eventCount} events)`);
                } else {
                  setLifecycle("empty");
                  addLogEvent("done", "Workflow complete — no events, digest skipped");
                }
                break;
              }
            }
          }
        }

        if (buffer.trim()) {
          const event = parseSseChunk(buffer) as Record<string, unknown> | null;
          if (event && event.type === "done") {
            stopElapsedTimer();
            const status = event.status as string;
            if (status === "sent") {
              setLifecycle("completed");
            } else {
              setLifecycle("empty");
            }
          }
        }
      } catch (err) {
        if (signal.aborted) return;
        const message = err instanceof Error ? err.message : "SSE connection failed";
        setError(message);
        stopElapsedTimer();
        setLifecycle("idle");
      }
    },
    [addLogEvent, stopElapsedTimer]
  );

  const hasScrolledRef = useRef(false);

  useEffect(() => {
    if (lifecycle !== "idle" && !hasScrolledRef.current) {
      hasScrolledRef.current = true;
      const heading = document.getElementById("try-it-heading");
      if (heading) {
        const top = heading.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top, behavior: "smooth" });
      }
    }
    if (lifecycle === "idle") {
      hasScrolledRef.current = false;
    }
  }, [lifecycle]);

  const handleStart = useCallback(async () => {
    setError(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/scheduled-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: `user_${Date.now().toString(36)}` }),
        signal: controller.signal,
      });

      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload?.error || `Start failed (${res.status})`);
      }

      setRunId(payload.runId);
      setToken(payload.token);
      setWindowMs(payload.windowMs ?? 6_000);
      setLifecycle("collecting");
      startElapsedTimer();
      void connectSse(payload.runId, controller.signal);
    } catch (startError) {
      if (controller.signal.aborted) return;
      const message =
        startError instanceof Error ? startError.message : "Failed to start digest run";
      setError(message);
      setLifecycle("idle");
    }
  }, [connectSse, startElapsedTimer]);

  const handleAddEvent = useCallback(
    async (preset: (typeof EVENT_PRESETS)[number]) => {
      if (!token || lifecycle !== "collecting") return;

      try {
        await fetch("/api/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            type: preset.type,
            message: preset.message,
          }),
          signal: abortRef.current?.signal,
        });
      } catch {
        // Ignore — event add failures are non-critical
      }
    },
    [token, lifecycle]
  );

  const handleReset = useCallback(() => {
    stopElapsedTimer();
    abortRef.current?.abort();
    abortRef.current = null;
    setLifecycle("idle");
    setRunId(null);
    setToken(null);
    setEvents([]);
    setExecutionLog([]);
    setElapsedMs(0);
    setError(null);
    setTimeout(() => {
      startButtonRef.current?.focus();
    }, 0);
  }, [stopElapsedTimer]);

  const isCollecting = lifecycle === "collecting";

  const phaseExplainer = useMemo(() => {
    if (lifecycle === "idle") {
      return "Waiting to start a digest collection window.";
    }
    if (lifecycle === "collecting") {
      const remaining = Math.max(0, (windowMs - elapsedMs) / 1000).toFixed(1);
      return `while (true) + Promise.race([hook, sleep('${windowMs}ms')]) is collecting for ${remaining}s more. The workflow is durably suspended between wakeups and consumes zero compute while waiting.`;
    }
    if (lifecycle === "sending") {
      return `Window closed. sendDigestEmail() is executing with ${events.length} event(s).`;
    }
    if (lifecycle === "completed") {
      return `Digest sent with ${events.length} event(s).`;
    }
    if (lifecycle === "empty") {
      return "Window closed with no events. Digest skipped.";
    }
    return "Run is active.";
  }, [lifecycle, windowMs, elapsedMs, events.length]);

  type GutterMarkKind = "success" | "fail";

  const codeState = useMemo(() => {
    const wfMarks: Record<number, GutterMarkKind> = {};
    const stepMarks: Record<number, GutterMarkKind> = {};

    if (lifecycle !== "idle") {
      const hasEvents = events.length > 0;
      const hasWindowClosed = executionLog.some((e) => e.kind === "window_closed");
      const hasDigestSent = executionLog.some((e) => e.kind === "digest_sent");
      const hasDigestEmpty = executionLog.some((e) => e.kind === "digest_empty");

      if (hasEvents && lifecycle === "collecting") {
        for (const ln of workflowLineMap.pushEvent) wfMarks[ln] = "success";
        for (const ln of workflowLineMap.createToken) wfMarks[ln] = "success";
      }

      if (hasWindowClosed) {
        for (const ln of workflowLineMap.raceLoop) wfMarks[ln] = "success";
        for (const ln of workflowLineMap.createToken) wfMarks[ln] = "success";
      }

      if (hasDigestSent) {
        for (const ln of workflowLineMap.sendDigest) wfMarks[ln] = "success";
        for (const ln of stepLineMap.sendBody) stepMarks[ln] = "success";
        for (const ln of stepLineMap.returnLine) stepMarks[ln] = "success";
      }

      if (lifecycle === "completed") {
        for (const ln of workflowLineMap.returnSent) wfMarks[ln] = "success";
      }

      if (hasDigestEmpty) {
        for (const ln of workflowLineMap.returnEmpty) wfMarks[ln] = "success";
      }
    }

    if (lifecycle === "idle") {
      return {
        tone: "amber" as HighlightTone,
        workflowActiveLines: [] as number[],
        stepActiveLines: [] as number[],
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    if (lifecycle === "collecting") {
      return {
        tone: "cyan" as HighlightTone,
        workflowActiveLines: workflowLineMap.raceLoop,
        stepActiveLines: [] as number[],
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    if (lifecycle === "sending") {
      return {
        tone: "amber" as HighlightTone,
        workflowActiveLines: workflowLineMap.sendDigest,
        stepActiveLines: stepLineMap.sendBody,
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    if (lifecycle === "completed") {
      return {
        tone: "green" as HighlightTone,
        workflowActiveLines: workflowLineMap.returnSent,
        stepActiveLines: stepLineMap.returnLine,
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    if (lifecycle === "empty") {
      return {
        tone: "green" as HighlightTone,
        workflowActiveLines: workflowLineMap.returnEmpty,
        stepActiveLines: [] as number[],
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    return {
      tone: "amber" as HighlightTone,
      workflowActiveLines: [] as number[],
      stepActiveLines: [] as number[],
      workflowGutterMarks: wfMarks,
      stepGutterMarks: stepMarks,
    };
  }, [lifecycle, events.length, executionLog, stepLineMap, workflowLineMap]);

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-700/40 bg-red-700/10 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="rounded-lg border border-gray-400/70 bg-background-100 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            ref={startButtonRef}
            type="button"
            onClick={() => void handleStart()}
            disabled={lifecycle !== "idle"}
            className="min-h-10 cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start Digest Window
          </button>
          {lifecycle !== "idle" && (
            <button
              type="button"
              onClick={handleReset}
              className="min-h-10 cursor-pointer rounded-md border border-gray-400 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:border-gray-300 hover:text-gray-1000"
            >
              Reset
            </button>
          )}
          {isCollecting && (
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-xs text-gray-900">Add event:</span>
              {EVENT_PRESETS.map((preset) => (
                <button
                  key={preset.type}
                  type="button"
                  onClick={() => void handleAddEvent(preset)}
                  className="cursor-pointer rounded-md border border-cyan-700/40 bg-cyan-700/10 px-2.5 py-1.5 text-xs font-medium text-cyan-700 transition-colors hover:bg-cyan-700/20"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {isCollecting && token && (
          <p className="mt-2 text-xs font-mono text-blue-700">
            POST /api/event with token <span className="text-gray-1000">{token}</span>
          </p>
        )}
      </div>

      <div className="rounded-lg border border-gray-400/70 bg-background-100 p-3">
        <div
          className="mb-2 flex flex-wrap items-center justify-between gap-2"
          role="status"
          aria-live="polite"
        >
          <p className="text-sm text-gray-900">{phaseExplainer}</p>
          <div className="flex flex-wrap items-center gap-2">
            {runId && (
              <span className="rounded-full bg-background-200 px-2.5 py-1 text-xs font-mono text-gray-900">
                run: {runId}
              </span>
            )}
            {token && (
              <span className="rounded-full border border-blue-700/40 bg-blue-700/10 px-2.5 py-1 text-xs font-mono text-blue-700">
                token: {token}
              </span>
            )}
          </div>
        </div>

        {lifecycle === "collecting" && (
          <WindowProgressBar
            progressPct={windowProgressPct}
            remainingMs={Math.max(0, windowMs - elapsedMs)}
            durationMs={windowMs}
          />
        )}

        <div className="lg:h-[200px]">
          <div className="grid grid-cols-1 gap-2 lg:h-full lg:grid-cols-2">
            <EventList events={events} status={lifecycle} />
            <ExecutionLog elapsedMs={elapsedMs} events={executionLog} />
          </div>
        </div>
      </div>

      <p className="text-center text-xs italic text-gray-900">
        sleep() + defineHook() → collect events over a time window with zero infrastructure
      </p>

      <DigestCodeWorkbench
        workflowCode={workflowCode}
        workflowHtmlLines={workflowHtmlLines}
        workflowActiveLines={codeState.workflowActiveLines}
        workflowGutterMarks={codeState.workflowGutterMarks}
        stepCode={stepCode}
        stepHtmlLines={stepHtmlLines}
        stepActiveLines={codeState.stepActiveLines}
        stepGutterMarks={codeState.stepGutterMarks}
        tone={codeState.tone}
      />
    </div>
  );
}

function WindowProgressBar({
  progressPct,
  remainingMs,
  durationMs,
}: {
  progressPct: number;
  remainingMs: number;
  durationMs: number;
}) {
  const remainingSec = (remainingMs / 1000).toFixed(1);
  const totalSec = (durationMs / 1000).toFixed(0);

  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between text-xs text-gray-900">
        <span>Collection window</span>
        <span className="font-mono tabular-nums">
          {remainingSec}s / {totalSec}s remaining
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-300">
        <div
          className="h-full rounded-full bg-cyan-700 transition-all duration-150"
          style={{ width: `${Math.min(100, progressPct)}%` }}
        />
      </div>
    </div>
  );
}

function EventList({
  events,
  status,
}: {
  events: DigestEvent[];
  status: LifecycleState;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [events.length]);

  const eventTypeIcon = (type: string) => {
    switch (type) {
      case "comment":
        return "\u{1F4AC}";
      case "like":
        return "\u2764\uFE0F";
      case "mention":
        return "@";
      case "follow":
        return "\u{1F464}";
      default:
        return "\u2022";
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-gray-400/60 bg-background-200 p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900">
          Events collected
        </h3>
        <span className="rounded-full border border-gray-400/60 bg-background-100 px-2 py-0.5 text-xs font-mono tabular-nums text-gray-900">
          {events.length}
        </span>
      </div>
      <div
        ref={scrollRef}
        className="max-h-[130px] min-h-0 flex-1 overflow-y-auto rounded border border-gray-300/70 bg-background-100 p-1"
      >
        {events.length === 0 && (
          <p className="px-1 py-0.5 text-sm text-gray-900">
            {status === "collecting"
              ? "Waiting for events\u2026 click a button above to add one."
              : "No events."}
          </p>
        )}

        {events.map((event, index) => {
          const tone = eventTypeTone(event.type);
          return (
            <div
              key={`${event.type}-${event.arrivedAtMs}-${index}`}
              className="flex items-center gap-2 px-1 py-0.5 text-sm leading-5 text-gray-900"
            >
              <span className="shrink-0 text-xs" aria-hidden="true">
                {eventTypeIcon(event.type)}
              </span>
              <span
                className={`w-16 shrink-0 text-xs font-semibold uppercase ${tone}`}
              >
                {event.type}
              </span>
              <p className="min-w-0 flex-1 truncate">{event.message}</p>
              <span className="shrink-0 font-mono tabular-nums text-gray-900">
                +{event.arrivedAtMs}ms
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExecutionLog({
  events,
  elapsedMs,
}: {
  events: DigestLogEvent[];
  elapsedMs: number;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [events.length]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-gray-400/60 bg-background-200 p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900">
          Execution log
        </h3>
        <p className="text-xs font-mono tabular-nums text-gray-900">
          {formatElapsedLabel(elapsedMs)}
        </p>
      </div>
      <div
        ref={scrollRef}
        className="max-h-[130px] min-h-0 flex-1 overflow-y-auto rounded border border-gray-300/70 bg-background-100 p-1"
      >
        {events.length === 0 && (
          <p className="px-1 py-0.5 text-sm text-gray-900">No events yet.</p>
        )}

        {events.map((event, index) => {
          const tone = logEventTone(event.kind);
          return (
            <div
              key={`${event.kind}-${event.atMs}-${index}`}
              className="flex items-center gap-2 px-1 py-0.5 text-sm leading-5 text-gray-900"
            >
              <span
                className={`h-2 w-2 rounded-full ${tone.dotClass}`}
                aria-hidden="true"
              />
              <span
                className={`w-20 shrink-0 text-xs font-semibold uppercase ${tone.labelClass}`}
              >
                {event.kind.replace("_", " ")}
              </span>
              <p className="min-w-0 flex-1 truncate">{event.message}</p>
              <span className="shrink-0 font-mono tabular-nums text-gray-900">
                +{event.atMs}ms
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function eventTypeTone(type: string): string {
  switch (type) {
    case "comment":
      return "text-blue-700";
    case "like":
      return "text-red-700";
    case "mention":
      return "text-amber-700";
    case "follow":
      return "text-green-700";
    default:
      return "text-gray-900";
  }
}

function logEventTone(kind: string): {
  dotClass: string;
  labelClass: string;
} {
  switch (kind) {
    case "window_open":
      return { dotClass: "bg-blue-700", labelClass: "text-blue-700" };
    case "event_received":
      return { dotClass: "bg-amber-700", labelClass: "text-amber-700" };
    case "sleep_tick":
      return { dotClass: "bg-cyan-700", labelClass: "text-cyan-700" };
    case "window_closed":
      return { dotClass: "bg-violet-700", labelClass: "text-violet-700" };
    case "sending_digest":
      return { dotClass: "bg-amber-700", labelClass: "text-amber-700" };
    case "digest_sent":
      return { dotClass: "bg-green-700", labelClass: "text-green-700" };
    case "digest_empty":
      return { dotClass: "bg-gray-900", labelClass: "text-gray-900" };
    case "done":
      return { dotClass: "bg-green-700", labelClass: "text-green-700" };
    default:
      return { dotClass: "bg-gray-500", labelClass: "text-gray-900" };
  }
}
