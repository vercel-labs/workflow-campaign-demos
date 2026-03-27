"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SagaEvent =
  | { type: "step_running"; step: string; label: string }
  | { type: "step_succeeded"; step: string; label: string }
  | { type: "step_failed"; step: string; label: string; error: string }
  | { type: "step_skipped"; step: string; label: string }
  | { type: "compensation_pushed"; action: string; forStep: string }
  | { type: "compensating"; action: string }
  | { type: "compensated"; action: string }
  | { type: "done"; status: "completed" | "rolled_back" };

type StepStatus =
  | "scheduled"
  | "running"
  | "done"
  | "failed"
  | "skipped"
  | "queued"
  | "compensating"
  | "compensated";

type StepState = {
  id: string;
  label: string;
  status: StepStatus;
};

const FORWARD_STEPS: StepState[] = [
  { id: "reserveSeats", label: "Reserve seats", status: "scheduled" },
  { id: "captureInvoice", label: "Capture invoice", status: "scheduled" },
  { id: "provisionSeats", label: "Provision seats", status: "scheduled" },
  { id: "sendConfirmation", label: "Send confirmation", status: "scheduled" },
];

const FAILURE_OPTIONS = [
  { value: "none", label: "No failure" },
  { value: "1", label: "Fail at step 1" },
  { value: "2", label: "Fail at step 2" },
  { value: "3", label: "Fail at step 3" },
] as const;

function parseEvent(chunk: string): SagaEvent | null {
  const payload = chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;
  try {
    return JSON.parse(payload) as SagaEvent;
  } catch {
    return null;
  }
}

function tone(status: StepStatus) {
  if (status === "done" || status === "compensated") return "bg-green-700/15 text-green-700";
  if (status === "failed") return "bg-red-700/15 text-red-700";
  if (status === "running" || status === "compensating") return "bg-amber-700/15 text-amber-700";
  if (status === "queued") return "bg-cyan-700/15 text-cyan-700";
  return "bg-gray-500/10 text-gray-700";
}

export function SagaDemo() {
  const [accountId, setAccountId] = useState("acct_acme");
  const [seats, setSeats] = useState(5);
  const [failAtStep, setFailAtStep] = useState<string>("3");
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "completed" | "rolled_back">("idle");
  const [steps, setSteps] = useState<StepState[]>(FORWARD_STEPS);
  const [compensations, setCompensations] = useState<Array<{ action: string; status: StepStatus }>>([]);
  const [events, setEvents] = useState<string[]>(["Start a run to inspect forward progress and rollback."]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const summary = useMemo(() => {
    const doneCount = steps.filter((step) => step.status === "done").length;
    return `${doneCount}/${steps.length} forward steps completed`;
  }, [steps]);

  async function connectToStream(nextRunId: string, signal: AbortSignal) {
    const response = await fetch(`/api/readable/${nextRunId}`, { signal });
    if (!response.ok || !response.body) {
      throw new Error("Failed to open readable stream");
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
        const event = parseEvent(chunk);
        if (!event) continue;

        if (event.type === "step_running") {
          setSteps((current) =>
            current.map((step) =>
              step.id === event.step ? { ...step, status: "running" } : step,
            ),
          );
          setEvents((current) => [...current, `${event.label} started`]);
        }

        if (event.type === "step_succeeded") {
          setSteps((current) =>
            current.map((step) =>
              step.id === event.step ? { ...step, status: "done" } : step,
            ),
          );
          setEvents((current) => [...current, `${event.label} succeeded`]);
        }

        if (event.type === "step_failed") {
          setSteps((current) =>
            current.map((step) =>
              step.id === event.step ? { ...step, status: "failed" } : step,
            ),
          );
          setEvents((current) => [...current, `${event.label} failed: ${event.error}`]);
        }

        if (event.type === "step_skipped") {
          setSteps((current) =>
            current.map((step) =>
              step.id === event.step ? { ...step, status: "skipped" } : step,
            ),
          );
        }

        if (event.type === "compensation_pushed") {
          setCompensations((current) => [...current, { action: event.action, status: "queued" }]);
          setEvents((current) => [...current, `Queued compensation ${event.action}`]);
        }

        if (event.type === "compensating") {
          setCompensations((current) =>
            current.map((item) =>
              item.action === event.action ? { ...item, status: "compensating" } : item,
            ),
          );
        }

        if (event.type === "compensated") {
          setCompensations((current) =>
            current.map((item) =>
              item.action === event.action ? { ...item, status: "compensated" } : item,
            ),
          );
          setEvents((current) => [...current, `${event.action} completed`]);
        }

        if (event.type === "done") {
          setStatus(event.status);
          setEvents((current) => [...current, `Saga finished with status ${event.status}`]);
        }
      }
    }
  }

  async function startRun() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setError(null);
    setRunId(null);
    setStatus("running");
    setSteps(FORWARD_STEPS);
    setCompensations([]);
    setEvents(["Starting subscription upgrade saga."]);

    try {
      const response = await fetch("/api/saga", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          seats,
          failAtStep: failAtStep === "none" ? null : Number(failAtStep),
        }),
        signal: abortRef.current.signal,
      });

      const payload = (await response.json()) as
        | { ok: true; runId: string }
        | { error?: { message?: string } };

      if (!response.ok || !("runId" in payload)) {
        throw new Error(
          ("error" in payload ? payload.error?.message : undefined) ??
            "Failed to start saga",
        );
      }

      setRunId(payload.runId);
      setEvents((current) => [...current, `Run ${payload.runId} accepted`]);
      await connectToStream(payload.runId, abortRef.current.signal);
    } catch (runError) {
      if (runError instanceof Error && runError.name === "AbortError") return;
      setStatus("idle");
      setError(runError instanceof Error ? runError.message : "Unknown error");
    }
  }

  return (
    <section className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">Saga</p>
          <h2 className="text-xl font-semibold text-gray-950">Transactional orchestration with rollback</h2>
        </div>
        <button
          className="rounded-md bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={startRun}
          disabled={status === "running"}
        >
          {status === "running" ? "Running..." : "Start Run"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="text-sm text-gray-700">
          Account ID
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            disabled={status === "running"}
          />
        </label>
        <label className="text-sm text-gray-700">
          Seats
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            type="number"
            min={1}
            value={seats}
            onChange={(event) => setSeats(Number(event.target.value))}
            disabled={status === "running"}
          />
        </label>
        <label className="text-sm text-gray-700">
          Failure mode
          <select
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            value={failAtStep}
            onChange={(event) => setFailAtStep(event.target.value)}
            disabled={status === "running"}
          >
            {FAILURE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-gray-900">Forward Steps</p>
            <p className="text-xs text-gray-500">{summary}</p>
          </div>
          <div className="mt-3 space-y-2">
            {steps.map((step) => (
              <div key={step.id} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
                <span className="text-sm text-gray-900">{step.label}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${tone(step.status)}`}>
                  {step.status}
                </span>
              </div>
            ))}
          </div>
          {compensations.length > 0 ? (
            <>
              <p className="mt-4 text-sm font-medium text-gray-900">Compensations</p>
              <div className="mt-2 space-y-2">
                {compensations.map((item, index) => (
                  <div key={`${item.action}-${index}`} className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2">
                    <span className="text-sm text-gray-900">{item.action}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${tone(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-900">Execution Log</p>
          <p className="mt-1 text-xs text-gray-500">{runId ? `run ${runId}` : "idle"}</p>
          <div className="mt-3 space-y-2 text-sm text-gray-700">
            {events.map((event, index) => (
              <p key={`${event}-${index}`}>{event}</p>
            ))}
          </div>
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
