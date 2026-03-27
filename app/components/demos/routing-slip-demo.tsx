"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SlipStage =
  | "inventory"
  | "payment"
  | "packaging"
  | "shipping"
  | "notification";

type SlipEvent =
  | { type: "stage_start"; stage: SlipStage; index: number }
  | {
      type: "stage_complete";
      stage: SlipStage;
      index: number;
      message: string;
      durationMs: number;
    }
  | { type: "done"; totalMs: number; stageCount: number };

type StageState = {
  id: SlipStage;
  label: string;
  status: "pending" | "running" | "done";
  message: string;
};

const STAGES: Array<{ id: SlipStage; label: string }> = [
  { id: "inventory", label: "Inventory" },
  { id: "payment", label: "Payment" },
  { id: "packaging", label: "Packaging" },
  { id: "shipping", label: "Shipping" },
  { id: "notification", label: "Notification" },
];

const DIGITAL_STAGES: SlipStage[] = ["inventory", "payment", "notification"];

function parseEvent(chunk: string): SlipEvent | null {
  const payload = chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as SlipEvent;
  } catch {
    return null;
  }
}

function badgeClass(status: StageState["status"]) {
  if (status === "done") return "bg-green-700/15 text-green-700";
  if (status === "running") return "bg-amber-700/15 text-amber-700";
  return "bg-gray-500/10 text-gray-700";
}

export function RoutingSlipDemo() {
  const [orderType, setOrderType] = useState<"standard" | "digital">("standard");
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [totalMs, setTotalMs] = useState<number | null>(null);
  const [stages, setStages] = useState<StageState[]>([]);
  const [events, setEvents] = useState<string[]>([
    "Choose a routing plan and start a run.",
  ]);
  const abortRef = useRef<AbortController | null>(null);

  const activeStages = useMemo(
    () => (orderType === "digital" ? DIGITAL_STAGES : STAGES.map((stage) => stage.id)),
    [orderType],
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  async function connectToStream(nextRunId: string, signal: AbortSignal) {
    const response = await fetch(`/api/readable/${nextRunId}`, { signal });
    if (!response.ok || !response.body) {
      throw new Error("Failed to connect to readable stream");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.replaceAll("\r\n", "\n").split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const event = parseEvent(part);
        if (!event) continue;

        if (event.type === "stage_start") {
          setStages((current) =>
            current.map((stage, index) =>
              index === event.index ? { ...stage, status: "running" } : stage,
            ),
          );
          setEvents((current) => [...current, `Started ${event.stage}`]);
        }

        if (event.type === "stage_complete") {
          setStages((current) =>
            current.map((stage, index) =>
              index === event.index
                ? { ...stage, status: "done", message: event.message }
                : stage,
            ),
          );
          setEvents((current) => [
            ...current,
            `${event.stage} completed in ${event.durationMs}ms`,
          ]);
        }

        if (event.type === "done") {
          setStatus("done");
          setTotalMs(event.totalMs);
          setEvents((current) => [
            ...current,
            `Routing slip finished across ${event.stageCount} stages`,
          ]);
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
    setTotalMs(null);
    setEvents(["Submitting order to routing slip workflow."]);
    setStages(
      activeStages.map((stageId) => {
        const stage = STAGES.find((entry) => entry.id === stageId)!;
        return { id: stage.id, label: stage.label, status: "pending", message: "" };
      }),
    );

    const orderId = `ORD-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    try {
      const response = await fetch("/api/routing-slip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, slip: activeStages }),
        signal: abortRef.current.signal,
      });

      const payload = (await response.json()) as
        | { ok: true; runId: string }
        | { error?: { message?: string } };

      if (!response.ok || !("runId" in payload)) {
        throw new Error(
          ("error" in payload ? payload.error?.message : undefined) ??
            "Failed to start routing slip",
        );
      }

      setRunId(payload.runId);
      setEvents((current) => [...current, `Run ${payload.runId} started for ${orderId}`]);
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
          <p className="text-sm font-medium text-gray-500">Routing Slip</p>
          <h2 className="text-xl font-semibold text-gray-950">Stage-by-stage order handoff</h2>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            value={orderType}
            onChange={(event) => setOrderType(event.target.value as "standard" | "digital")}
            disabled={status === "running"}
          >
            <option value="standard">Standard order</option>
            <option value="digital">Digital order</option>
          </select>
          <button
            className="rounded-md bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={startRun}
            disabled={status === "running"}
          >
            {status === "running" ? "Running..." : "Start Run"}
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {stages.map((stage) => (
          <article key={stage.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-gray-900">{stage.label}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs ${badgeClass(stage.status)}`}>
                {stage.status}
              </span>
            </div>
            <p className="mt-3 text-xs text-gray-600">
              {stage.message || "Waiting for the workflow to reach this stage."}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-gray-900">Execution Log</p>
            <p className="text-xs text-gray-500">{runId ? `run ${runId}` : "idle"}</p>
          </div>
          <div className="mt-3 space-y-2 text-sm text-gray-700">
            {events.map((event, index) => (
              <p key={`${event}-${index}`}>{event}</p>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-900">Summary</p>
          <dl className="mt-3 space-y-2 text-sm text-gray-700">
            <div className="flex justify-between gap-4">
              <dt>Status</dt>
              <dd>{status}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Selected stages</dt>
              <dd>{activeStages.length}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Total duration</dt>
              <dd>{totalMs ? `${totalMs}ms` : "Pending"}</dd>
            </div>
          </dl>
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
