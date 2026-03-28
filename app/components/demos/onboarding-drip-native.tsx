// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  CAMPAIGN_COMPLETE_VIRTUAL_MS,
  CAMPAIGN_SEGMENTS,
  DAY_MS,
  STEP_START_TIMES_MS,
  formatVirtualClock,
} from "@/onboarding-drip/app/components/onboarding-drip-demo-state";
import { EMAIL_TEMPLATES } from "@/onboarding-drip/app/components/email-templates";
import { OnboardingCodeWorkbench, SEND_CHECK_COLORS, SEND_BG_COLORS } from "@/onboarding-drip/app/components/onboarding-code-workbench";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type DripEvent =
  | { type: "email_sending"; day: number; label: string }
  | { type: "email_sent"; day: number; label: string }
  | { type: "sleeping"; duration: string; fromDay: number; toDay: number }
  | { type: "done" };

type DemoPhase = "idle" | "running" | "complete" | "error";

type StepStatus = "sent" | "scheduled" | "sending";

type TimelineStep = {
  day: number;
  label: string;
  status: StepStatus;
};

type SleepState = {
  isSleeping: true;
  durationLabel: string;
  wakeDay: number;
} | {
  isSleeping: false;
};

type CodeProps = {
  workflowCode: string;
  workflowLinesHtml: string[];
  stepCodes: string[];
  stepLinesHtml: string[][];
  stepSendLines: Record<number, number[]>;
  stepSleepLines: Record<number, number[]>;
};

/* ------------------------------------------------------------------ */
/*  SSE helpers                                                        */
/* ------------------------------------------------------------------ */

function parseSseData(rawChunk: string): string {
  return rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
}

