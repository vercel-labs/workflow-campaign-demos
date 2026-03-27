"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type DripEvent =
  | { type: "email_sending"; day: number; label: string }
  | { type: "email_sent"; day: number; label: string }
  | { type: "sleeping"; duration: string; fromDay: number; toDay: number }
  | { type: "done" };

type DemoPhase = "idle" | "running" | "completed" | "error";
type StepStatus = "scheduled" | "sending" | "sent";

type TimelineStep = {
  day: number;
  label: string;
  status: StepStatus;
};

type LogEntry = {
  id: string;
  tone: "default" | "success" | "warning";
  text: string;
};

const INITIAL_STEPS: TimelineStep[] = [
  { day: 0, label: "Welcome Email", status: "scheduled" },
  { day: 1, label: "Getting Started Tips", status: "scheduled" },
  { day: 3, label: "Feature Highlights", status: "scheduled" },
  { day: 7, label: "Follow-up & Feedback", status: "scheduled" },
];

function parseSseChunk(rawChunk: string): DripEvent | null {
  const payload = rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as DripEvent;
  } catch {
    return null;
  }
}

function stepIndexForDay(day: number): number {
  if (day === 0) return 0;
  if (day === 1) return 1;
  if (day === 3) return 2;
  return 3;
}

function toneClass(tone: LogEntry["tone"]): string {
  if (tone === "success") return "text-green-700";
  if (tone === "warning") return "text-amber-700";
  return "text-gray-900";
}

export function OnboardingDripDemo() {
  const [email, setEmail] = useState("user@example.com");
  const [phase, setPhase] = useState<DemoPhase>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [steps, setSteps] = useState<TimelineStep[]>(INITIAL_STEPS);
  const [sleepLabel, setSleepLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const appendLog = useCallback((tone: LogEntry["tone"], text: string) => {
    setLog((current) => [
      ...current,
      { id: `${Date.now()}-${current.length}`, tone, text },
    ]);
  }, []);

  const connectStream = useCallback(
    async (targetRunId: string, signal: AbortSignal) => {
      const response = await fetch(`/api/readable/${encodeURIComponent(targetRunId)}`, {
        signal,
      });

      if (!response.ok || !response.body) {
        throw new Error("Failed to connect to workflow stream");
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

          if (event.type === "email_sending") {
            const index = stepIndexForDay(event.day);
            setSteps((current) =>
              current.map((step, idx) => ({
                ...step,
                status:
                  idx < index
                    ? "sent"
                    : idx === index
                      ? "sending"
                      : "scheduled",
              })),
            );
            setSleepLabel(null);
            appendLog("default", `Day ${event.day}: sending ${event.label}`);
          }

          if (event.type === "email_sent") {
            const index = stepIndexForDay(event.day);
            setSteps((current) =>
              current.map((step, idx) => ({
                ...step,
                status: idx <= index ? "sent" : "scheduled",
              })),
            );
            appendLog("success", `Day ${event.day}: sent ${event.label}`);
          }

          if (event.type === "sleeping") {
            setSleepLabel(`Sleeping ${event.duration} from day ${event.fromDay} to day ${event.toDay}`);
            appendLog(
              "warning",
              `Durable sleep for ${event.duration} before day ${event.toDay}`,
            );
          }

          if (event.type === "done") {
            setSleepLabel(null);
            setPhase("completed");
            appendLog("success", "Campaign completed");
          }
        }
      }
    },
    [appendLog],
  );

  const handleStart = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setPhase("running");
    setRunId(null);
    setSteps(INITIAL_STEPS);
    setSleepLabel(null);
    setError(null);
    setLog([]);

    try {
      const response = await fetch("/api/onboarding-drip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        runId?: string;
        error?: { message?: string };
      };

      if (!response.ok || !payload.runId) {
        throw new Error(payload.error?.message ?? "Failed to start onboarding workflow");
      }

      setRunId(payload.runId);
      appendLog("default", `Workflow started for ${email}`);
      await connectStream(payload.runId, controller.signal);
    } catch (errorValue) {
      if (controller.signal.aborted) return;
      setPhase("error");
      setError(
        errorValue instanceof Error ? errorValue.message : "Unexpected onboarding error",
      );
    }
  }, [appendLog, connectStream, email]);

  const sentCount = useMemo(
    () => steps.filter((step) => step.status === "sent").length,
    [steps],
  );

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-gray-300 bg-background-100 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <label className="flex-1 text-sm font-medium text-gray-900">
            Customer email
            <input
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-1000 outline-none focus:border-green-700"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="user@example.com"
            />
          </label>
          <button
            type="button"
            onClick={handleStart}
            disabled={phase === "running"}
            className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-500"
          >
            {phase === "running" ? "Running..." : "Start Campaign"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm text-gray-900">
          <span className="rounded-full border border-gray-300 px-3 py-1">
            Status: {phase}
          </span>
          <span className="rounded-full border border-gray-300 px-3 py-1">
            Sent: {sentCount}/{steps.length}
          </span>
          {runId ? (
            <span className="rounded-full border border-gray-300 px-3 py-1 font-mono text-xs">
              runId: {runId}
            </span>
          ) : null}
        </div>

        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        {sleepLabel ? <p className="mt-4 text-sm text-amber-700">{sleepLabel}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {steps.map((step) => (
          <article
            key={step.day}
            className="rounded-xl border border-gray-300 bg-background-100 p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-1000">{step.label}</h3>
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${
                  step.status === "sent"
                    ? "bg-green-700/15 text-green-700"
                    : step.status === "sending"
                      ? "bg-cyan-700/15 text-cyan-700"
                      : "bg-gray-200 text-gray-900"
                }`}
              >
                {step.status}
              </span>
            </div>
            <p className="mt-2 text-sm text-gray-900">Day {step.day}</p>
          </article>
        ))}
      </div>

      <div className="rounded-xl border border-gray-300 bg-background-100 p-5">
        <h3 className="text-sm font-semibold text-gray-1000">Execution Log</h3>
        <div className="mt-3 space-y-2 text-sm">
          {log.length === 0 ? (
            <p className="text-gray-900">No events yet.</p>
          ) : (
            log.map((entry) => (
              <p key={entry.id} className={toneClass(entry.tone)}>
                {entry.text}
              </p>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
