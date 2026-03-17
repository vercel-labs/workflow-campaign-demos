"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ResequencerCodeWorkbench } from "./resequencer-code-workbench";

type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail";

type FragmentState = "pending" | "received" | "buffered" | "released";

type FragmentSnapshot = {
  seq: number;
  payload: string;
  state: FragmentState;
};

type LogEvent = {
  kind: "start" | "received" | "buffered" | "released" | "done";
  message: string;
  atMs: number;
};

type DemoStatus = "idle" | "waiting" | "resequencing" | "done";

type ResequencerWorkflowLineMap = {
  createHooks: number[];
  waitLoop: number[];
  bufferLine: number[];
  releaseLine: number[];
  returnLine: number[];
};

type ResequencerStepLineMap = {
  emitStep: number[];
};

type Props = {
  workflowCode: string;
  workflowHtmlLines: string[];
  workflowLineMap: ResequencerWorkflowLineMap;

  stepCode: string;
  stepHtmlLines: string[];
  stepLineMap: ResequencerStepLineMap;
};

const EXPECTED_COUNT = 5;
const FRAGMENT_PAYLOADS = ["alpha", "bravo", "charlie", "delta", "echo"];
// Preset scrambled order: 3, 1, 4, 2, 5
const SCRAMBLED_ORDER = [3, 1, 4, 2, 5];

function parseSseChunk(rawChunk: string): unknown | null {
  const payload = rawChunk
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trim())
    .join("\n");

  if (!payload) return null;
  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

