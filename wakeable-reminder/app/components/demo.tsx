"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { WakeableReminderCodeWorkbench } from "./wakeable-reminder-code-workbench";

/* ── Types ───────────────────────────────────────────────── */

type LifecycleState =
  | "idle"
  | "sleeping"
  | "snoozed"
  | "sending"
  | "sent"
  | "cancelled";

type HighlightTone = "amber" | "cyan" | "green" | "red" | "blue";
type GutterMarkKind = "success" | "fail";

type WorkflowLineMap = {
  sleepAndRace: number[];
  cancelReturn: number[];
  snoozeBlock: number[];
  sendNowFallthrough: number[];
  sendEmail: number[];
  sentReturn: number[];
  createHook: number[];
};

type StepLineMap = {
  body: number[];
};

type WakeableReminderDemoProps = {
  workflowCode: string;
  workflowHtmlLines: string[];
  workflowLineMap: WorkflowLineMap;
  stepCode: string;
  stepHtmlLines: string[];
  stepLineMap: StepLineMap;
};

/* ── Event types from workflow getWritable() ───────────── */

type ReminderEvent =
  | { type: "scheduled"; userId: string; sendAtMs: number; token: string; metadata: { userId: string; initialSendAt: string; channel: string } }
  | { type: "sleeping"; sendAtMs: number }
  | { type: "action_received"; action: { type: string; seconds?: number } }
  | { type: "snoozed"; sendAtMs: number }
  | { type: "woke" }
  | { type: "sending" }
  | { type: "sent" }
  | { type: "cancelled" };

/* ── Accumulator for SSE events ─────────────────────────── */

interface ReminderLogEvent {
  atMs: number;
  kind: string;
  message: string;
}

interface ReminderAccumulator {
  status: LifecycleState;
  sendAtMs: number;
  token: string;
  metadata: { userId: string; initialSendAt: string; channel: string };
  events: ReminderLogEvent[];
  startedAtMs: number;
}

function createAccumulator(): ReminderAccumulator {
  return {
    status: "sleeping",
    sendAtMs: 0,
    token: "",
    metadata: { userId: "", initialSendAt: "", channel: "" },
    events: [],
    startedAtMs: Date.now(),
  };
}

function applyEvent(acc: ReminderAccumulator, event: ReminderEvent): ReminderAccumulator {
  const elapsed = Date.now() - acc.startedAtMs;

  switch (event.type) {
    case "scheduled":
      return {
        ...acc,
        sendAtMs: event.sendAtMs,
        token: event.token,
        metadata: event.metadata,
        events: [
          ...acc.events,
          { atMs: elapsed, kind: "scheduled", message: `Reminder scheduled for ${new Date(event.sendAtMs).toLocaleTimeString()}` },
        ],
      };

    case "sleeping":
      return {
        ...acc,
        status: "sleeping",
        sendAtMs: event.sendAtMs,
        events: [
          ...acc.events,
          { atMs: elapsed, kind: "sleeping", message: `sleep(Date) — durable pause until ${new Date(event.sendAtMs).toISOString()}` },
        ],
      };

    case "action_received":
      return {
        ...acc,
        events: [
          ...acc.events,
          { atMs: elapsed, kind: "action_received", message: `Hook resolved with { type: "${event.action.type}"${event.action.seconds ? `, seconds: ${event.action.seconds}` : ""} }` },
        ],
      };

    case "snoozed":
      return {
        ...acc,
        status: "snoozed",
        sendAtMs: event.sendAtMs,
        events: [
          ...acc.events,
          { atMs: elapsed, kind: "snoozed", message: `Snoozed — new send time: ${new Date(event.sendAtMs).toISOString()}` },
        ],
      };

    case "woke":
      return {
        ...acc,
        events: [
          ...acc.events,
          { atMs: elapsed, kind: "woke", message: "send_now — sleep interrupted, sending immediately" },
        ],
      };

    case "sending":
      return {
        ...acc,
        status: "sending",
        events: [
          ...acc.events,
          { atMs: elapsed, kind: "sending", message: "sendReminderEmail() step executing..." },
        ],
      };

    case "sent":
      return {
        ...acc,
        status: "sent",
        events: [
          ...acc.events,
          { atMs: elapsed, kind: "sent", message: "Reminder email sent successfully" },
        ],
      };

    case "cancelled":
      return {
        ...acc,
        status: "cancelled",
        events: [
          ...acc.events,
          { atMs: elapsed, kind: "cancelled", message: "Reminder cancelled — workflow returned early" },
        ],
      };

    default:
      return acc;
  }
}

