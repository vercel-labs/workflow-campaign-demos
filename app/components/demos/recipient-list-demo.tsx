"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type ChannelId = "slack" | "email" | "pagerduty" | "webhook";
type Severity = "info" | "warning" | "critical";

type RecipientEvent =
  | { type: "rules_evaluated"; matched: string[]; skipped: string[] }
  | { type: "delivering"; channel: string }
  | { type: "delivered"; channel: string; durationMs: number }
  | { type: "delivery_failed"; channel: string; error: string; attempt: number }
  | { type: "delivery_retrying"; channel: string; attempt: number }
  | { type: "done"; summary: { delivered: number; failed: number; skipped: number } };

type ChannelState = {
  id: ChannelId;
  status: string;
  detail: string;
};

const CHANNELS: ChannelId[] = ["slack", "email", "pagerduty", "webhook"];

function parseSseChunk(rawChunk: string): RecipientEvent | null {
  const payload = rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as RecipientEvent;
  } catch {
    return null;
  }
}

export function RecipientListDemo() {
  const [severity, setSeverity] = useState<Severity>("warning");
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [channels, setChannels] = useState<ChannelState[]>(
    CHANNELS.map((id) => ({ id, status: "pending", detail: "Waiting" })),
  );
  const [summary, setSummary] = useState<{ delivered: number; failed: number; skipped: number } | null>(null);
  const [log, setLog] = useState<string[]>([]);

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

          if (event.type === "rules_evaluated") {
            setChannels((current) =>
              current.map((channel) => ({
                ...channel,
                status: event.matched.includes(channel.id)
                  ? "matched"
                  : event.skipped.includes(channel.id)
                    ? "skipped"
                    : channel.status,
                detail: event.matched.includes(channel.id) ? "Selected by rules" : "Skipped by rules",
              })),
            );
            appendLog(`routing rules evaluated for ${severity}`);
          }

          if (event.type === "delivering") {
            setChannels((current) =>
              current.map((channel) =>
                channel.id === event.channel
                  ? { ...channel, status: "delivering", detail: "Sending alert" }
                  : channel,
              ),
            );
          }

          if (event.type === "delivery_retrying") {
            setChannels((current) =>
              current.map((channel) =>
                channel.id === event.channel
                  ? { ...channel, status: "retrying", detail: `Retry ${event.attempt}` }
                  : channel,
              ),
            );
            appendLog(`${event.channel}: retry ${event.attempt}`);
          }

          if (event.type === "delivered") {
            setChannels((current) =>
              current.map((channel) =>
                channel.id === event.channel
                  ? { ...channel, status: "delivered", detail: `${event.durationMs}ms` }
                  : channel,
              ),
            );
          }

          if (event.type === "delivery_failed") {
            setChannels((current) =>
              current.map((channel) =>
                channel.id === event.channel
                  ? { ...channel, status: "failed", detail: event.error }
                  : channel,
              ),
            );
            appendLog(`${event.channel}: failed`);
          }

          if (event.type === "done") {
            setStatus("done");
            setSummary(event.summary);
            appendLog("recipient-list run complete");
          }
        }
      }
    },
    [appendLog, severity],
  );

  const handleStart = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRunId(null);
    setStatus("running");
    setError(null);
    setSummary(null);
    setLog([]);
    setChannels(CHANNELS.map((id) => ({ id, status: "pending", detail: "Waiting" })));

    try {
      const response = await fetch("/api/recipient-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          alertId: `ALERT-${Date.now().toString(36)}`,
          message: "CPU usage exceeded 95% in us-east-1",
          severity,
          failures: { transient: severity === "critical" ? ["slack"] : [], permanent: [] },
        }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as {
        runId?: string;
        error?: { message?: string };
      };

      if (!response.ok || !payload.runId) {
        throw new Error(payload.error?.message ?? "Failed to start recipient-list");
      }

      setRunId(payload.runId);
      appendLog("workflow started");
      await connectStream(payload.runId, controller.signal);
    } catch (errorValue) {
      if (controller.signal.aborted) return;
      setStatus("error");
      setError(errorValue instanceof Error ? errorValue.message : "Unexpected recipient-list error");
    }
  }, [appendLog, connectStream, severity]);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-gray-300 bg-background-100 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <label className="text-sm font-medium text-gray-900">
            Severity
            <select
              className="mt-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-1000 outline-none focus:border-blue-700"
              onChange={(event) => setSeverity(event.target.value as Severity)}
              value={severity}
            >
              <option value="info">info</option>
              <option value="warning">warning</option>
              <option value="critical">critical</option>
            </select>
          </label>
          <button
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={status === "running"}
            onClick={handleStart}
            type="button"
          >
            {status === "running" ? "Routing..." : "Send alert"}
          </button>
        </div>
        <div className="mt-3 text-sm text-gray-900">
          <div>Run: {runId ?? "not started"}</div>
          <div>Status: {status}</div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {channels.map((channel) => (
          <article key={channel.id} className="rounded-xl border border-gray-300 bg-background-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-gray-1000">{channel.id}</div>
              <div className="text-xs uppercase tracking-wide text-gray-900">{channel.status}</div>
            </div>
            <div className="mt-2 text-sm text-gray-900">{channel.detail}</div>
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
          <div className="mt-3">Delivered: {summary?.delivered ?? 0}</div>
          <div>Failed: {summary?.failed ?? 0}</div>
          <div>Skipped: {summary?.skipped ?? 0}</div>
          <div className="mt-2 text-red-700">{error ?? " "}</div>
        </div>
      </div>
    </section>
  );
}
