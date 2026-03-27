"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SplitterEvent =
  | { type: "splitting"; orderId: string; itemCount: number }
  | { type: "item_processing"; index: number; sku: string; name: string }
  | { type: "item_validated"; index: number; sku: string }
  | { type: "item_reserved"; index: number; sku: string; warehouse: string }
  | { type: "item_fulfilled"; index: number; sku: string; hookToken: string }
  | { type: "item_failed"; index: number; sku: string; error: string }
  | { type: "aggregating" }
  | { type: "done"; summary: { fulfilled: number; failed: number; total: number } };

type ItemState = {
  sku: string;
  label: string;
  warehouse: string;
  status: "pending" | "processing" | "validated" | "reserved" | "fulfilled" | "failed";
  detail: string;
};

const DEFAULT_ITEMS = [
  { sku: "SKU-CHAIR", name: "Chair", quantity: 1, warehouse: "us-east-1" },
  { sku: "SKU-LAMP", name: "Lamp", quantity: 2, warehouse: "us-west-2" },
  { sku: "SKU-DESK", name: "Desk", quantity: 1, warehouse: "eu-west-1" },
] as const;

function parseEvent(chunk: string): SplitterEvent | null {
  const payload = chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;
  try {
    return JSON.parse(payload) as SplitterEvent;
  } catch {
    return null;
  }
}

function badgeClass(status: ItemState["status"]) {
  if (status === "fulfilled") return "bg-green-700/15 text-green-700";
  if (status === "failed") return "bg-red-700/15 text-red-700";
  if (status === "processing" || status === "validated" || status === "reserved") {
    return "bg-amber-700/15 text-amber-700";
  }
  return "bg-gray-500/10 text-gray-700";
}

export function SplitterDemo() {
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [items, setItems] = useState<ItemState[]>(
    DEFAULT_ITEMS.map((item) => ({
      sku: item.sku,
      label: item.name,
      warehouse: item.warehouse,
      status: "pending",
      detail: "",
    })),
  );
  const [failIndex, setFailIndex] = useState<string>("none");
  const [events, setEvents] = useState<string[]>(["Start a run to split an order into individual line-item tracks."]);
  const [summary, setSummary] = useState<{ fulfilled: number; failed: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const failedCount = useMemo(
    () => items.filter((item) => item.status === "failed").length,
    [items],
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

        if (event.type === "item_processing") {
          setItems((current) =>
            current.map((item, index) =>
              index === event.index
                ? { ...item, status: "processing", detail: "Validating and reserving stock" }
                : item,
            ),
          );
        }

        if (event.type === "item_validated") {
          setItems((current) =>
            current.map((item, index) =>
              index === event.index
                ? { ...item, status: "validated", detail: "Validation complete" }
                : item,
            ),
          );
        }

        if (event.type === "item_reserved") {
          setItems((current) =>
            current.map((item, index) =>
              index === event.index
                ? { ...item, status: "reserved", detail: `Reserved in ${event.warehouse}` }
                : item,
            ),
          );
        }

        if (event.type === "item_fulfilled") {
          setItems((current) =>
            current.map((item, index) =>
              index === event.index
                ? { ...item, status: "fulfilled", detail: `Hook token ${event.hookToken}` }
                : item,
            ),
          );
        }

        if (event.type === "item_failed") {
          setItems((current) =>
            current.map((item, index) =>
              index === event.index
                ? { ...item, status: "failed", detail: event.error }
                : item,
            ),
          );
          setEvents((current) => [...current, `${event.sku} failed: ${event.error}`]);
        }

        if (event.type === "aggregating") {
          setEvents((current) => [...current, "Aggregating item outcomes"]);
        }

        if (event.type === "done") {
          setStatus("done");
          setSummary(event.summary);
        }
      }
    }
  }

  async function startRun() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setRunId(null);
    setStatus("running");
    setSummary(null);
    setError(null);
    setEvents(["Splitting the order into independent line-item workflows."]);
    setItems(
      DEFAULT_ITEMS.map((item) => ({
        sku: item.sku,
        label: item.name,
        warehouse: item.warehouse,
        status: "pending",
        detail: "",
      })),
    );

    try {
      const response = await fetch("/api/splitter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: "ORD-SPLIT-42",
          items: DEFAULT_ITEMS,
          failures:
            failIndex === "none"
              ? { failIndices: [] }
              : { failIndices: [Number(failIndex)] },
        }),
        signal: abortRef.current.signal,
      });

      const payload = (await response.json()) as
        | { ok: true; runId: string }
        | { error?: { message?: string } };

      if (!response.ok || !("runId" in payload)) {
        throw new Error(
          ("error" in payload ? payload.error?.message : undefined) ??
            "Failed to start splitter",
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
          <p className="text-sm font-medium text-gray-500">Splitter</p>
          <h2 className="text-xl font-semibold text-gray-950">Turn one order into parallel line-item tracks</h2>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            value={failIndex}
            onChange={(event) => setFailIndex(event.target.value)}
            disabled={status === "running"}
          >
            <option value="none">No item failure</option>
            <option value="0">Fail item 1</option>
            <option value="1">Fail item 2</option>
            <option value="2">Fail item 3</option>
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

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {items.map((item) => (
          <article key={item.sku} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-gray-900">{item.label}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs ${badgeClass(item.status)}`}>
                {item.status}
              </span>
            </div>
            <p className="mt-2 text-xs text-gray-500">{item.sku} • {item.warehouse}</p>
            <p className="mt-3 text-sm text-gray-700">
              {item.detail || "Waiting for the splitter to schedule this item."}
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
              <dt>Run ID</dt>
              <dd className="truncate">{runId ?? "Pending"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Failed items</dt>
              <dd>{failedCount}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Summary</dt>
              <dd>
                {summary
                  ? `${summary.fulfilled} fulfilled / ${summary.failed} failed`
                  : "Pending"}
              </dd>
            </div>
          </dl>
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
