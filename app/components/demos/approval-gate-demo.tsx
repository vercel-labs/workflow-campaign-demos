"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ApprovalEvent =
  | { type: "request_sent"; orderId: string }
  | { type: "waiting"; orderId: string; token: string; timeoutMs: number }
  | { type: "approved"; orderId: string; approvedBy?: string; comment?: string }
  | { type: "rejected"; orderId: string; approvedBy?: string; comment?: string }
  | { type: "timeout"; orderId: string }
  | { type: "fulfilling"; orderId: string }
  | { type: "fulfilled"; orderId: string }
  | { type: "cancelling"; orderId: string; reason: string }
  | { type: "cancelled"; orderId: string; reason: string }
  | { type: "done"; orderId: string; status: "approved" | "rejected" | "timeout" };

type StartResponse = {
  ok: true;
  runId: string;
  orderId: string;
  timeout: string;
  approvalToken: string;
  status: string;
};

function parseSseChunk(rawChunk: string): ApprovalEvent | null {
  const payload = rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;
  try {
    return JSON.parse(payload) as ApprovalEvent;
  } catch {
    return null;
  }
}

function parseApiError(data: unknown, fallback: string) {
  if (data && typeof data === "object" && "error" in data) {
    const error = (data as { error?: { message?: unknown } }).error;
    if (error && typeof error.message === "string") {
      return error.message;
    }
  }
  return fallback;
}

export function ApprovalGateDemo() {
  const [orderId, setOrderId] = useState("order-4821");
  const [timeout, setTimeout] = useState("30s");
  const [runId, setRunId] = useState<string | null>(null);
  const [approvalToken, setApprovalToken] = useState<string | null>(null);
  const [events, setEvents] = useState<ApprovalEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const connectToStream = useCallback(async (nextRunId: string) => {
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`/api/readable/${nextRunId}`, { signal: controller.signal });
      if (!response.ok || !response.body) {
        throw new Error("Failed to connect to stream");
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
          setEvents((current) => [...current, event]);
          if (event.type === "waiting") {
            setApprovalToken(event.token);
          }
          if (event.type === "done") {
            setIsRunning(false);
          }
        }
      }
    } catch (streamError) {
      if (streamError instanceof Error && streamError.name === "AbortError") return;
      setError(streamError instanceof Error ? streamError.message : "Stream failed");
      setIsRunning(false);
    }
  }, []);

  const handleStart = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunId(null);
    setApprovalToken(null);
    setEvents([]);
    setError(null);
    setIsRunning(true);

    try {
      const response = await fetch("/api/approval-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, timeout }),
      });
      const data = (await response.json()) as StartResponse | { error?: { message?: string } };
      if (!response.ok) {
        throw new Error(parseApiError(data, "Failed to start workflow"));
      }

      const startData = data as StartResponse;
      setRunId(startData.runId);
      setApprovalToken(startData.approvalToken);
      void connectToStream(startData.runId);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Failed to start workflow");
      setIsRunning(false);
    }
  }, [connectToStream, orderId, timeout]);

  const finalState = useMemo(() => {
    const doneEvent = [...events].reverse().find((event) => event.type === "done");
    return doneEvent?.status ?? (isRunning ? "waiting" : "idle");
  }, [events, isRunning]);

  return (
    <section className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">Approval Gate</h2>
          <p className="text-sm text-gray-600">
            Starts a human approval workflow and shows the durable hook token used to resume it.
          </p>
        </div>
        <div className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
          {finalState}
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_160px_140px]">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">Order ID</span>
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            disabled={isRunning}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">Timeout</span>
          <select
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={timeout}
            onChange={(event) => setTimeout(event.target.value)}
            disabled={isRunning}
          >
            <option value="10s">10s</option>
            <option value="30s">30s</option>
            <option value="1m">1m</option>
            <option value="5m">5m</option>
            <option value="24h">24h</option>
          </select>
        </label>
        <button
          className="rounded-md bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-400"
          onClick={() => void handleStart()}
          disabled={isRunning}
        >
          {isRunning ? "Running..." : "Start"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p>Run ID: {runId ? <span className="font-mono text-xs">{runId}</span> : "Not started"}</p>
          <p className="mt-2">
            Approval token: {approvalToken ? <span className="font-mono text-xs">{approvalToken}</span> : "Waiting for workflow"}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p className="font-medium text-gray-800">Manual next step</p>
          <p className="mt-1">
            Once mounted helper routes are wired, resume the token through the approval endpoint to complete the happy path.
          </p>
        </div>
      </div>

      {error ? <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-800">Workflow events</h3>
        <ol className="mt-3 space-y-2">
          {events.length === 0 ? (
            <li className="rounded-md border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500">
              No events yet.
            </li>
          ) : (
            events.map((event, index) => (
              <li key={`${event.type}-${index}`} className="rounded-md border border-gray-200 bg-white px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{event.type}</p>
                <pre className="mt-1 overflow-x-auto text-xs text-gray-700">{JSON.stringify(event, null, 2)}</pre>
              </li>
            ))
          )}
        </ol>
      </div>
    </section>
  );
}
