// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GatewayCodeWorkbench } from "@/event-gateway/components/gateway-code-workbench";

type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail";

type SignalKind = "payment" | "inventory" | "fraud";
type SignalState = "pending" | "received";

type SignalSnapshot = {
  kind: SignalKind;
  state: SignalState;
  token: string;
};

type LogEvent = {
  kind: "start" | "signal_received" | "all_received" | "shipping" | "shipped" | "timeout";
  message: string;
  atMs: number;
};

type DemoStatus = "idle" | "waiting" | "shipping" | "shipped" | "timeout";

type GatewayWorkflowLineMap = {
  createTokens: number[];
  race: number[];
  ship: number[];
  returnShipped: number[];
  returnTimeout: number[];
};

type GatewayStepLineMap = {
  shipFetch: number[];
};

type Props = {
  workflowCode: string;
  workflowHtmlLines: string[];
  workflowLineMap: GatewayWorkflowLineMap;

  stepCode: string;
  stepHtmlLines: string[];
  stepLineMap: GatewayStepLineMap;
};

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

export function EventGatewayDemo({
  workflowCode,
  workflowHtmlLines,
  workflowLineMap,
  stepCode,
  stepHtmlLines,
  stepLineMap,
}: Props) {
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<DemoStatus>("idle");
  const [signals, setSignals] = useState<SignalSnapshot[]>([]);
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const [log, setLog] = useState<LogEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

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

          switch (event.type) {
            case "waiting":
              setStatus("waiting");
              addLog("start", `Waiting for signals. Timeout: ${event.timeoutMs}ms`);
              break;
            case "signal_received":
              setSignals((prev) =>
                prev.map((s) =>
                  s.kind === event.signal ? { ...s, state: "received" } : s
                )
              );
              addLog("signal_received", `${event.signal} signal received (${event.token})`);
              break;
            case "all_received":
              addLog("all_received", "All signals received");
              break;
            case "shipping":
              setStatus("shipping");
              addLog("shipping", "Shipping order...");
              break;
            case "shipped":
              addLog("shipped", "Order shipped");
              break;
            case "timeout": {
              setStatus("timeout");
              const missing = Array.isArray(event.missing) ? (event.missing as string[]).join(", ") : "unknown";
              addLog("timeout", `Timed out. Missing: ${missing}`);
              break;
            }
            case "done":
              if (event.status === "shipped") setStatus("shipped");
              else if (event.status === "timeout") setStatus("timeout");
              stopTimer();
              break;
          }
        }
      }

      if (buffer.trim()) {
        const event = parseSseChunk(buffer) as { type: string; [key: string]: unknown } | null;
        if (event?.type === "done") {
          if (event.status === "shipped") setStatus("shipped");
          else if (event.status === "timeout") setStatus("timeout");
          stopTimer();
        }
      }
    },
    [addLog, stopTimer]
  );

  const handleStart = useCallback(async () => {
    setError(null);
    stopTimer();
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    startTimeRef.current = Date.now();
    setElapsedMs(0);
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 50);

    try {
      const res = await fetch("/api/event-gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: `ORD-${Date.now()}`, timeoutMs: 6500 }),
        signal: controller.signal,
      });

      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error?.message ?? "Failed to start");
        stopTimer();
        return;
      }

      setRunId(payload.runId);
      setTokens(payload.tokens);
      setStatus("waiting");
      setLog([]);

      // Initialize signal snapshots
      const signalKinds: SignalKind[] = ["payment", "inventory", "fraud"];
      setSignals(
        signalKinds.map((kind) => ({
          kind,
          state: "pending",
          token: payload.tokens[kind],
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
    setStatus("idle");
    setSignals([]);
    setTokens({});
    setLog([]);
    setError(null);
    setElapsedMs(0);
  }, [stopTimer]);

  const sendSignal = useCallback(
    async (kind: SignalKind) => {
      if (!runId || !tokens[kind]) return;

      setError(null);
      try {
        const res = await fetch("/api/signal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: tokens[kind], signal: kind }),
        });

        const payload = await res.json();
        if (!res.ok) {
          setError(payload?.error?.message ?? "Failed to send signal");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send signal");
      }
    },
    [runId, tokens]
  );

  const canSignal = status === "waiting";
  const isDone = status === "shipped" || status === "timeout";

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
        workflowActiveLines: workflowLineMap.race,
        workflowGutterMarks: wfMarks,
        stepActiveLines: [],
        stepGutterMarks: stepMarks,
      };
    }

    if (status === "shipping") {
      return {
        tone: "amber" as HighlightTone,
        workflowActiveLines: workflowLineMap.ship,
        workflowGutterMarks: wfMarks,
        stepActiveLines: stepLineMap.shipFetch,
        stepGutterMarks: stepMarks,
      };
    }

    if (status === "timeout") {
      wfMarks[workflowLineMap.race[0] ?? 1] = "fail";
      return {
        tone: "red" as HighlightTone,
        workflowActiveLines: workflowLineMap.returnTimeout,
        workflowGutterMarks: wfMarks,
        stepActiveLines: [],
        stepGutterMarks: stepMarks,
      };
    }

    // shipped
    wfMarks[workflowLineMap.ship[0] ?? 1] = "success";
    stepMarks[stepLineMap.shipFetch[0] ?? 1] = "success";
    return {
      tone: "green" as HighlightTone,
      workflowActiveLines: workflowLineMap.returnShipped,
      workflowGutterMarks: wfMarks,
      stepActiveLines: [],
      stepGutterMarks: stepMarks,
    };
  }, [status, stepLineMap.shipFetch, workflowLineMap.race, workflowLineMap.returnShipped, workflowLineMap.returnTimeout, workflowLineMap.ship]);

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
            disabled={status === "waiting" || status === "shipping"}
            className="min-h-10 rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start Gateway
          </button>

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
            {runId && (
              <span className="rounded-full bg-background-200 px-2.5 py-1 text-xs font-mono text-gray-900">
                run: {runId.slice(0, 8)}…
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(["payment", "inventory", "fraud"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => sendSignal(kind)}
              disabled={!canSignal || signals.find((s) => s.kind === kind)?.state === "received"}
              className="min-h-9 rounded-md border border-gray-400 bg-background-200 px-3 py-2 text-sm font-medium text-gray-900 transition-colors hover:border-gray-300 hover:text-gray-1000 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send {kind}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-gray-400/70 bg-background-100 p-3">
        <p className="mb-2 text-sm text-gray-900" role="status" aria-live="polite">
          {status === "idle" && "Start a run to generate 3 tokens and wait for signals."}
          {status === "waiting" && "Waiting for payment + inventory + fraud signals..."}
          {status === "shipping" && "All signals received. Shipping step is executing."}
          {status === "shipped" && "Shipped."}
          {status === "timeout" && "Timed out waiting for signals."}
        </p>

        <div className="lg:h-[200px]">
          <div className="grid grid-cols-1 gap-2 lg:h-full lg:grid-cols-2">
            <SignalGrid signals={signals} />
            <ExecutionLog events={log} elapsedMs={elapsedMs} />
          </div>
        </div>
      </div>

      <p className="text-center text-xs italic text-gray-900">
        Promise.all + hooks + deadline → converge signals without cron jobs or queues
      </p>

      <GatewayCodeWorkbench
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

function SignalGrid({ signals }: { signals: SignalSnapshot[] }) {
  if (signals.length === 0) {
    return (
      <div className="h-full min-h-0 rounded-lg border border-gray-400/60 bg-background-200 p-2 text-xs text-gray-900">
        No signals yet.
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto rounded-lg border border-gray-400/60 bg-background-200 p-2">
      <div className="space-y-1">
        {signals.map((signal) => {
          const tone = signalTone(signal.state);
          return (
            <article key={signal.kind} className={`rounded-md border px-2 py-1.5 ${tone.cardClass}`}>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${tone.dotClass}`} aria-hidden="true" />
                <p className="text-sm font-medium text-gray-1000">{signal.kind}</p>
                <span className={`rounded-full border px-1.5 py-0.5 text-xs font-semibold uppercase leading-none ${tone.badgeClass}`}>
                  {signal.state}
                </span>
                <p className="ml-auto text-xs font-mono text-gray-900 truncate">
                  token: {signal.token}
                </p>
              </div>
            </article>
          );
        })}
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
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900">Execution log</h3>
        <p className="text-xs font-mono tabular-nums text-gray-900">{(elapsedMs / 1000).toFixed(2)}s</p>
      </div>

      <div ref={scrollRef} className="max-h-[130px] min-h-0 flex-1 overflow-y-auto rounded border border-gray-300/70 bg-background-100 p-1">
        {events.length === 0 && <p className="px-1 py-0.5 text-sm text-gray-900">No events yet.</p>}
        {events.map((event, idx) => {
          const tone = logTone(event.kind);
          return (
            <div key={`${event.kind}-${event.atMs}-${idx}`} className="flex items-center gap-2 px-1 py-0.5 text-sm leading-5 text-gray-900">
              <span className={`h-2 w-2 rounded-full ${tone.dotClass}`} aria-hidden="true" />
              <span className={`w-24 shrink-0 text-xs font-semibold uppercase ${tone.labelClass}`}>{event.kind}</span>
              <p className="min-w-0 flex-1 truncate">{event.message}</p>
              <span className="shrink-0 font-mono tabular-nums text-gray-900">+{event.atMs}ms</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function signalTone(state: SignalSnapshot["state"]) {
  switch (state) {
    case "received":
      return {
        dotClass: "bg-green-700",
        badgeClass: "border-green-700/40 bg-green-700/10 text-green-700",
        cardClass: "border-green-700/40 bg-green-700/10",
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
    case "signal_received":
      return { dotClass: "bg-green-700", labelClass: "text-green-700" };
    case "all_received":
      return { dotClass: "bg-green-700", labelClass: "text-green-700" };
    case "shipping":
      return { dotClass: "bg-amber-700", labelClass: "text-amber-700" };
    case "shipped":
      return { dotClass: "bg-green-700", labelClass: "text-green-700" };
    case "timeout":
      return { dotClass: "bg-red-700", labelClass: "text-red-700" };
    default:
      return { dotClass: "bg-cyan-700", labelClass: "text-cyan-700" };
  }
}

export type EventGatewayNativeDemoProps = Parameters<typeof EventGatewayDemo>[0];

export default function EventGatewayNativeDemo(props: EventGatewayNativeDemoProps) {
  return <EventGatewayDemo {...props} />;
}
