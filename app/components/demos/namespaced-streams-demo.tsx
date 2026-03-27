"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type DemoStatus = "idle" | "running" | "completed" | "error";
type StreamEvent = {
  namespace: string;
  value: Record<string, unknown>;
};

function parseSseEvent(chunk: string): StreamEvent | null {
  const payload = chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as StreamEvent;
  } catch {
    return null;
  }
}

export function NamespacedStreamsDemo() {
  const [status, setStatus] = useState<DemoStatus>("idle");
  const [topic, setTopic] = useState("Durable Workflows");
  const [runId, setRunId] = useState<string | null>(null);
  const [draftEvents, setDraftEvents] = useState<Record<string, unknown>[]>([]);
  const [telemetryEvents, setTelemetryEvents] = useState<Record<string, unknown>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const draftText = useMemo(
    () =>
      draftEvents
        .map((event) => (typeof event.text === "string" ? event.text : ""))
        .filter(Boolean)
        .join("\n\n"),
    [draftEvents],
  );

  const totalTokens = useMemo(() => {
    return telemetryEvents.reduce((sum, event) => {
      return sum + (typeof event.output === "number" ? event.output : 0);
    }, 0);
  }, [telemetryEvents]);

  const connectToStream = useCallback(async (nextRunId: string, signal: AbortSignal) => {
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
      const chunks = buffer.replaceAll("\r\n", "\n").split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const event = parseSseEvent(chunk);
        if (!event) continue;

        if (event.namespace === "draft") {
          setDraftEvents((current) => [...current, event.value]);
        }

        if (event.namespace === "telemetry") {
          setTelemetryEvents((current) => [...current, event.value]);
          if (event.value.type === "done") {
            setStatus("completed");
          }
        }
      }
    }
  }, []);

  const handleStart = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("running");
    setRunId(null);
    setDraftEvents([]);
    setTelemetryEvents([]);
    setError(null);

    try {
      const response = await fetch("/api/namespaced-streams", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ topic }),
        signal: controller.signal,
      });
      const payload = (await response.json()) as {
        runId?: string;
        error?: { message?: string };
      };

      if (!response.ok || !payload.runId) {
        throw new Error(payload.error?.message ?? "Failed to start workflow");
      }

      setRunId(payload.runId);
      await connectToStream(payload.runId, controller.signal);
      setStatus((current) => (current === "running" ? "completed" : current));
    } catch (caught) {
      if (controller.signal.aborted) return;
      setStatus("error");
      setError(caught instanceof Error ? caught.message : "Failed to run demo");
    }
  }, [connectToStream, topic]);

  return (
    <section className="space-y-4 rounded-lg border border-gray-300 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">Namespaced Streams</h2>
          <p className="text-sm text-gray-600">
            One workflow emits draft content and telemetry on separate namespaces.
          </p>
        </div>
        <span className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gray-700">
          {status}
        </span>
      </div>

      <label className="space-y-1 text-sm text-gray-700">
        <span className="font-medium">Topic</span>
        <input
          className="w-full rounded-md border border-gray-300 px-3 py-2"
          onChange={(event) => setTopic(event.target.value)}
          value={topic}
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          className="rounded-md bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={status === "running"}
          onClick={() => void handleStart()}
        >
          Generate
        </button>
        <p className="text-sm text-gray-600">Output tokens: {totalTokens}</p>
      </div>

      {runId ? <p className="text-xs text-gray-500">runId: {runId}</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <p className="font-medium text-gray-900">Draft Stream</p>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs text-gray-700">
            {draftText || "No draft chunks yet."}
          </pre>
        </div>
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <p className="font-medium text-gray-900">Telemetry Stream</p>
          <ol className="mt-2 space-y-2 text-sm text-gray-700">
            {telemetryEvents.length === 0 ? <li>No telemetry yet.</li> : null}
            {telemetryEvents.map((event, index) => (
              <li className="rounded bg-white px-3 py-2" key={index}>
                {JSON.stringify(event)}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
