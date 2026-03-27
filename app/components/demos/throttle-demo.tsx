"use client";

import { useEffect, useRef, useState } from "react";

type ThrottleEvent =
  | { type: "config"; capacity: number; refillRate: number; requestCount: number }
  | { type: "request_received"; requestId: string; position: number }
  | { type: "token_check"; requestId: string; tokensAvailable: number }
  | { type: "request_accepted"; requestId: string; tokensRemaining: number }
  | { type: "request_rejected"; requestId: string; retryAfterMs: number }
  | { type: "token_refilled"; tokensAvailable: number }
  | { type: "done"; accepted: number; rejected: number; total: number };

type RequestState = {
  id: string;
  label: string;
  status: "pending" | "checking" | "accepted" | "rejected";
  detail: string;
};

const DEFAULT_REQUESTS: RequestState[] = [
  { id: "req-1", label: "Search request", status: "pending", detail: "" },
  { id: "req-2", label: "Export request", status: "pending", detail: "" },
  { id: "req-3", label: "Webhook request", status: "pending", detail: "" },
  { id: "req-4", label: "Notification request", status: "pending", detail: "" },
  { id: "req-5", label: "Billing request", status: "pending", detail: "" },
];

function parseEvent(chunk: string): ThrottleEvent | null {
  const payload = chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;
  try {
    return JSON.parse(payload) as ThrottleEvent;
  } catch {
    return null;
  }
}

function badgeClass(status: RequestState["status"]) {
  if (status === "accepted") return "bg-green-700/15 text-green-700";
  if (status === "rejected") return "bg-red-700/15 text-red-700";
  if (status === "checking") return "bg-amber-700/15 text-amber-700";
  return "bg-gray-500/10 text-gray-700";
}

export function ThrottleDemo() {
  const [capacity, setCapacity] = useState(3);
  const [refillRate, setRefillRate] = useState(3);
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const [tokens, setTokens] = useState<number | null>(null);
  const [summary, setSummary] = useState<{ accepted: number; rejected: number; total: number } | null>(null);
  const [requests, setRequests] = useState<RequestState[]>(DEFAULT_REQUESTS);
  const [events, setEvents] = useState<string[]>(["Start a run to see which requests get capacity."]);
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

        if (event.type === "config") {
          setTokens(event.capacity);
          setEvents((current) => [
            ...current,
            `Bucket configured: capacity ${event.capacity}, refill every ${event.refillRate} requests`,
          ]);
        }

        if (event.type === "request_received") {
          setRequests((current) =>
            current.map((request) =>
              request.id === event.requestId
                ? { ...request, status: "checking", detail: `Position ${event.position}` }
                : request,
            ),
          );
        }

        if (event.type === "token_check") {
          setTokens(event.tokensAvailable);
        }

        if (event.type === "request_accepted") {
          setRequests((current) =>
            current.map((request) =>
              request.id === event.requestId
                ? { ...request, status: "accepted", detail: `Tokens left ${event.tokensRemaining}` }
                : request,
            ),
          );
          setTokens(event.tokensRemaining);
        }

        if (event.type === "request_rejected") {
          setRequests((current) =>
            current.map((request) =>
              request.id === event.requestId
                ? { ...request, status: "rejected", detail: `Retry after ${event.retryAfterMs}ms` }
                : request,
            ),
          );
        }

        if (event.type === "token_refilled") {
          setTokens(event.tokensAvailable);
          setEvents((current) => [...current, `Token refilled to ${event.tokensAvailable}`]);
        }

        if (event.type === "done") {
          setStatus("done");
          setSummary(event);
        }
      }
    }
  }

  async function startRun() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setRunId(null);
    setStatus("running");
    setTokens(null);
    setSummary(null);
    setError(null);
    setRequests(DEFAULT_REQUESTS);
    setEvents(["Starting throttle evaluation for queued requests."]);

    try {
      const response = await fetch("/api/throttle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          capacity,
          refillRate,
          requests: DEFAULT_REQUESTS.map((request) => ({
            id: request.id,
            label: request.label,
          })),
        }),
        signal: abortRef.current.signal,
      });

      const payload = (await response.json()) as
        | { ok: true; runId: string }
        | { error?: { message?: string } };

      if (!response.ok || !("runId" in payload)) {
        throw new Error(
          ("error" in payload ? payload.error?.message : undefined) ??
            "Failed to start throttle demo",
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
          <p className="text-sm font-medium text-gray-500">Throttle</p>
          <h2 className="text-xl font-semibold text-gray-950">Apply token-bucket admission control</h2>
        </div>
        <button
          className="rounded-md bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={startRun}
          disabled={status === "running"}
        >
          {status === "running" ? "Running..." : "Start Run"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm text-gray-700">
          Capacity
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            type="number"
            min={1}
            value={capacity}
            onChange={(event) => setCapacity(Number(event.target.value))}
            disabled={status === "running"}
          />
        </label>
        <label className="text-sm text-gray-700">
          Refill rate
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            type="number"
            min={1}
            value={refillRate}
            onChange={(event) => setRefillRate(Number(event.target.value))}
            disabled={status === "running"}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {requests.map((request) => (
          <article key={request.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-gray-900">{request.label}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs ${badgeClass(request.status)}`}>
                {request.status}
              </span>
            </div>
            <p className="mt-3 text-xs text-gray-600">
              {request.detail || "Waiting in queue"}
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
              <dt>Tokens available</dt>
              <dd>{tokens ?? "Pending"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Outcome</dt>
              <dd>
                {summary
                  ? `${summary.accepted} accepted / ${summary.rejected} rejected`
                  : "Pending"}
              </dd>
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
