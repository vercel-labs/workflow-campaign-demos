"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ProcessManagerEvent =
  | { type: "state_transition"; from: string; to: string; step: string }
  | { type: "step_started"; step: string; message: string }
  | { type: "step_completed"; step: string; message: string }
  | { type: "step_retrying"; step: string; attempt: number }
  | { type: "branch_taken"; step: string; branch: string; reason: string }
  | { type: "sleeping"; step: string; duration: string; reason: string }
  | {
      type: "done";
      orderId: string;
      finalState: string;
      summary: {
        stateTransitions: number;
        trackingId: string | null;
      };
    };

type Scenario = "happy" | "payment_fail" | "backorder";

const STEP_ORDER = [
  "initializeOrder",
  "validatePayment",
  "checkInventory",
  "recheckInventory",
  "reserveInventory",
  "shipOrder",
  "confirmDelivery",
  "completeOrder",
  "cancelOrder",
];

function parseSseChunk(rawChunk: string): ProcessManagerEvent | null {
  const payload = rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as ProcessManagerEvent;
  } catch {
    return null;
  }
}

export function ProcessManagerDemo() {
  const [scenario, setScenario] = useState<Scenario>("happy");
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [currentState, setCurrentState] = useState("received");
  const [steps, setSteps] = useState<Record<string, string>>(
    Object.fromEntries(STEP_ORDER.map((step) => [step, "pending"])),
  );
  const [transitions, setTransitions] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [finalSummary, setFinalSummary] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const appendLog = useCallback((line: string) => {
    setLog((current) => [...current, line]);
  }, []);

  const connectStream = useCallback(
    async (targetRunId: string, signal: AbortSignal) => {
      const response = await fetch(`/api/readable/${encodeURIComponent(targetRunId)}`, { signal });

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

          if (event.type === "step_started") {
            setSteps((current) => ({ ...current, [event.step]: "running" }));
            appendLog(event.message);
          }

          if (event.type === "step_completed") {
            setSteps((current) => ({ ...current, [event.step]: "done" }));
            appendLog(event.message);
          }

          if (event.type === "step_retrying") {
            appendLog(`${event.step}: retry attempt ${event.attempt}`);
          }

          if (event.type === "branch_taken") {
            appendLog(`${event.step}: branch ${event.branch} (${event.reason})`);
          }

          if (event.type === "sleeping") {
            appendLog(`${event.step}: sleeping ${event.duration}`);
          }

          if (event.type === "state_transition") {
            setCurrentState(event.to);
            setTransitions((current) => [...current, `${event.from} → ${event.to}`]);
          }

          if (event.type === "done") {
            setStatus("done");
            setCurrentState(event.finalState);
            setFinalSummary(
              `${event.finalState} • ${event.summary.stateTransitions} transitions • tracking ${event.summary.trackingId ?? "n/a"}`,
            );
            appendLog(`workflow completed for ${event.orderId}`);
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

    const orderId = `ORD-${Date.now().toString(36)}`;
    const items = ["keyboard", "mouse", "dock"];
    const simulatePaymentFail = scenario === "payment_fail";
    const simulateBackorder = scenario === "backorder";

    setRunId(null);
    setStatus("running");
    setError(null);
    setCurrentState("received");
    setTransitions([]);
    setLog([]);
    setFinalSummary(null);
    setSteps(Object.fromEntries(STEP_ORDER.map((step) => [step, "pending"])));

    try {
      const response = await fetch("/api/process-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          items,
          paymentMethod: "credit_card",
          simulatePaymentFail,
          simulateBackorder,
        }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as {
        runId?: string;
        error?: { message?: string };
      };

      if (!response.ok || !payload.runId) {
        throw new Error(payload.error?.message ?? "Failed to start process manager");
      }

      setRunId(payload.runId);
      appendLog(`workflow started for ${orderId}`);
      await connectStream(payload.runId, controller.signal);
    } catch (errorValue) {
      if (controller.signal.aborted) return;
      setStatus("error");
      setError(errorValue instanceof Error ? errorValue.message : "Unexpected process-manager error");
    }
  }, [appendLog, connectStream, scenario]);

  const completedSteps = useMemo(
    () => Object.values(steps).filter((value) => value === "done").length,
    [steps],
  );

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-gray-300 bg-background-100 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <label className="text-sm font-medium text-gray-900">
            Scenario
            <select
              className="mt-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-1000 outline-none focus:border-blue-700"
              onChange={(event) => setScenario(event.target.value as Scenario)}
              value={scenario}
            >
              <option value="happy">Happy path</option>
              <option value="payment_fail">Payment failure</option>
              <option value="backorder">Backorder wait</option>
            </select>
          </label>
          <button
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={status === "running"}
            onClick={handleStart}
            type="button"
          >
            {status === "running" ? "Running..." : "Run process"}
          </button>
        </div>
        <div className="mt-3 text-sm text-gray-900">
          <div>Run: {runId ?? "not started"}</div>
          <div>Status: {status}</div>
          <div>Current state: {currentState}</div>
          <div>Completed steps: {completedSteps}</div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {STEP_ORDER.map((step) => (
          <article key={step} className="rounded-xl border border-gray-300 bg-background-100 p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="font-semibold text-gray-1000">{step}</div>
              <div className="uppercase tracking-wide text-gray-900">{steps[step]}</div>
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <div className="rounded-xl border border-gray-300 bg-background-100 p-4">
          <h3 className="text-sm font-semibold text-gray-1000">Transitions</h3>
          <div className="mt-3 space-y-2 text-sm text-gray-900">
            {transitions.length > 0 ? transitions.map((entry, index) => <div key={`${entry}-${index}`}>{entry}</div>) : <div>No transitions yet.</div>}
          </div>
        </div>
        <div className="rounded-xl border border-gray-300 bg-background-100 p-4">
          <h3 className="text-sm font-semibold text-gray-1000">Execution log</h3>
          <div className="mt-3 space-y-2 text-sm text-gray-900">
            {log.length > 0 ? log.map((entry, index) => <div key={`${entry}-${index}`}>{entry}</div>) : <div>No events yet.</div>}
          </div>
          <div className="mt-4 text-sm text-gray-900">{finalSummary ?? " "}</div>
          <div className="mt-2 text-sm text-red-700">{error ?? " "}</div>
        </div>
      </div>
    </section>
  );
}
