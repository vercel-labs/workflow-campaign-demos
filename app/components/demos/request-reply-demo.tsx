"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type RequestReplyEvent =
  | { type: "request_sent"; requestId: string; service: string; payload: string }
  | { type: "waiting_for_reply"; requestId: string; service: string; deadline: string }
  | { type: "reply_received"; requestId: string; service: string; response: string; latencyMs: number }
  | { type: "timeout"; requestId: string; service: string; attempt: number }
  | { type: "retrying"; requestId: string; service: string; attempt: number; maxAttempts: number }
  | { type: "all_replies_collected"; requestId: string; results: Array<{ service: string; response: string }> }
  | { type: "failed"; requestId: string; service: string; reason: string }
  | { type: "done"; requestId: string; totalServices: number; successCount: number; failCount: number };

type ServiceState = {
  service: string;
  status: string;
  detail: string;
};

const DEFAULT_SERVICES = ["user-service", "inventory-service", "payment-service"];

function parseSseChunk(rawChunk: string): RequestReplyEvent | null {
  const payload = rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as RequestReplyEvent;
  } catch {
    return null;
  }
}

export function RequestReplyDemo() {
  const [timeoutMs, setTimeoutMs] = useState(800);
  const [maxAttempts, setMaxAttempts] = useState(2);
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceState[]>(
    DEFAULT_SERVICES.map((service) => ({ service, status: "pending", detail: "Waiting" })),
  );
  const [log, setLog] = useState<string[]>([]);
  const [summary, setSummary] = useState<{ successCount: number; failCount: number } | null>(null);

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

          if (event.type === "request_sent") {
            setServices((current) =>
              current.map((service) =>
                service.service === event.service
                  ? { ...service, status: "sending", detail: event.payload }
                  : service,
              ),
            );
          }

          if (event.type === "waiting_for_reply") {
            setServices((current) =>
              current.map((service) =>
                service.service === event.service
                  ? { ...service, status: "waiting", detail: `Deadline ${event.deadline}` }
                  : service,
              ),
            );
          }

          if (event.type === "timeout") {
            setServices((current) =>
              current.map((service) =>
                service.service === event.service
                  ? { ...service, status: "timeout", detail: `Attempt ${event.attempt}` }
                  : service,
              ),
            );
            appendLog(`${event.service}: timeout on attempt ${event.attempt}`);
          }

          if (event.type === "retrying") {
            setServices((current) =>
              current.map((service) =>
                service.service === event.service
                  ? {
                      ...service,
                      status: "retrying",
                      detail: `${event.attempt}/${event.maxAttempts}`,
                    }
                  : service,
              ),
            );
          }

          if (event.type === "reply_received") {
            setServices((current) =>
              current.map((service) =>
                service.service === event.service
                  ? {
                      ...service,
                      status: "received",
                      detail: `${event.latencyMs}ms • ${event.response}`,
                    }
                  : service,
              ),
            );
            appendLog(`${event.service}: reply received`);
          }

          if (event.type === "failed") {
            setServices((current) =>
              current.map((service) =>
                service.service === event.service
                  ? { ...service, status: "failed", detail: event.reason }
                  : service,
              ),
            );
          }

          if (event.type === "all_replies_collected") {
            appendLog(`collected ${event.results.length} correlated replies`);
          }

          if (event.type === "done") {
            setStatus("done");
            setSummary({ successCount: event.successCount, failCount: event.failCount });
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

    const requestId = `REQ-${Date.now().toString(36)}`;

    setRunId(null);
    setStatus("running");
    setError(null);
    setLog([]);
    setSummary(null);
    setServices(DEFAULT_SERVICES.map((service) => ({ service, status: "pending", detail: "Waiting" })));

    try {
      const response = await fetch("/api/request-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, services: DEFAULT_SERVICES, timeoutMs, maxAttempts }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as {
        runId?: string;
        error?: { message?: string };
      };

      if (!response.ok || !payload.runId) {
        throw new Error(payload.error?.message ?? "Failed to start request-reply");
      }

      setRunId(payload.runId);
      appendLog(`workflow started for ${requestId}`);
      await connectStream(payload.runId, controller.signal);
    } catch (errorValue) {
      if (controller.signal.aborted) return;
      setStatus("error");
      setError(errorValue instanceof Error ? errorValue.message : "Unexpected request-reply error");
    }
  }, [appendLog, connectStream, maxAttempts, timeoutMs]);

  const successCount = useMemo(
    () => services.filter((service) => service.status === "received").length,
    [services],
  );

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-gray-300 bg-background-100 p-5">
        <div className="grid gap-4 md:grid-cols-[180px_180px_auto] md:items-end">
          <label className="text-sm font-medium text-gray-900">
            Timeout ms
            <input
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-1000 outline-none focus:border-blue-700"
              min={100}
              onChange={(event) => setTimeoutMs(Number(event.target.value))}
              type="number"
              value={timeoutMs}
            />
          </label>
          <label className="text-sm font-medium text-gray-900">
            Max attempts
            <input
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-1000 outline-none focus:border-blue-700"
              min={1}
              onChange={(event) => setMaxAttempts(Number(event.target.value))}
              type="number"
              value={maxAttempts}
            />
          </label>
          <button
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={status === "running"}
            onClick={handleStart}
            type="button"
          >
            {status === "running" ? "Requesting..." : "Send requests"}
          </button>
        </div>
        <div className="mt-3 text-sm text-gray-900">
          <div>Run: {runId ?? "not started"}</div>
          <div>Status: {status}</div>
          <div>Successful replies: {summary?.successCount ?? successCount}</div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {services.map((service) => (
          <article key={service.service} className="rounded-xl border border-gray-300 bg-background-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-gray-1000">{service.service}</div>
              <div className="text-xs uppercase tracking-wide text-gray-900">{service.status}</div>
            </div>
            <div className="mt-2 text-sm text-gray-900">{service.detail}</div>
          </article>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-gray-300 bg-background-100 p-4">
          <h3 className="text-sm font-semibold text-gray-1000">Execution log</h3>
          <div className="mt-3 space-y-2 text-sm text-gray-900">
            {log.length > 0 ? log.map((entry, index) => <div key={`${entry}-${index}`}>{entry}</div>) : <div>No events yet.</div>}
          </div>
        </div>
        <div className="rounded-xl border border-gray-300 bg-background-100 p-4 text-sm text-gray-900">
          <h3 className="font-semibold text-gray-1000">Summary</h3>
          <div className="mt-3">Success: {summary?.successCount ?? 0}</div>
          <div>Failed: {summary?.failCount ?? 0}</div>
          <div className="mt-2 text-red-700">{error ?? " "}</div>
        </div>
      </div>
    </section>
  );
}