function parseDripEvent(rawChunk: string): DripEvent | null {
  const payload = parseSseData(rawChunk);
  if (!payload) return null;
  try {
    const parsed = JSON.parse(payload);
    if (parsed && typeof parsed === "object" && typeof parsed.type === "string") {
      return parsed as DripEvent;
    }
    return null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Day → step index mapping                                           */
/* ------------------------------------------------------------------ */

const DAY_TO_STEP: Record<number, number> = { 0: 0, 1: 1, 3: 2, 7: 3 };

/* ------------------------------------------------------------------ */
/*  Virtual time targets (for progress bar animation only)             */
/* ------------------------------------------------------------------ */

const SEND_DURATION_MS = 8_640_000; // 0.1d in virtual ms

function virtualTimeForEmailSending(day: number): number {
  return day * DAY_MS;
}

function virtualTimeForEmailSent(day: number): number {
  return day * DAY_MS + SEND_DURATION_MS;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const REQUEST_FAILED_MESSAGE = "Request failed";
const TICK_INTERVAL_MS = 50;
const VIRTUAL_STEP_MS = 500_000; // how much virtual time to advance per tick during animation

function extractErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") return REQUEST_FAILED_MESSAGE;
  const p = payload as { error?: unknown; message?: unknown };
  if (typeof p.error === "string") return p.error;
  if (p.error && typeof p.error === "object") {
    const e = p.error as { message?: unknown };
    if (typeof e.message === "string") return e.message;
  }
  if (typeof p.message === "string") return p.message;
  return REQUEST_FAILED_MESSAGE;
}

const STEP_COLORS = ["bg-green-700", "bg-blue-700", "bg-violet-700", "bg-amber-700"] as const;
const SEND_TAB_BORDER_COLORS = [
  "border-red-700/50",
  "border-cyan-700/50",
  "border-amber-700/50",
  "border-violet-700/50",
] as const;

/* ------------------------------------------------------------------ */
/*  Initial step state from definitions                                */
/* ------------------------------------------------------------------ */

const INITIAL_STEPS: TimelineStep[] = [
  { day: 0, label: "Welcome Email", status: "scheduled" },
  { day: 1, label: "Getting Started Tips", status: "scheduled" },
  { day: 3, label: "Feature Highlights", status: "scheduled" },
  { day: 7, label: "Follow-up & Feedback", status: "scheduled" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function OnboardingDripDemoClient({
  workflowCode,
  workflowLinesHtml,
  stepCodes,
  stepLinesHtml,
  stepSendLines,
  stepSleepLines,
}: CodeProps) {
  const [email, setEmail] = useState("user@example.com");
  const [phase, setPhase] = useState<DemoPhase>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [activeTab, setActiveTab] = useState(0);
  const [tabManuallySelected, setTabManuallySelected] = useState(false);

  // Progress bar animation (display only)
  const [virtualTimeMs, setVirtualTimeMs] = useState(0);
  const [targetVirtualTimeMs, setTargetVirtualTimeMs] = useState(0);

  // Event-driven step state
  const [timelineSteps, setTimelineSteps] = useState<TimelineStep[]>(INITIAL_STEPS);
  const [sleepState, setSleepState] = useState<SleepState>({ isSleeping: false });

  const abortRef = useRef<AbortController | null>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const tabButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  /* ---------------------------------------------------------------- */
  /*  Smooth animation: tick virtualTimeMs toward target (display)    */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (phase !== "running" && phase !== "complete") return;
    if (virtualTimeMs >= targetVirtualTimeMs) return;

    const interval = window.setInterval(() => {
      setVirtualTimeMs((prev) => {
        const next = Math.min(prev + VIRTUAL_STEP_MS, targetVirtualTimeMs);
        return next;
      });
    }, TICK_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [phase, virtualTimeMs, targetVirtualTimeMs]);

  /* ---------------------------------------------------------------- */
  /*  Derived state                                                    */
  /* ---------------------------------------------------------------- */

  const isActive = phase === "running" || phase === "complete";

  const currentSegmentIndex = useMemo(() => {
    if (!isActive) return -1;
    return CAMPAIGN_SEGMENTS.findIndex((s) => virtualTimeMs >= s.startMs && virtualTimeMs < s.endMs);
  }, [isActive, virtualTimeMs]);

  const highlightLines = useMemo(() => {
    if (!isActive) return [];
    if (tabManuallySelected) return stepSendLines[activeTab] ?? [];
    if (currentSegmentIndex < 0) return [];
    return stepSleepLines[currentSegmentIndex] ?? [];
  }, [activeTab, currentSegmentIndex, isActive, stepSendLines, stepSleepLines, tabManuallySelected]);

  const highlightColorIndex = tabManuallySelected ? activeTab : (currentSegmentIndex >= 0 ? currentSegmentIndex : 0);

  const gutterMarks = useMemo(() => {
    const marks: Record<number, number> = {};
    for (let i = 0; i < STEP_START_TIMES_MS.length; i++) {
      for (const line of stepSendLines[i] ?? []) marks[line] = i;
    }
    return marks;
  }, [stepSendLines]);

  const activeSendSteps = useMemo(() => {
    const active = new Set<number>();
    if (!isActive) return active;
    for (let i = 0; i < timelineSteps.length; i++) {
      if (timelineSteps[i].status === "sent" || timelineSteps[i].status === "sending") {
        active.add(i);
      }
    }
    return active;
  }, [isActive, timelineSteps]);

  /* ---------------------------------------------------------------- */
  /*  Auto-advance tab to latest sent email                            */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (timelineSteps.length === 0 || tabManuallySelected) return;
    let latestSentIndex = -1;
    for (let i = timelineSteps.length - 1; i >= 0; i--) {
      if (timelineSteps[i].status === "sent" || timelineSteps[i].status === "sending") {
        latestSentIndex = i;
        break;
      }
    }
    if (latestSentIndex >= 0) setActiveTab(latestSentIndex);
  }, [timelineSteps, tabManuallySelected]);

  /* ---------------------------------------------------------------- */
  /*  Apply SSE events → step state + progress bar target              */
  /* ---------------------------------------------------------------- */

  const applyEvent = useCallback((event: DripEvent) => {
    switch (event.type) {
      case "email_sending": {
        const stepIndex = DAY_TO_STEP[event.day];
        if (stepIndex !== undefined) {
          setTimelineSteps((prev) =>
            prev.map((step, i) => (i === stepIndex ? { ...step, status: "sending" as const } : step))
          );
          setSleepState({ isSleeping: false });
        }
        // Progress bar animation
        const target = virtualTimeForEmailSending(event.day);
        setTargetVirtualTimeMs((prev) => Math.max(prev, target));
        break;
      }
      case "email_sent": {
        const stepIndex = DAY_TO_STEP[event.day];
        if (stepIndex !== undefined) {
          setTimelineSteps((prev) =>
            prev.map((step, i) => (i === stepIndex ? { ...step, status: "sent" as const } : step))
          );
        }
        // Progress bar animation
        const target = virtualTimeForEmailSent(event.day);
        setTargetVirtualTimeMs((prev) => Math.max(prev, target));
        break;
      }
      case "sleeping": {
        setSleepState({
          isSleeping: true,
          durationLabel: event.duration,
          wakeDay: event.toDay,
        });
        // Animate progress bar toward the wake day
        const target = event.toDay * DAY_MS;
        setTargetVirtualTimeMs((prev) => Math.max(prev, target));
        break;
      }
      case "done": {
        setSleepState({ isSleeping: false });
        setTargetVirtualTimeMs(CAMPAIGN_COMPLETE_VIRTUAL_MS);
        setPhase("complete");
        break;
      }
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /*  SSE stream connection                                            */
  /* ---------------------------------------------------------------- */

  const connectToReadable = useCallback(async (runId: string, signal: AbortSignal) => {
    try {
      const response = await fetch(`/api/readable/${encodeURIComponent(runId)}`, {
        cache: "no-store",
        signal,
      });
      if (!response.ok || !response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const normalized = buffer.replaceAll("\r\n", "\n");
        const chunks = normalized.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const event = parseDripEvent(chunk);
          if (!event) continue;
          applyEvent(event);
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        const event = parseDripEvent(buffer);
        if (event) applyEvent(event);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
    }
  }, [applyEvent]);

  /* ---------------------------------------------------------------- */
  /*  Start campaign                                                   */
  /* ---------------------------------------------------------------- */

  const startCampaign = useCallback(async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return;

    setErrorMessage("");
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
        signal,
      });

      if (signal.aborted) return;

      if (!response.ok) {
        let payload: unknown = null;
        try { payload = await response.json(); } catch { payload = null; }
        if (signal.aborted) return;
        setErrorMessage(extractErrorMessage(payload));
        setPhase("error");
        return;
      }

      const payload = await response.json();
      if (signal.aborted) return;

      setVirtualTimeMs(0);
      setTargetVirtualTimeMs(0);
      setTimelineSteps(INITIAL_STEPS.map((s) => ({ ...s })));
      setSleepState({ isSleeping: false });
      setPhase("running");
      setActiveTab(0);
      setTabManuallySelected(false);

      // Connect to SSE stream
      connectToReadable(payload.runId, signal);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setErrorMessage("Failed to connect to server");
      setPhase("error");
    }
  }, [email, connectToReadable]);

  /* ---------------------------------------------------------------- */
  /*  Reset                                                            */
  /* ---------------------------------------------------------------- */

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setErrorMessage("");
    setPhase("idle");
    setActiveTab(0);
    setTabManuallySelected(false);
    setVirtualTimeMs(0);
    setTargetVirtualTimeMs(0);
    setTimelineSteps(INITIAL_STEPS.map((s) => ({ ...s })));
    setSleepState({ isSleeping: false });
    setTimeout(() => startButtonRef.current?.focus(), 0);
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Cleanup on unmount                                               */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Tab keyboard navigation                                          */
  /* ---------------------------------------------------------------- */

  const isRunning = phase === "running";

  const focusTabByIndex = useCallback((index: number) => {
    const totalTabs = EMAIL_TEMPLATES.length;
    const nextIndex = (index + totalTabs) % totalTabs;
    setActiveTab(nextIndex);
    setTabManuallySelected(true);
    tabButtonRefs.current[nextIndex]?.focus();
  }, []);

  const handleTabListKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const focusedTab = target.closest("button[role='tab']");
    if (!focusedTab) return;
    const currentIndex = tabButtonRefs.current.findIndex((button) => button === focusedTab);
    if (currentIndex < 0) return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    focusTabByIndex(currentIndex + direction);
  }, [focusTabByIndex]);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-4 rounded-lg border border-gray-400 bg-background-200 p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-flex h-2 w-2 rounded-full bg-green-700" />
        <span className="text-xs font-medium uppercase tracking-wider text-gray-900">Interactive Demo</span>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor="demo-email" className="sr-only">
          Email address
        </label>
        <input
          id="demo-email"
          type="email"
          placeholder="user@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isRunning}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !isRunning) startCampaign();
          }}
          className="w-full flex-1 rounded-md border border-gray-400 bg-background-100 px-3 py-2 font-mono text-sm text-gray-1000 placeholder:text-gray-500 transition-colors focus:border-gray-300 focus:outline-none disabled:opacity-50"
        />
        {phase === "complete" ? (
          <button
            onClick={handleReset}
            className="cursor-pointer rounded-md border border-gray-400 px-4 py-2 text-sm text-gray-1000 transition-colors hover:border-gray-300 hover:bg-background-200"
            type="button"
          >
            Reset
          </button>
        ) : (
          <button
            ref={startButtonRef}
            onClick={startCampaign}
            disabled={!email.trim() || isRunning}
            className="cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
          >
            {isRunning ? "Running..." : "Start Campaign"}
          </button>
        )}
      </div>

      {phase === "error" && (
        <div className="mb-4 rounded-lg border border-red-700/40 bg-red-700/10 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="rounded-md border border-gray-400 bg-background-100 px-3 py-2">
        <div className="mb-2 flex items-center justify-between text-xs text-gray-900">
          <span className="font-mono" role="status" aria-live="polite">
            {sleepState.isSleeping
              ? `sleep("${sleepState.durationLabel}") in progress`
              : phase === "idle"
                ? "Waiting to start..."
                : phase === "complete"
                  ? "Campaign complete"
                  : "Running step..."}
          </span>
          <span className="font-mono">
            {isActive ? formatVirtualClock(virtualTimeMs) : "Day 0 — Day 7"}
          </span>
        </div>
        <div className="relative pt-5 pb-1.5">
          <div className="flex h-1.5 gap-0.5">
            {CAMPAIGN_SEGMENTS.map((segment, index) => {
              const segmentDuration = segment.endMs - segment.startMs;
              const widthPercent = (segmentDuration / CAMPAIGN_COMPLETE_VIRTUAL_MS) * 100;

              let fillPercent = 0;
              if (virtualTimeMs >= segment.endMs) {
                fillPercent = 100;
              } else if (virtualTimeMs > segment.startMs) {
                fillPercent = ((virtualTimeMs - segment.startMs) / segmentDuration) * 100;
              }

              return (
                <div
                  key={index}
                  className="relative h-full"
                  style={{ width: `${widthPercent}%` }}
                >
                  <div className="h-full overflow-hidden rounded-full bg-gray-500/30">
                    <div
                      className={`h-full ${STEP_COLORS[index]} transition-all duration-300`}
                      style={{ width: `${fillPercent}%` }}
                    />
                  </div>
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`absolute left-0 bottom-full z-20 h-4 w-4 -translate-x-1/2 translate-y-1/2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] transition-opacity duration-500 ${SEND_CHECK_COLORS[index]} ${isActive && virtualTimeMs >= segment.startMs ? "opacity-100" : "opacity-20"}`}
                    aria-hidden="true"
                  >
                    <polyline points="3,8.5 7,12.5 14,4.5" />
                  </svg>
                  {index === CAMPAIGN_SEGMENTS.length - 1 && (
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`absolute right-0 bottom-full z-20 h-4 w-4 translate-x-1/2 translate-y-1/2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] transition-opacity duration-500 ${SEND_CHECK_COLORS[3]} ${isActive && virtualTimeMs >= STEP_START_TIMES_MS[3] ? "opacity-100" : "opacity-20"}`}
                      aria-hidden="true"
                    >
                      <polyline points="3,8.5 7,12.5 14,4.5" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <OnboardingCodeWorkbench
        workflowCode={workflowCode}
        workflowLinesHtml={workflowLinesHtml}
        stepCodes={stepCodes}
        stepLinesHtml={stepLinesHtml}
        activeStepIndex={activeTab}
        highlightLines={highlightLines}
        highlightColorIndex={highlightColorIndex}
        gutterMarks={gutterMarks}
        activeSendSteps={activeSendSteps}
      />

      <div>
        <div role="tablist" className="flex border-b border-gray-400" onKeyDown={handleTabListKeyDown}>
          {EMAIL_TEMPLATES.map((template, index) => {
            const step = timelineSteps[index];
            const status = step?.status ?? "scheduled";
            return (
              <button
                key={template.id}
                ref={(element) => {
                  tabButtonRefs.current[index] = element;
                }}
                role="tab"
                type="button"
                tabIndex={activeTab === index ? 0 : -1}
                aria-selected={activeTab === index}
                onClick={() => { setActiveTab(index); setTabManuallySelected(true); }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === index
                    ? `border-b-2 ${SEND_TAB_BORDER_COLORS[index]} text-gray-1000`
                    : "text-gray-400 hover:text-gray-900"
                }`}
              >
                <span
                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white transition-all duration-300 ${
                    status === "sent"
                      ? SEND_BG_COLORS[index]
                      : status === "sending"
                        ? `${SEND_BG_COLORS[index]} animate-pulse`
                        : "bg-gray-500"
                  }`}
                >
                  {status === "sent" ? (
                    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]" aria-hidden="true">
                      <path
                        fillRule="evenodd"
                        d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"
                      />
                    </svg>
                  ) : (
                    template.day
                  )}
                </span>
                <span className="hidden sm:inline">{template.label}</span>
                <span className="sm:hidden">Day {template.day}</span>
              </button>
            );
          })}
        </div>
        {EMAIL_TEMPLATES[activeTab] && (
          <div className="rounded-b-lg border border-t-0 border-gray-400 bg-background-100 p-4">
            <div className="mb-3 flex items-center justify-between text-xs text-gray-900">
              <span className="font-mono">team@useworkflow.dev</span>
              <span>{EMAIL_TEMPLATES[activeTab].scheduleLabel}</span>
            </div>
            <h4 className="mb-1 text-sm font-semibold text-gray-1000">{EMAIL_TEMPLATES[activeTab].subject}</h4>
            <p className="mb-3 text-xs text-gray-900">{EMAIL_TEMPLATES[activeTab].previewText}</p>
            <div className="max-h-48 overflow-auto text-sm leading-6 text-gray-1000 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-500/40 [&_a]:text-blue-700 [&_a]:underline [&_code]:rounded [&_code]:bg-gray-700 [&_code]:px-1 [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_li]:text-gray-1000 [&_ol_li]:list-decimal [&_p]:mb-2 [&_ul]:mb-2 [&_ul]:space-y-1">
              {/* Static HTML from email-templates.ts — no user input */}
              <div dangerouslySetInnerHTML={{ __html: EMAIL_TEMPLATES[activeTab].bodyHtml }} />
            </div>
            {(timelineSteps[activeTab]?.status ?? "scheduled") === "scheduled" && (
              <p className="mt-3 text-xs text-gray-400 italic">This email has not been sent yet.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const demoProps = {
  workflowCode: "",
  workflowLinesHtml: [],
  stepCodes: [],
  stepLinesHtml: [],
  stepSendLines: {},
  stepSleepLines: {},
} as unknown as Parameters<typeof OnboardingDripDemoClient>[0];

export default function OnboardingDripNativeDemo() {
  return <OnboardingDripDemoClient {...demoProps} />;
}