/* ── SSE parsing ─────────────────────────────────────────── */

function parseSseChunk(rawChunk: string): ReminderEvent | null {
  const payload = rawChunk
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trim())
    .join("\n");

  if (!payload) return null;
  try {
    return JSON.parse(payload) as ReminderEvent;
  } catch {
    return null;
  }
}

const DELAY_OPTIONS: { label: string; ms: number }[] = [
  { label: "10s", ms: 10_000 },
  { label: "30s", ms: 30_000 },
  { label: "1m", ms: 60_000 },
];

/* ── Helpers ─────────────────────────────────────────────── */

function formatCountdown(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatTimeLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString();
}

/* ── Demo Component ──────────────────────────────────────── */

export function WakeableReminderDemo({
  workflowCode,
  workflowHtmlLines,
  workflowLineMap,
  stepCode,
  stepHtmlLines,
  stepLineMap,
}: WakeableReminderDemoProps) {
  const [delayMs, setDelayMs] = useState(DELAY_OPTIONS[0].ms);
  const [lifecycle, setLifecycle] = useState<LifecycleState>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [acc, setAcc] = useState<ReminderAccumulator | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdownMs, setCountdownMs] = useState(0);

  const abortRef = useRef<AbortController | null>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const rafRef = useRef<number | null>(null);
  const accRef = useRef<ReminderAccumulator | null>(null);

  const stopCountdown = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCountdown();
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [stopCountdown]);

  // RAF-based countdown ticker
  useEffect(() => {
    if (!acc || (lifecycle !== "sleeping" && lifecycle !== "snoozed")) {
      stopCountdown();
      return;
    }

    const sendAtMs = acc.sendAtMs;

    const tick = () => {
      const remaining = Math.max(0, sendAtMs - Date.now());
      setCountdownMs(remaining);
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      stopCountdown();
    };
  }, [acc, lifecycle, stopCountdown]);

  const connectSse = useCallback(async (targetRunId: string, signal: AbortSignal) => {
    const response = await fetch(`/api/readable/${targetRunId}`, { signal });
    if (!response.ok || !response.body) {
      throw new Error(`Stream unavailable (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.replaceAll("\r\n", "\n").split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const event = parseSseChunk(chunk);
        if (!event) continue;

        accRef.current = applyEvent(accRef.current!, event);
        const snapshot = accRef.current;
        setAcc({ ...snapshot });
        setLifecycle(snapshot.status);
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      const event = parseSseChunk(buffer);
      if (event) {
        accRef.current = applyEvent(accRef.current!, event);
        const snapshot = accRef.current;
        setAcc({ ...snapshot });
        setLifecycle(snapshot.status);
      }
    }
  }, []);

  const handleStart = useCallback(async () => {
    setError(null);
    stopCountdown();
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;

    const freshAcc = createAccumulator();
    accRef.current = freshAcc;
    setAcc(freshAcc);

    try {
      const res = await fetch("/api/wakeable-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user-42", delayMs }),
        signal,
      });
      const payload = await res.json();
      if (signal.aborted) return;
      if (!res.ok) {
        setError(payload.error ?? `Start failed (${res.status})`);
        setLifecycle("idle");
        return;
      }

      setRunId(payload.runId);
      setLifecycle("sleeping");

      // Connect to SSE stream
      await connectSse(payload.runId, signal);
    } catch (err) {
      if (signal.aborted || (err instanceof Error && err.name === "AbortError")) return;
      setError(err instanceof Error ? err.message : "Failed to start reminder");
      setLifecycle("idle");
    }
  }, [connectSse, delayMs, stopCountdown]);

  const handleAction = useCallback(
    async (action: { type: string; seconds?: number }) => {
      if (!acc?.token) return;
      const controller = abortRef.current;
      if (!controller) return;

      try {
        const res = await fetch("/api/wake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: acc.token, action }),
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          setError(payload.error?.message ?? payload.error ?? `Action failed (${res.status})`);
        }
      } catch (err) {
        if (controller.signal.aborted || (err instanceof Error && err.name === "AbortError")) return;
        setError(err instanceof Error ? err.message : "Action failed");
      }
    },
    [acc?.token]
  );

  const handleWake = useCallback(async () => {
    await handleAction({ type: "send_now" });
  }, [handleAction]);

  const handleReset = useCallback(() => {
    stopCountdown();
    abortRef.current?.abort();
    abortRef.current = null;
    accRef.current = null;
    setLifecycle("idle");
    setRunId(null);
    setAcc(null);
    setError(null);
    setCountdownMs(0);
    setTimeout(() => {
      startButtonRef.current?.focus();
    }, 0);
  }, [stopCountdown]);

  const isActive =
    lifecycle === "sleeping" ||
    lifecycle === "snoozed" ||
    lifecycle === "sending";
  const isDone = lifecycle === "sent" || lifecycle === "cancelled";

  /* ── Code workbench state ─────────────────────────── */

  const codeState = useMemo(() => {
    const wfMarks: Record<number, GutterMarkKind> = {};
    const stepMarks: Record<number, GutterMarkKind> = {};

    if (!acc || lifecycle === "idle") {
      return {
        tone: "amber" as HighlightTone,
        workflowActiveLines: [] as number[],
        stepActiveLines: [] as number[],
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    const status = lifecycle;

    // Mark createHook as success once we are past idle
    for (const ln of workflowLineMap.createHook) wfMarks[ln] = "success";

    if (status === "sleeping" || status === "snoozed") {
      return {
        tone: "amber" as HighlightTone,
        workflowActiveLines: workflowLineMap.sleepAndRace,
        stepActiveLines: [] as number[],
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    if (status === "sending") {
      for (const ln of workflowLineMap.sleepAndRace) wfMarks[ln] = "success";
      for (const ln of workflowLineMap.sendEmail) wfMarks[ln] = "success";
      return {
        tone: "green" as HighlightTone,
        workflowActiveLines: workflowLineMap.sendEmail,
        stepActiveLines: stepLineMap.body,
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    if (status === "sent") {
      for (const ln of workflowLineMap.sleepAndRace) wfMarks[ln] = "success";
      for (const ln of workflowLineMap.sendEmail) wfMarks[ln] = "success";
      for (const ln of workflowLineMap.sentReturn) wfMarks[ln] = "success";
      for (const ln of stepLineMap.body) stepMarks[ln] = "success";
      return {
        tone: "green" as HighlightTone,
        workflowActiveLines: workflowLineMap.sentReturn,
        stepActiveLines: [] as number[],
        workflowGutterMarks: wfMarks,
        stepGutterMarks: stepMarks,
      };
    }

    if (status === "cancelled") {
      for (const ln of workflowLineMap.sleepAndRace) wfMarks[ln] = "success";
      for (const ln of workflowLineMap.cancelReturn) wfMarks[ln] = "fail";
      return {
        tone: "red" as HighlightTone,
        workflowActiveLines: workflowLineMap.cancelReturn,
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
  }, [acc, lifecycle, workflowLineMap, stepLineMap]);

  /* ── Phase explainer ──────────────────────────────── */

  const phaseExplainer = useMemo(() => {
    if (lifecycle === "idle") return "Waiting to schedule a reminder.";
    if (lifecycle === "sleeping")
      return "sleep(Date) in progress. The workflow is durably suspended and consuming zero compute.";
    if (lifecycle === "snoozed")
      return "Snoozed. sleep(Date) restarted with a new target time.";
    if (lifecycle === "sending")
      return "sendReminderEmail() step is executing.";
    if (lifecycle === "sent") return "Reminder email sent successfully.";
    if (lifecycle === "cancelled")
      return "Reminder cancelled. Workflow returned early.";
    return "Run is active.";
  }, [lifecycle]);

  /* ── Status badge ─────────────────────────────────── */

  const statusBadge = useMemo(() => {
    if (lifecycle === "idle") return null;
    const map: Record<
      string,
      { label: string; dotClass: string; badgeClass: string }
    > = {
      sleeping: {
        label: "Sleeping",
        dotClass: "bg-amber-700 animate-pulse",
        badgeClass: "border-amber-700/40 bg-amber-700/10 text-amber-700",
      },
      snoozed: {
        label: "Snoozed",
        dotClass: "bg-cyan-700 animate-pulse",
        badgeClass: "border-cyan-700/40 bg-cyan-700/10 text-cyan-700",
      },
      sending: {
        label: "Sending",
        dotClass: "bg-green-700 animate-pulse",
        badgeClass: "border-green-700/40 bg-green-700/10 text-green-700",
      },
      sent: {
        label: "Sent",
        dotClass: "bg-green-700",
        badgeClass: "border-green-700/40 bg-green-700/10 text-green-700",
      },
      cancelled: {
        label: "Cancelled",
        dotClass: "bg-red-700",
        badgeClass: "border-red-700/40 bg-red-700/10 text-red-700",
      },
    };
    const s = map[lifecycle] ?? {
      label: lifecycle,
      dotClass: "bg-gray-500",
      badgeClass: "border-gray-400/70 bg-background-100 text-gray-900",
    };
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold uppercase leading-none ${s.badgeClass}`}
      >
        <span className={`h-2 w-2 rounded-full ${s.dotClass}`} aria-hidden="true" />
        {s.label}
      </span>
    );
  }, [lifecycle]);

  /* ── Render ────────────────────────────────────────── */

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

      {/* Controls row */}
      <div className="rounded-lg border border-gray-400/70 bg-background-100 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            ref={startButtonRef}
            type="button"
            onClick={handleStart}
            disabled={isActive}
            className="min-h-10 cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Schedule Reminder
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
          <label className="inline-flex items-center gap-1.5 rounded-md border border-gray-400/80 bg-background-200 px-2 py-1.5">
            <span className="text-xs text-gray-900">Delay</span>
            <select
              aria-label="Reminder delay"
              value={delayMs}
              onChange={(event) =>
                setDelayMs(Number.parseInt(event.target.value, 10))
              }
              disabled={isActive}
              className="h-8 w-16 rounded border border-gray-400 bg-background-100 px-1 text-center text-sm font-mono tabular-nums text-gray-1000 transition-colors focus:border-gray-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {DELAY_OPTIONS.map((opt) => (
                <option key={opt.ms} value={opt.ms}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Main visualization */}
      <div className="rounded-lg border border-gray-400/70 bg-background-100 p-3">
        {/* Status header */}
        <div
          className="mb-2 flex flex-wrap items-center justify-between gap-2"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            {statusBadge}
            <p className="text-sm text-gray-900">{phaseExplainer}</p>
          </div>
          {runId && (
            <span className="rounded-full bg-background-200 px-2.5 py-1 text-xs font-mono text-gray-900">
              run: {runId}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:h-[220px]">
          {/* Left: Countdown + actions */}
          <div className="flex flex-col gap-2 min-h-0">
            {/* Countdown */}
            <div className="flex-1 rounded-lg border border-gray-400/60 bg-background-200 p-3 flex flex-col items-center justify-center">
              {lifecycle === "idle" ? (
                <p className="text-sm text-gray-900">
                  No reminder scheduled.
                </p>
              ) : (
                <>
                  <p
                    className={`text-4xl font-mono tabular-nums font-bold ${
                      lifecycle === "sleeping" || lifecycle === "snoozed"
                        ? "text-amber-700"
                        : lifecycle === "sending"
                          ? "text-green-700"
                          : lifecycle === "sent"
                            ? "text-green-700"
                            : lifecycle === "cancelled"
                              ? "text-red-700"
                              : "text-gray-1000"
                    }`}
                  >
                    {lifecycle === "sent"
                      ? "SENT"
                      : lifecycle === "cancelled"
                        ? "CANCELLED"
                        : lifecycle === "sending"
                          ? "SENDING..."
                          : formatCountdown(countdownMs)}
                  </p>
                  {acc && (lifecycle === "sleeping" || lifecycle === "snoozed") && (
                    <p className="text-xs text-gray-900 mt-1 font-mono">
                      Target: {formatTimeLabel(acc.sendAtMs)}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Action buttons */}
            {isActive && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleWake}
                  disabled={lifecycle === "sending"}
                  className="flex-1 min-h-8 cursor-pointer rounded-md bg-blue-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700/80 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Send Now
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void handleAction({ type: "snooze", seconds: 30 })
                  }
                  disabled={lifecycle === "sending"}
                  className="flex-1 min-h-8 cursor-pointer rounded-md border border-cyan-700/60 bg-cyan-700/10 px-3 py-1.5 text-xs font-medium text-cyan-700 transition-colors hover:bg-cyan-700/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Snooze +30s
                </button>
                <button
                  type="button"
                  onClick={() => void handleAction({ type: "cancel" })}
                  disabled={lifecycle === "sending"}
                  className="flex-1 min-h-8 cursor-pointer rounded-md border border-red-700/60 bg-red-700/10 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-700/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Token inspector */}
            {acc && acc.token && (
              <TokenInspector token={acc.token} metadata={acc.metadata} />
            )}
          </div>

          {/* Right: Event log */}
          <EventLog events={acc?.events ?? []} elapsedMs={acc ? Date.now() - acc.startedAtMs : 0} />
        </div>
      </div>

      <p className="text-center text-xs italic text-gray-900">
        sleep(Date) + createHook() + wakeUpRun() — no cron, no DB polling
      </p>

      {/* Code workbench */}
      <WakeableReminderCodeWorkbench
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

/* ── Token Inspector ─────────────────────────────────────── */

function TokenInspector({
  token,
  metadata,
}: {
  token: string;
  metadata: { userId: string; initialSendAt: string; channel: string };
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-gray-400/60 bg-background-200 px-3 py-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between text-xs text-gray-900"
      >
        <span className="font-semibold uppercase tracking-wide">
          Hook Token
        </span>
        <span className="font-mono text-gray-1000">{token}</span>
      </button>
      {expanded && (
        <div className="mt-2 rounded border border-gray-300/70 bg-background-100 p-2 text-xs font-mono text-gray-900">
          <p>
            <span className="text-gray-1000">getHookByToken</span>(
            <span className="text-green-700">&quot;{token}&quot;</span>)
          </p>
          <pre className="mt-1 whitespace-pre-wrap text-gray-900">
{`{
  userId: "${metadata.userId}",
  initialSendAt: "${metadata.initialSendAt}",
  channel: "${metadata.channel}"
}`}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ── Event Log ───────────────────────────────────────────── */

function EventLog({
  events,
  elapsedMs,
}: {
  events: ReminderLogEvent[];
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
          {(elapsedMs / 1000).toFixed(1)}s
        </p>
      </div>
      <div
        ref={scrollRef}
        className="max-h-[160px] min-h-0 flex-1 overflow-y-auto rounded border border-gray-300/70 bg-background-100 p-1"
      >
        {events.length === 0 && (
          <p className="px-1 py-0.5 text-sm text-gray-900">No events yet.</p>
        )}
        {events.map((event, index) => {
          const tone = eventTone(event.kind);
          return (
            <div
              key={`${event.kind}-${event.atMs}-${index}`}
              className="flex items-center gap-2 px-1 py-0.5 text-sm leading-5 text-gray-900"
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${tone.dotClass}`}
                aria-hidden="true"
              />
              <span
                className={`w-20 shrink-0 text-xs font-semibold uppercase ${tone.labelClass}`}
              >
                {event.kind}
              </span>
              <p className="min-w-0 flex-1 truncate text-xs">{event.message}</p>
              <span className="shrink-0 text-xs font-mono tabular-nums text-gray-900">
                +{event.atMs}ms
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function eventTone(kind: string): {
  dotClass: string;
  labelClass: string;
} {
  switch (kind) {
    case "scheduled":
      return { dotClass: "bg-blue-700", labelClass: "text-blue-700" };
    case "sleeping":
      return { dotClass: "bg-amber-700", labelClass: "text-amber-700" };
    case "action_received":
      return { dotClass: "bg-violet-700", labelClass: "text-violet-700" };
    case "snoozed":
      return { dotClass: "bg-cyan-700", labelClass: "text-cyan-700" };
    case "woke":
      return { dotClass: "bg-blue-700", labelClass: "text-blue-700" };
    case "sending":
      return { dotClass: "bg-green-700 animate-pulse", labelClass: "text-green-700" };
    case "sent":
      return { dotClass: "bg-green-700", labelClass: "text-green-700" };
    case "cancelled":
      return { dotClass: "bg-red-700", labelClass: "text-red-700" };
    default:
      return { dotClass: "bg-gray-500", labelClass: "text-gray-900" };
  }
}
