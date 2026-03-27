"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ResequencerEvent =
  | { type: "waiting"; batchId: string; expectedCount: number; tokens: string[] }
  | { type: "fragment_received"; batchId: string; seq: number; payload: string }
  | { type: "fragment_buffered"; batchId: string; seq: number; bufferSize: number }
  | { type: "fragment_released"; batchId: string; seq: number; payload: string; nextExpected: number }
  | { type: "done"; batchId: string; ordered: string[] };

type FragmentState = "pending" | "received" | "buffered" | "released";

type FragmentSnapshot = {
  seq: number;
  payload: string;
  state: FragmentState;
};

type LogEntry = {
  id: string;
  text: string;
  tone: "default" | "success" | "warning";
};

const EXPECTED_COUNT = 5;
const SCRAMBLED_ORDER = [3, 1, 4, 2, 5];
const PAYLOADS = ["alpha", "bravo", "charlie", "delta", "echo"];

function parseSseChunk(rawChunk: string): ResequencerEvent | null {
  const payload = rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as ResequencerEvent;
  } catch {
    return null;
  }
}

function logClass(tone: LogEntry["tone"]): string {
  if (tone === "success") return "text-green-700";
  if (tone === "warning") return "text-amber-700";
  return "text-gray-900";
}

export function ResequencerDemo() {
  const [runId, setRunId] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [tokens, setTokens] = useState<string[]>([]);
  const [fragments, setFragments] = useState<FragmentSnapshot[]>([]);
  const [ordered, setOrdered] = useState<string[]>([]);
  const [sendQueue, setSendQueue] = useState<number[]>(SCRAMBLED_ORDER);
  const [status, setStatus] = useState<"idle" | "waiting" | "running" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const appendLog = useCallback((tone: LogEntry["tone"], text: string) => {
    setLog((current) => [
      ...current,
      { id: `${Date.now()}-${current.length}`, tone, text },
    ]);
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

          if (event.type === "waiting") {
            setStatus("waiting");
            setTokens(event.tokens);
            appendLog("default", `Waiting for ${event.expectedCount} fragments`);
          }

          if (event.type === "fragment_received") {
            setStatus("running");
            setFragments((current) =>
              current.map((fragment) =>
                fragment.seq === event.seq
                  ? { ...fragment, state: "received" }
                  : fragment,
              ),
            );
            appendLog("default", `Fragment ${event.seq} received`);
          }

          if (event.type === "fragment_buffered") {
            setFragments((current) =>
              current.map((fragment) =>
                fragment.seq === event.seq
                  ? { ...fragment, state: "buffered" }
                  : fragment,
              ),
            );
            appendLog("warning", `Fragment ${event.seq} buffered`);
          }

          if (event.type === "fragment_released") {
            setFragments((current) =>
              current.map((fragment) =>
                fragment.seq === event.seq
                  ? { ...fragment, state: "released" }
                  : fragment,
              ),
            );
            setOrdered((current) =>
              current.includes(event.payload) ? current : [...current, event.payload],
            );
            appendLog("success", `Fragment ${event.seq} released in order`);
          }

          if (event.type === "done") {
            setStatus("done");
            setOrdered(event.ordered);
            appendLog("success", "Resequencing complete");
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

    const nextBatchId = `batch-${Date.now().toString(36)}`;

    setRunId(null);
    setBatchId(nextBatchId);
    setTokens([]);
    setOrdered([]);
    setSendQueue(SCRAMBLED_ORDER);
    setFragments(
      PAYLOADS.map((payload, index) => ({
        seq: index + 1,
        payload,
        state: "pending" as FragmentState,
      })),
    );
    setStatus("running");
    setError(null);
    setLog([]);

    try {
      const response = await fetch("/api/resequencer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: nextBatchId, expectedCount: EXPECTED_COUNT }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as {
        runId?: string;
        error?: { message?: string };
      };

      if (!response.ok || !payload.runId) {
        throw new Error(payload.error?.message ?? "Failed to start resequencer");
      }

      setRunId(payload.runId);
      await connectStream(payload.runId, controller.signal);
    } catch (errorValue) {
      if (controller.signal.aborted) return;
      setStatus("error");
      setError(
        errorValue instanceof Error ? errorValue.message : "Unexpected resequencer error",
      );
    }
  }, [connectStream]);

  const sendFragment = useCallback(
    async (seq: number) => {
      if (!batchId) return;

      const payload = PAYLOADS[seq - 1];
      const response = await fetch("/api/resequencer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, seq, payload }),
      });

      const body = (await response.json()) as { error?: { message?: string } };

      if (!response.ok) {
        throw new Error(body.error?.message ?? `Failed to send fragment ${seq}`);
      }

      setSendQueue((current) => current.filter((value) => value !== seq));
    },
    [batchId],
  );

  const handleSendNext = useCallback(async () => {
    const next = sendQueue[0];
    if (!next) return;

    try {
      await sendFragment(next);
    } catch (errorValue) {
      setStatus("error");
      setError(errorValue instanceof Error ? errorValue.message : "Failed to send fragment");
    }
  }, [sendFragment, sendQueue]);

  const handleSendAll = useCallback(async () => {
    try {
      for (const seq of sendQueue) {
        // Send in the queued scrambled order so the workflow demonstrates buffering.
        // Requests are serialized to keep the event log easy to follow.
        // eslint-disable-next-line no-await-in-loop
        await sendFragment(seq);
      }
    } catch (errorValue) {
      setStatus("error");
      setError(errorValue instanceof Error ? errorValue.message : "Failed to send fragments");
    }
  }, [sendFragment, sendQueue]);

  const releasedCount = useMemo(
    () => fragments.filter((fragment) => fragment.state === "released").length,
    [fragments],
  );

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-gray-300 bg-background-100 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2 text-sm text-gray-900">
            <p>Status: {status}</p>
            <p>Released: {releasedCount}/{EXPECTED_COUNT}</p>
            {runId ? <p className="font-mono text-xs">runId: {runId}</p> : null}
            {batchId ? <p className="font-mono text-xs">batchId: {batchId}</p> : null}
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleStart}
              className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-white"
            >
              Start Batch
            </button>
            <button
              type="button"
              onClick={handleSendNext}
              disabled={!runId || sendQueue.length === 0}
              className="rounded-lg bg-gray-1000 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-500"
            >
              Send Next Fragment
            </button>
            <button
              type="button"
              onClick={handleSendAll}
              disabled={!runId || sendQueue.length === 0}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-1000 disabled:cursor-not-allowed disabled:text-gray-500"
            >
              Send Remaining
            </button>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-300 bg-background-100 p-5">
          <h3 className="text-sm font-semibold text-gray-1000">Fragment Queue</h3>
          <div className="mt-3 space-y-3">
            {fragments.map((fragment) => (
              <div
                key={fragment.seq}
                className="flex items-center justify-between rounded-lg border border-gray-300 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-gray-1000">
                    #{fragment.seq} {fragment.payload}
                  </p>
                  <p className="text-xs text-gray-900">{tokens[fragment.seq - 1] ?? "token pending"}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    fragment.state === "released"
                      ? "bg-green-700/15 text-green-700"
                      : fragment.state === "buffered"
                        ? "bg-amber-700/15 text-amber-700"
                        : fragment.state === "received"
                          ? "bg-cyan-700/15 text-cyan-700"
                          : "bg-gray-200 text-gray-900"
                  }`}
                >
                  {fragment.state}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-300 bg-background-100 p-5">
          <h3 className="text-sm font-semibold text-gray-1000">Ordered Output</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {ordered.length === 0 ? (
              <p className="text-sm text-gray-900">No fragments released yet.</p>
            ) : (
              ordered.map((value, index) => (
                <span
                  key={`${value}-${index}`}
                  className="rounded-full bg-green-700/15 px-3 py-1 text-sm font-medium text-green-700"
                >
                  {index + 1}. {value}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-300 bg-background-100 p-5">
        <h3 className="text-sm font-semibold text-gray-1000">Execution Log</h3>
        <div className="mt-3 space-y-2 text-sm">
          {log.length === 0 ? (
            <p className="text-gray-900">No events yet.</p>
          ) : (
            log.map((entry) => (
              <p key={entry.id} className={logClass(entry.tone)}>
                {entry.text}
              </p>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