export function ResequencerDemo({
  workflowCode,
  workflowHtmlLines,
  workflowLineMap,
  stepCode,
  stepHtmlLines,
  stepLineMap,
}: Props) {
  const [runId, setRunId] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [status, setStatus] = useState<DemoStatus>("idle");
  const [fragments, setFragments] = useState<FragmentSnapshot[]>([]);
  const [ordered, setOrdered] = useState<string[]>([]);
  const [nextExpected, setNextExpected] = useState(1);
  const [log, setLog] = useState<LogEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [sendQueue, setSendQueue] = useState<number[]>([...SCRAMBLED_ORDER]);
  const [sending, setSending] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [stopTimer]);

  const addLog = useCallback((kind: LogEvent["kind"], message: string) => {
    const atMs = Date.now() - startTimeRef.current;
    setLog((prev) => [...prev, { kind, message, atMs }]);
  }, []);

  const connectSse = useCallback(
    async (targetRunId: string, signal: AbortSignal) => {
      const res = await fetch(`/api/readable/${encodeURIComponent(targetRunId)}`, { signal });
      if (!res.ok || !res.body) throw new Error("Stream unavailable");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.replaceAll("\r\n", "\n").split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const event = parseSseChunk(chunk) as { type: string; [key: string]: unknown } | null;
          if (!event) continue;
          handleSseEvent(event);
        }
      }

      if (buffer.trim()) {
        const event = parseSseChunk(buffer) as { type: string; [key: string]: unknown } | null;
        if (event) handleSseEvent(event);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  function handleSseEvent(event: { type: string; [key: string]: unknown }) {
    switch (event.type) {
      case "waiting":
        setStatus("waiting");
        addLog("start", `Waiting for ${event.expectedCount} fragments`);
        break;
      case "fragment_received":
        setStatus("resequencing");
        setFragments((prev) =>
          prev.map((f) =>
            f.seq === event.seq ? { ...f, state: "received" } : f
          )
        );
        addLog("received", `Fragment #${event.seq} received: "${event.payload}"`);
        break;
      case "fragment_buffered":
        setFragments((prev) =>
          prev.map((f) =>
            f.seq === event.seq ? { ...f, state: "buffered" } : f
          )
        );
        addLog("buffered", `Fragment #${event.seq} buffered (${event.bufferSize} in buffer)`);
        break;
      case "fragment_released":
        setFragments((prev) =>
          prev.map((f) =>
            f.seq === event.seq ? { ...f, state: "released" } : f
          )
        );
        setOrdered((prev) => [...prev, event.payload as string]);
        setNextExpected(event.nextExpected as number);
        addLog("released", `Fragment #${event.seq} released -> position ${(event.nextExpected as number) - 1}`);
        break;
      case "done":
        setStatus("done");
        stopTimer();
        addLog("done", `All ${(event.ordered as string[]).length} fragments in order`);
        break;
    }
  }

  const handleStart = useCallback(async () => {
    setError(null);
    stopTimer();
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    const newBatchId = `BATCH-${Date.now()}`;
    startTimeRef.current = Date.now();
    setElapsedMs(0);
    setOrdered([]);
    setNextExpected(1);
    setSendQueue([...SCRAMBLED_ORDER]);
    setSending(false);
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 50);

    try {
      const res = await fetch("/api/resequencer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId: newBatchId, expectedCount: EXPECTED_COUNT }),
        signal: controller.signal,
      });

      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error?.message ?? "Failed to start");
        stopTimer();
        return;
      }

      setRunId(payload.runId);
      setBatchId(newBatchId);
      setStatus("waiting");
      setLog([]);

      // Initialize fragment snapshots
      setFragments(
        Array.from({ length: EXPECTED_COUNT }, (_, i) => ({
          seq: i + 1,
          payload: FRAGMENT_PAYLOADS[i],
          state: "pending" as FragmentState,
        }))
      );

      // Connect to SSE stream
      connectSse(payload.runId, controller.signal).catch((err) => {
        if (controller.signal.aborted) return;
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Stream error");
      });
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to start");
      stopTimer();
    }
  }, [connectSse, stopTimer]);

  const handleReset = useCallback(() => {
    stopTimer();
    abortRef.current?.abort();
    abortRef.current = null;

    setRunId(null);
    setBatchId(null);
    setStatus("idle");
    setFragments([]);
    setOrdered([]);
    setNextExpected(1);
    setLog([]);
    setError(null);
    setElapsedMs(0);
    setSendQueue([...SCRAMBLED_ORDER]);
    setSending(false);
  }, [stopTimer]);

  const sendNextFragment = useCallback(async () => {
    if (!batchId || sendQueue.length === 0 || sending) return;

    setSending(true);
    const seq = sendQueue[0];
    const payload = FRAGMENT_PAYLOADS[seq - 1];

    try {
      const res = await fetch("/api/resequencer/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchId, seq, payload }),
      });

      const result = await res.json();
      if (!res.ok) {
        setError(result?.error?.message ?? "Failed to send fragment");
      } else {
        setSendQueue((prev) => prev.slice(1));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send fragment");
    } finally {
      setSending(false);
    }
  }, [batchId, sendQueue, sending]);

  const sendAllFragments = useCallback(async () => {
    if (!batchId || sendQueue.length === 0 || sending) return;

    setSending(true);
    const queue = [...sendQueue];

    for (const seq of queue) {
      const payload = FRAGMENT_PAYLOADS[seq - 1];
      try {
        const res = await fetch("/api/resequencer/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ batchId, seq, payload }),
        });

        const result = await res.json();
        if (!res.ok) {
          setError(result?.error?.message ?? "Failed to send fragment");
          break;
        }
        setSendQueue((prev) => prev.slice(1));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send fragment");
        break;
      }
      // Small delay between sends for visualization
      await new Promise((r) => setTimeout(r, 400));
    }

    setSending(false);
  }, [batchId, sendQueue, sending]);

  const canSend = status === "waiting" || status === "resequencing";
  const isDone = status === "done";

  const codeState = useMemo(() => {
    const wfMarks: Record<number, GutterMarkKind> = {};
    const stepMarks: Record<number, GutterMarkKind> = {};

    if (status === "idle") {
      return {
        tone: "amber" as HighlightTone,
        workflowActiveLines: [] as number[],
        workflowGutterMarks: wfMarks,
        stepActiveLines: [] as number[],
        stepGutterMarks: stepMarks,
      };
    }

    if (status === "waiting") {
      return {
        tone: "amber" as HighlightTone,
        workflowActiveLines: workflowLineMap.createHooks,
        workflowGutterMarks: wfMarks,
        stepActiveLines: [],
        stepGutterMarks: stepMarks,
      };
    }

    if (status === "resequencing") {
      return {
        tone: "cyan" as HighlightTone,
        workflowActiveLines: workflowLineMap.waitLoop,
        workflowGutterMarks: wfMarks,
        stepActiveLines: stepLineMap.emitStep,
        stepGutterMarks: stepMarks,
      };
    }

    // done
    for (const line of workflowLineMap.returnLine) {
      wfMarks[line] = "success";
    }
    return {
      tone: "green" as HighlightTone,
      workflowActiveLines: workflowLineMap.returnLine,
      workflowGutterMarks: wfMarks,
      stepActiveLines: [],
      stepGutterMarks: stepMarks,
    };
  }, [status, workflowLineMap, stepLineMap]);

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded-lg border border-red-700/40 bg-red-700/10 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-gray-400/70 bg-background-100 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleStart}
            disabled={canSend || sending}
            className="min-h-10 rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start Resequencer
          </button>

          {canSend && (
            <>
              <button
                type="button"
                onClick={sendNextFragment}
                disabled={sendQueue.length === 0 || sending}
                className="min-h-10 rounded-md border border-amber-700/60 bg-amber-700/20 px-4 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-700/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendQueue.length > 0
                  ? `Send Fragment #${sendQueue[0]} ${sending ? "(sending...)" : ""}`
                  : "All Sent"}
              </button>

              <button
                type="button"
                onClick={sendAllFragments}
                disabled={sendQueue.length === 0 || sending}
                className="min-h-10 rounded-md border border-cyan-700/60 bg-cyan-700/20 px-4 py-2 text-sm font-medium text-cyan-700 transition-colors hover:bg-cyan-700/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send All Remaining
              </button>
            </>
          )}

          {runId && (
            <button
              type="button"
              onClick={handleReset}
              className="min-h-10 rounded-md border border-gray-400 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:border-gray-300 hover:text-gray-1000"
            >
              Reset
            </button>
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-gray-400/70 bg-background-200 px-2.5 py-1 text-xs font-mono text-gray-900">
              status: {status}
            </span>
            <span className="rounded-full border border-gray-400/70 bg-background-200 px-2.5 py-1 text-xs font-mono text-gray-900">
              next: #{nextExpected}
            </span>
          </div>
        </div>

        {canSend && sendQueue.length > 0 && (
          <div className="mt-2 rounded-md border border-gray-400/40 bg-background-200 px-3 py-1.5 text-xs text-gray-900">
            Send order: {sendQueue.map((s) => `#${s}`).join(" → ")}
            <span className="ml-2 text-gray-500">(scrambled — fragments arrive out of order)</span>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-400/70 bg-background-100 p-3">
        <p className="mb-2 text-sm text-gray-900" role="status" aria-live="polite">
          {status === "idle" && "Start a run to create hooks for 5 fragments and send them out of order."}
          {status === "waiting" && "Hooks created. Send fragments in scrambled order to see buffering and reordering."}
          {status === "resequencing" && `Resequencing... buffering out-of-order fragments, releasing contiguous output.`}
          {status === "done" && "All fragments received and released in correct order."}
        </p>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <FragmentGrid title="Inbound Fragments" fragments={fragments} />
          <OrderedOutput title="Ordered Output" ordered={ordered} total={EXPECTED_COUNT} />
          <ExecutionLog events={log} elapsedMs={elapsedMs} />
        </div>
      </div>

      <p className="text-center text-xs italic text-gray-900">
        defineHook + buffer + contiguous release → durable ordering recovery without queues
      </p>

      <ResequencerCodeWorkbench
        workflowCode={workflowCode}
        workflowHtmlLines={workflowHtmlLines}
        workflowActiveLines={codeState.workflowActiveLines}
        workflowGutterMarks={codeState.workflowGutterMarks}
        stepCode={stepCode}
        stepHtmlLines={stepHtmlLines}
        stepActiveLines={codeState.stepActiveLines}
        stepGutterMarks={codeState.stepGutterMarks}
        tone={codeState.tone}
      />
    </div>
  );
}

function FragmentGrid({ title, fragments }: { title: string; fragments: FragmentSnapshot[] }) {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-gray-400/60 bg-background-200 p-2">
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-900">{title}</h3>
      <div className="space-y-1">
        {fragments.length === 0 && <p className="px-1 py-0.5 text-xs text-gray-900">No fragments yet.</p>}
        {fragments.map((f) => {
          const tone = fragmentTone(f.state);
          return (
            <div key={f.seq} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${tone.cardClass}`}>
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dotClass}`} aria-hidden="true" />
              <span className="text-sm font-mono font-medium text-gray-1000">#{f.seq}</span>
              <span className="text-xs text-gray-900">{f.payload}</span>
              <span className={`ml-auto rounded-full border px-1.5 py-0.5 text-xs font-semibold uppercase leading-none ${tone.badgeClass}`}>
                {f.state}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderedOutput({ title, ordered, total }: { title: string; ordered: string[]; total: number }) {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-gray-400/60 bg-background-200 p-2">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-900">{title}</h3>
        <span className="text-xs font-mono text-gray-900">{ordered.length}/{total}</span>
      </div>
      <div className="space-y-1">
        {ordered.length === 0 && <p className="px-1 py-0.5 text-xs text-gray-900">Waiting for contiguous fragments...</p>}
        {ordered.map((payload, i) => (
          <div key={`${i}-${payload}`} className="flex items-center gap-2 rounded-md border border-green-700/40 bg-green-700/10 px-2 py-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-700" aria-hidden="true" />
            <span className="text-sm font-mono font-medium text-gray-1000">#{i + 1}</span>
            <span className="text-xs text-gray-1000">{payload}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExecutionLog({ events, elapsedMs }: { events: LogEvent[]; elapsedMs: number }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-gray-400/60 bg-background-200 p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-900">Execution Log</h3>
        <p className="text-xs font-mono tabular-nums text-gray-900">{(elapsedMs / 1000).toFixed(2)}s</p>
      </div>

      <div ref={scrollRef} className="max-h-[200px] min-h-0 flex-1 overflow-y-auto rounded border border-gray-300/70 bg-background-100 p-1">
        {events.length === 0 && <p className="px-1 py-0.5 text-xs text-gray-900">No events yet.</p>}
        {events.map((event, idx) => {
          const tone = logTone(event.kind);
          return (
            <div key={`${event.kind}-${event.atMs}-${idx}`} className="flex items-center gap-2 px-1 py-0.5 text-xs leading-5 text-gray-900">
              <span className={`h-2 w-2 shrink-0 rounded-full ${tone.dotClass}`} aria-hidden="true" />
              <span className={`w-16 shrink-0 font-semibold uppercase ${tone.labelClass}`}>{event.kind}</span>
              <p className="min-w-0 flex-1 truncate">{event.message}</p>
              <span className="shrink-0 font-mono tabular-nums text-gray-900">+{event.atMs}ms</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function fragmentTone(state: FragmentState) {
  switch (state) {
    case "released":
      return {
        dotClass: "bg-green-700",
        badgeClass: "border-green-700/40 bg-green-700/10 text-green-700",
        cardClass: "border-green-700/40 bg-green-700/10",
      };
    case "buffered":
      return {
        dotClass: "bg-amber-700",
        badgeClass: "border-amber-700/40 bg-amber-700/10 text-amber-700",
        cardClass: "border-amber-700/40 bg-amber-700/10",
      };
    case "received":
      return {
        dotClass: "bg-cyan-700",
        badgeClass: "border-cyan-700/40 bg-cyan-700/10 text-cyan-700",
        cardClass: "border-cyan-700/40 bg-cyan-700/10",
      };
    case "pending":
    default:
      return {
        dotClass: "bg-gray-500",
        badgeClass: "border-gray-400/70 bg-background-100 text-gray-900",
        cardClass: "border-gray-400/40 bg-background-100",
      };
  }
}

function logTone(kind: LogEvent["kind"]) {
  switch (kind) {
    case "received":
      return { dotClass: "bg-cyan-700", labelClass: "text-cyan-700" };
    case "buffered":
      return { dotClass: "bg-amber-700", labelClass: "text-amber-700" };
    case "released":
      return { dotClass: "bg-green-700", labelClass: "text-green-700" };
    case "done":
      return { dotClass: "bg-green-700", labelClass: "text-green-700" };
    default:
      return { dotClass: "bg-cyan-700", labelClass: "text-cyan-700" };
  }
}
