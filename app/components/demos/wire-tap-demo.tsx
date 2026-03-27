"use client";

import { useEffect, useRef, useState } from "react";

type WireTapEvent =
  | { type: "stage_start"; stage: string }
  | { type: "tap_captured"; stage: string; snapshot: Record<string, unknown> }
  | { type: "stage_done"; stage: string; durationMs: number }
  | { type: "done"; auditCount: number; totalMs: number };

type StageState = {
  label: string;
  status: "pending" | "running" | "tapped" | "done";
  snapshot: string;
};

const DEFAULT_STAGES: Record<string, StageState> = {
  validate: { label: "Validate", status: "pending", snapshot: "" },
  enrich: { label: "Enrich", status: "pending", snapshot: "" },
  transform: { label: "Transform", status: "pending", snapshot: "" },
  deliver: { label: "Deliver", status: "pending", snapshot: "" },
};

function parseEvent(chunk: string): WireTapEvent | null {
  const payload = chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as WireTapEvent;
  } catch {
    return null;
  }
}

function badgeClass(status: StageState["status"]) {
  if (status === "done") return "bg-green-700/15 text-green-700";
  if (status === "tapped") return "bg-cyan-700/15 text-cyan-700";
  if (status === "running") return "bg-amber-700/15 text-amber-700";
  return "bg-gray-500/10 text-gray-700";
}

export function WireTapDemo() {
  const [orderId, setOrderId] = useState("ORD-7042");
  const [item, setItem] = useState("Ergonomic Keyboard");
  const [quantity, setQuantity] = useState(3);
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [auditCount, setAuditCount] = useState(0);
  const [totalMs, setTotalMs] = useState<number | null>(null);
  const [stages, setStages] = useState<Record<string, StageState>>(DEFAULT_STAGES);
  const [events, setEvents] = useState<string[]>(["Start a run to observe each tapped message snapshot."]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  async function connectToStream(nextRunId: string, signal: AbortSignal) {
    const response = await fetch(`/api/readable/${nextRunId}`, { signal });
    if (!response.ok || !response.body) {
      throw new Error("Readable stream unavailable");
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

        if (event.type === "stage_start") {
          setStages((current) => ({
            ...current,
            [event.stage]: { ...current[event.stage], status: "running" },
          }));
        }

        if (event.type === "tap_captured") {
          setAuditCount((current) => current + 1);
          setStages((current) => ({
            ...current,
            [event.stage]: {
              ...current[event.stage],
              status: "tapped",
              snapshot: JSON.stringify(event.snapshot),
            },
          }));
          setEvents((current) => [...current, `${event.stage} snapshot captured`]);
        }

        if (event.type === "stage_done") {
          setStages((current) => ({
            ...current,
            [event.stage]: { ...current[event.stage], status: "done" },
          }));
          setEvents((current) => [...current, `${event.stage} finished in ${event.durationMs}ms`]);
        }

        if (event.type === "done") {
          setStatus("done");
          setAuditCount(event.auditCount);
          setTotalMs(event.totalMs);
        }
      }
    }
  }

  async function startRun() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setRunId(null);
    setStatus("running");
    setAuditCount(0);
    setTotalMs(null);
    setStages(DEFAULT_STAGES);
    setEvents(["Starting wire tap processing pipeline."]);
    setError(null);

    try {
      const response = await fetch("/api/wire-tap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, item, quantity }),
        signal: abortRef.current.signal,
      });

      const payload = (await response.json()) as
        | { ok: true; runId: string }
        | { error?: { message?: string } };

      if (!response.ok || !("runId" in payload)) {
        throw new Error(
          ("error" in payload ? payload.error?.message : undefined) ??
            "Failed to start wire tap",
        );
      }

      setRunId(payload.runId);
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
          <p className="text-sm font-medium text-gray-500">Wire Tap</p>
          <h2 className="text-xl font-semibold text-gray-950">Observe copies of messages without altering the flow</h2>
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
          Order ID
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            disabled={status === "running"}
          />
        </label>
        <label className="text-sm text-gray-700">
          Item
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            value={item}
            onChange={(event) => setItem(event.target.value)}
            disabled={status === "running"}
          />
        </label>
        <label className="text-sm text-gray-700">
          Quantity
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            disabled={status === "running"}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {Object.entries(stages).map(([stageId, stage]) => (
          <article key={stageId} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-gray-900">{stage.label}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs ${badgeClass(stage.status)}`}>
                {stage.status}
              </span>
            </div>
            <p className="mt-3 break-all text-xs text-gray-600">
              {stage.snapshot || "No tap captured yet."}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-900">Execution Log</p>
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
              <dt>Audit taps</dt>
              <dd>{auditCount}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Total duration</dt>
              <dd>{totalMs ? `${totalMs}ms` : "Pending"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Run ID</dt>
              <dd className="truncate">{runId ?? "Pending"}</dd>
            </div>
          </dl>
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
