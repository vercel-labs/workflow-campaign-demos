"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PipelineEvent =
  | { type: "step_start"; step: string; index: number; total: number }
  | { type: "step_progress"; step: string; percent: number; message: string }
  | { type: "step_done"; step: string; index: number; total: number; durationMs: number }
  | { type: "pipeline_done"; totalMs: number };

type StepState = {
  name: string;
  progress: number;
  status: "pending" | "running" | "done";
  detail: string;
};

const STEP_NAMES = ["Extract", "Transform", "Validate", "Load"];

function parseSseChunk(rawChunk: string): PipelineEvent | null {
  const payload = rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as PipelineEvent;
  } catch {
    return null;
  }
}

export function PipelineDemo() {
  const [documentId, setDocumentId] = useState("DOC-2026-ETL");
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepState[]>(() =>
    STEP_NAMES.map((name) => ({ name, progress: 0, status: "pending", detail: "Waiting" })),
  );
  const [totalMs, setTotalMs] = useState<number | null>(null);
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

          if (event.type === "step_start") {
            setSteps((current) =>
              current.map((step, index) =>
                index === event.index
                  ? { ...step, status: "running", detail: "Starting", progress: 0 }
                  : step,
              ),
            );
            appendLog(`${event.step}: started`);
          }

          if (event.type === "step_progress") {
            setSteps((current) =>
              current.map((step) =>
                step.name === event.step
                  ? { ...step, status: "running", progress: event.percent, detail: event.message }
                  : step,
              ),
            );
          }

          if (event.type === "step_done") {
            setSteps((current) =>
              current.map((step) =>
                step.name === event.step
                  ? {
                      ...step,
                      status: "done",
                      progress: 100,
                      detail: `${event.durationMs}ms`,
                    }
                  : step,
              ),
            );
            appendLog(`${event.step}: completed in ${event.durationMs}ms`);
          }

          if (event.type === "pipeline_done") {
            setStatus("done");
            setTotalMs(event.totalMs);
            appendLog(`pipeline completed in ${event.totalMs}ms`);
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
    setTotalMs(null);
    setLog([]);
    setSteps(STEP_NAMES.map((name) => ({ name, progress: 0, status: "pending", detail: "Waiting" })));

    try {
      const response = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
        signal: controller.signal,
      });

      const payload = (await response.json()) as {
        runId?: string;
        error?: { message?: string };
      };

      if (!response.ok || !payload.runId) {
        throw new Error(payload.error?.message ?? "Failed to start pipeline");
      }

      setRunId(payload.runId);
      appendLog(`pipeline started for ${documentId}`);
      await connectStream(payload.runId, controller.signal);
    } catch (errorValue) {
      if (controller.signal.aborted) return;
      setStatus("error");
      setError(errorValue instanceof Error ? errorValue.message : "Unexpected pipeline error");
    }
  }, [appendLog, connectStream, documentId]);

  const completedCount = useMemo(
    () => steps.filter((step) => step.status === "done").length,
    [steps],
  );

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-gray-300 bg-background-100 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <label className="flex-1 text-sm font-medium text-gray-900">
            Document ID
            <input
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-1000 outline-none focus:border-blue-700"
              onChange={(event) => setDocumentId(event.target.value)}
              value={documentId}
            />
          </label>
          <button
            className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={status === "running"}
            onClick={handleStart}
            type="button"
          >
            {status === "running" ? "Running..." : "Start pipeline"}
          </button>
        </div>
        <div className="mt-3 text-sm text-gray-900">
          <div>Run: {runId ?? "not started"}</div>
          <div>Status: {status}</div>
          <div>Completed steps: {completedCount}/{steps.length}</div>
        </div>
      </div>

      <div className="grid gap-3">
        {steps.map((step) => (
          <div key={step.name} className="rounded-xl border border-gray-300 bg-background-100 p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div className="font-semibold text-gray-1000">{step.name}</div>
              <div className="uppercase tracking-wide text-gray-900">{step.status}</div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-blue-700 transition-all"
                style={{ width: `${step.progress}%` }}
              />
            </div>
            <div className="mt-2 text-sm text-gray-900">{step.detail}</div>
          </div>
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
          <h3 className="font-semibold text-gray-1000">Result</h3>
          <div className="mt-3">Total runtime: {totalMs ? `${totalMs}ms` : "pending"}</div>
          <div className="mt-2 text-red-700">{error ?? " "}</div>
        </div>
      </div>
    </section>
  );
}
