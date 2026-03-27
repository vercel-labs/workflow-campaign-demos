"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type RawFormat = "xml" | "csv" | "legacy-json";

type NormalizeEvent =
  | { type: "normalize_detect"; messageId: string; detectedFormat?: RawFormat }
  | {
      type: "normalize_parse";
      messageId: string;
      canonical?: {
        orderId: string;
        customer: string;
        amount: number;
        currency: string;
        sourceFormat: RawFormat;
      };
    }
  | { type: "normalize_result"; messageId: string; error?: string }
  | {
      type: "normalize_done";
      messageId: string;
      error?: string;
      results?: {
        successful: Array<{ orderId: string; customer: string; amount: number }>;
        failed: Array<{ messageId: string; error: string }>;
      };
    };

type MessageState = {
  id: string;
  status: "pending" | "detected" | "parsed" | "failed";
  detectedFormat?: RawFormat;
  summary?: string;
  error?: string;
};

const MESSAGE_IDS = ["MSG-001", "MSG-002", "MSG-003", "MSG-004", "MSG-005", "MSG-006"];

function parseSseChunk(rawChunk: string): NormalizeEvent | null {
  const payload = rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as NormalizeEvent;
  } catch {
    return null;
  }
}

export function NormalizerDemo() {
  const [strictMode, setStrictMode] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageState[]>(() =>
    MESSAGE_IDS.map((id) => ({ id, status: "pending" })),
  );
  const [log, setLog] = useState<string[]>([]);
  const [summary, setSummary] = useState<{ successful: number; failed: number } | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const appendLog = useCallback((line: string) => {
    setLog((current) => [...current, line]);
  }, []);

  const connectStream = useCallback(
    async (targetRunId: string, signal: AbortSignal) => {
      const response = await fetch(`/api/readable/${encodeURIComponent(targetRunId)}`, {
        signal,
      });

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

          if (event.type === "normalize_detect") {
            setMessages((current) =>
              current.map((message) =>
                message.id === event.messageId
                  ? {
                      ...message,
                      status: "detected",
                      detectedFormat: event.detectedFormat,
                    }
                  : message,
              ),
            );
            appendLog(`${event.messageId}: detected ${event.detectedFormat ?? "unknown"} format`);
          }

          if (event.type === "normalize_parse" && event.canonical) {
            const canonical = event.canonical;
            setMessages((current) =>
              current.map((message) =>
                message.id === event.messageId
                  ? {
                      ...message,
                      status: "parsed",
                      summary: `${canonical.customer} • ${canonical.currency} ${canonical.amount}`,
                    }
                  : message,
              ),
            );
            appendLog(`${event.messageId}: parsed into canonical order ${canonical.orderId}`);
          }

          if (event.type === "normalize_result" && event.error) {
            setMessages((current) =>
              current.map((message) =>
                message.id === event.messageId
                  ? {
                      ...message,
                      status: "failed",
                      error: event.error,
                    }
                  : message,
              ),
            );
            appendLog(`${event.messageId}: parse failed`);
          }

          if (event.type === "normalize_done") {
            setStatus("done");
            setSummary({
              successful: event.results?.successful.length ?? 0,
              failed: event.results?.failed.length ?? 0,
            });
            if (event.error) {
              setError(event.error);
              appendLog(`completed with strict-mode failure: ${event.error}`);
            } else {
              appendLog("normalization complete");
            }
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

    setRunId(null);
    setStatus("running");
    setError(null);
    setSummary(null);
    setLog([]);
    setMessages(MESSAGE_IDS.map((id) => ({ id, status: "pending" })));

    try {
      const response = await fetch("/api/normalizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: { strictMode } }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as {
        runId?: string;
        error?: { message?: string };
      };

      if (!response.ok || !payload.runId) {
        throw new Error(payload.error?.message ?? "Failed to start normalizer");
      }

      setRunId(payload.runId);
      appendLog(`workflow started${strictMode ? " in strict mode" : ""}`);
      await connectStream(payload.runId, controller.signal);
    } catch (errorValue) {
      if (controller.signal.aborted) return;
      setStatus("error");
      setError(errorValue instanceof Error ? errorValue.message : "Unexpected normalizer error");
    }
  }, [appendLog, connectStream, strictMode]);

  const counts = useMemo(() => {
    return messages.reduce(
      (acc, message) => {
        acc[message.status] += 1;
        return acc;
      },
      { pending: 0, detected: 0, parsed: 0, failed: 0 },
    );
  }, [messages]);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-gray-300 bg-background-100 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <label className="flex items-center gap-3 text-sm text-gray-900">
            <input
              checked={strictMode}
              className="h-4 w-4 rounded border-gray-300"
              onChange={(event) => setStrictMode(event.target.checked)}
              type="checkbox"
            />
            Fail the run if any message cannot be normalized
          </label>
          <button
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={status === "running"}
            onClick={handleStart}
            type="button"
          >
            {status === "running" ? "Normalizing..." : "Start normalization"}
          </button>
        </div>
        <div className="mt-3 text-sm text-gray-900">
          <div>Run: {runId ?? "not started"}</div>
          <div>Status: {status}</div>
          <div>
            Progress: {counts.parsed + counts.failed}/{messages.length} messages finalized
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {messages.map((message) => (
          <article key={message.id} className="rounded-xl border border-gray-300 bg-background-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-1000">{message.id}</h3>
              <span className="text-xs uppercase tracking-wide text-gray-900">{message.status}</span>
            </div>
            <div className="mt-2 text-sm text-gray-900">
              <div>Detected: {message.detectedFormat ?? "pending"}</div>
              <div>{message.summary ?? message.error ?? "Waiting for events..."}</div>
            </div>
          </article>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-xl border border-gray-300 bg-background-100 p-4">
          <h3 className="text-sm font-semibold text-gray-1000">Execution log</h3>
          <div className="mt-3 space-y-2 text-sm text-gray-900">
            {log.length > 0 ? log.map((entry, index) => <div key={`${entry}-${index}`}>{entry}</div>) : <div>No events yet.</div>}
          </div>
        </div>
        <div className="rounded-xl border border-gray-300 bg-background-100 p-4 text-sm text-gray-900">
          <h3 className="font-semibold text-gray-1000">Summary</h3>
          <div className="mt-3">Successful: {summary?.successful ?? counts.parsed}</div>
          <div>Failed: {summary?.failed ?? counts.failed}</div>
          <div className="mt-2 text-red-700">{error ?? " "}</div>
        </div>
      </div>
    </section>
  );
}
