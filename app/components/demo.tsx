"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QueueCodeWorkbench } from "./queue-code-workbench";

type RunStatus = "queued" | "racing" | "done";
type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail" | "retry";

type HedgeEvent =
  | { type: "config"; providers: string[]; query: string }
  | { type: "provider_started"; provider: string }
  | { type: "provider_responded"; provider: string; latencyMs: number }
  | { type: "provider_lost"; provider: string; latencyMs: number }
  | { type: "winner"; provider: string; latencyMs: number; result: string }
  | { type: "done"; winner: string; latencyMs: number; totalProviders: number };

type ProviderState = {
  name: string;
  status: "pending" | "racing" | "responded" | "winner" | "lost";
  latencyMs: number;
  simulatedLatencyMs: number;
};

type HedgeAccumulator = {
  runId: string;
  status: RunStatus;
  query: string;
  providers: ProviderState[];
  winner: string | null;
  winnerLatencyMs: number;
};

type HedgeSnapshot = HedgeAccumulator & {
  elapsedMs: number;
};

type StartResponse = {
  runId: string;
  providerCount: number;
  status: "queued";
};

export type WorkflowLineMap = {
  config: number[];
  race: number[];
  losers: number[];
  done: number[];
};

export type StepLineMap = {
  callProvider: number[];
};

type DemoProps = {
  workflowCode: string;
  workflowLinesHtml: string[];
  stepCode: string;
  stepLinesHtml: string[];
  workflowLineMap: WorkflowLineMap;
  stepLineMap: StepLineMap;
};

type HighlightState = {
  workflowActiveLines: number[];
  stepActiveLines: number[];
  workflowGutterMarks: Record<number, GutterMarkKind>;
  stepGutterMarks: Record<number, GutterMarkKind>;
};

const ELAPSED_TICK_MS = 120;

const SAMPLE_PROVIDERS = [
  { name: "US-East", simulatedLatencyMs: 800 },
  { name: "EU-West", simulatedLatencyMs: 1200 },
  { name: "AP-South", simulatedLatencyMs: 2000 },
];

function parseSseData(rawChunk: string): string {
  return rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
}

function parseHedgeEvent(rawChunk: string): HedgeEvent | null {
  const payload = parseSseData(rawChunk);
  if (!payload) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") return null;

  const event = parsed as Record<string, unknown>;
  const type = event.type;

  if (type === "config" && Array.isArray(event.providers)) {
    return { type, providers: event.providers as string[], query: event.query as string };
  }
  if (type === "provider_started" && typeof event.provider === "string") {
    return { type, provider: event.provider };
  }
  if (type === "provider_responded" && typeof event.provider === "string") {
    return { type, provider: event.provider, latencyMs: event.latencyMs as number };
  }
  if (type === "provider_lost" && typeof event.provider === "string") {
    return { type, provider: event.provider, latencyMs: event.latencyMs as number };
  }
  if (type === "winner" && typeof event.provider === "string") {
    return { type, provider: event.provider, latencyMs: event.latencyMs as number, result: event.result as string };
  }
  if (type === "done" && typeof event.winner === "string") {
    return { type, winner: event.winner, latencyMs: event.latencyMs as number, totalProviders: event.totalProviders as number };
  }

  return null;
}

function createAccumulator(start: StartResponse): HedgeAccumulator {
  return {
    runId: start.runId,
    status: "queued",
    query: "",
    providers: SAMPLE_PROVIDERS.map((p) => ({
      name: p.name,
      status: "pending",
      latencyMs: 0,
      simulatedLatencyMs: p.simulatedLatencyMs,
    })),
    winner: null,
    winnerLatencyMs: 0,
  };
}

function applyHedgeEvent(current: HedgeAccumulator, event: HedgeEvent): HedgeAccumulator {
  switch (event.type) {
    case "config":
      return {
        ...current,
        query: event.query,
        providers: event.providers.map((name) => {
          const existing = current.providers.find((p) => p.name === name);
          return existing ?? { name, status: "pending", latencyMs: 0, simulatedLatencyMs: 0 };
        }),
      };
    case "provider_started":
      return {
        ...current,
        status: "racing",
        providers: current.providers.map((p) =>
          p.name === event.provider ? { ...p, status: "racing" } : p
        ),
      };
    case "provider_responded":
      return {
        ...current,
        providers: current.providers.map((p) =>
          p.name === event.provider ? { ...p, status: "responded", latencyMs: event.latencyMs } : p
        ),
      };
    case "provider_lost":
      return {
        ...current,
        providers: current.providers.map((p) =>
          p.name === event.provider ? { ...p, status: "lost", latencyMs: event.latencyMs } : p
        ),
      };
    case "winner":
      return {
        ...current,
        winner: event.provider,
        winnerLatencyMs: event.latencyMs,
        providers: current.providers.map((p) =>
          p.name === event.provider ? { ...p, status: "winner", latencyMs: event.latencyMs } : p
        ),
      };
    case "done":
      return { ...current, status: "done" };
  }
}

function toSnapshot(accumulator: HedgeAccumulator, startedAtMs: number): HedgeSnapshot {
  return {
    ...accumulator,
    elapsedMs: Math.max(0, Date.now() - startedAtMs),
  };
}

const EMPTY_HIGHLIGHT_STATE: HighlightState = {
  workflowActiveLines: [],
  stepActiveLines: [],
  workflowGutterMarks: {},
  stepGutterMarks: {},
};

function buildHighlightState(
  snapshot: HedgeSnapshot | null,
  workflowLineMap: WorkflowLineMap,
  stepLineMap: StepLineMap
): HighlightState {
  if (!snapshot) return EMPTY_HIGHLIGHT_STATE;

  const workflowGutterMarks: Record<number, GutterMarkKind> = {};
  const stepGutterMarks: Record<number, GutterMarkKind> = {};

  if (snapshot.status === "racing") {
    return {
      workflowActiveLines: workflowLineMap.race,
      stepActiveLines: stepLineMap.callProvider,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (snapshot.status === "done") {
    for (const line of workflowLineMap.done.slice(0, 1)) {
      workflowGutterMarks[line] = "success";
    }
    for (const line of stepLineMap.callProvider.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }

    return {
      workflowActiveLines: [],
      stepActiveLines: [],
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  return EMPTY_HIGHLIGHT_STATE;
}

function highlightToneForSnapshot(snapshot: HedgeSnapshot | null): HighlightTone {
  if (!snapshot) return "amber";
  if (snapshot.status === "racing") return "cyan";
  return "green";
}

type LogTone = "default" | "green" | "amber" | "red" | "cyan";
type LogEntry = { text: string; tone: LogTone };

function formatElapsedMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function eventToLogEntry(event: HedgeEvent, elapsedMs: number): LogEntry {
  const ts = formatElapsedMs(elapsedMs);

  switch (event.type) {
    case "config":
      return { text: `[${ts}] hedge configured — query:"${event.query}" providers:${event.providers.join(",")}`, tone: "default" };
    case "provider_started":
      return { text: `[${ts}] ${event.provider} started racing`, tone: "cyan" };
    case "provider_responded":
      return { text: `[${ts}] ${event.provider} responded in ${event.latencyMs}ms`, tone: "amber" };
    case "provider_lost":
      return { text: `[${ts}] ${event.provider} lost (${event.latencyMs}ms) — response discarded`, tone: "red" };
    case "winner":
      return { text: `[${ts}] ${event.provider} wins! ${event.latencyMs}ms — "${event.result}"`, tone: "green" };
    case "done":
      return { text: `[${ts}] done — winner:${event.winner} latency:${event.latencyMs}ms providers:${event.totalProviders}`, tone: "green" };
  }
}

const IDLE_LOG: LogEntry[] = [
  { text: "Idle: click Race Providers to send the same request to multiple providers.", tone: "default" },
  { text: "The fastest response wins — slower providers are discarded.", tone: "default" },
];

const LOG_TONE_CLASS: Record<LogTone, string> = {
  default: "text-gray-900",
  green: "text-green-700",
  amber: "text-amber-700",
  red: "text-red-700",
  cyan: "text-cyan-700",
};

async function postJson<TResponse>(
  url: string,
  body: unknown,
  signal?: AbortSignal
): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed: ${response.status}`);
  }

  return payload as TResponse;
}

function statusExplanation(
  status: RunStatus | "idle",
  winner: string | null,
  providerCount: number
): string {
  if (status === "idle") {
    return "Waiting to start. Click Race Providers to send parallel requests.";
  }
  if (status === "racing") {
    return `Racing ${providerCount} providers — waiting for the fastest response...`;
  }
  return `Completed: ${winner} won the race out of ${providerCount} providers.`;
}

export function HedgeRequestDemo({
  workflowCode,
  workflowLinesHtml,
  stepCode,
  stepLinesHtml,
  workflowLineMap,
  stepLineMap,
}: DemoProps) {
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<HedgeSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<LogEntry[]>(IDLE_LOG);

  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const accumulatorRef = useRef<HedgeAccumulator | null>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const hasScrolledRef = useRef(false);

  useEffect(() => {
    if (runId && !hasScrolledRef.current) {
      hasScrolledRef.current = true;
      const heading = document.getElementById("try-it-heading");
      if (heading) {
        const top = heading.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top, behavior: "smooth" });
      }
    }
    if (!runId) {
      hasScrolledRef.current = false;
    }
  }, [runId]);

  const stopElapsedTicker = useCallback(() => {
    if (!elapsedRef.current) return;
    clearInterval(elapsedRef.current);
    elapsedRef.current = null;
  }, []);

  const startElapsedTicker = useCallback(() => {
    stopElapsedTicker();
    elapsedRef.current = setInterval(() => {
      const startedAtMs = startedAtRef.current;
      if (!startedAtMs) return;
      setSnapshot((previous) => {
        if (!previous || previous.status === "done") return previous;
        return { ...previous, elapsedMs: Math.max(0, Date.now() - startedAtMs) };
      });
    }, ELAPSED_TICK_MS);
  }, [stopElapsedTicker]);

  const ensureAbortController = useCallback((): AbortController => {
    if (!abortRef.current || abortRef.current.signal.aborted) {
      abortRef.current = new AbortController();
    }
    return abortRef.current;
  }, []);

  useEffect(() => {
    return () => {
      stopElapsedTicker();
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [stopElapsedTicker]);

  const connectToReadable = useCallback(
    async (start: StartResponse) => {
      const controller = ensureAbortController();
      const signal = controller.signal;

      try {
        const response = await fetch(
          `/api/readable/${encodeURIComponent(start.runId)}`,
          { cache: "no-store", signal }
        );

        if (signal.aborted) return;

        if (!response.ok || !response.body) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? `Readable stream request failed: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const applyEvent = (event: HedgeEvent) => {
          if (signal.aborted || !startedAtRef.current || !accumulatorRef.current) return;
          const elapsedMs = Math.max(0, Date.now() - startedAtRef.current);
          const nextAccumulator = applyHedgeEvent(accumulatorRef.current, event);
          accumulatorRef.current = nextAccumulator;
          setSnapshot(toSnapshot(nextAccumulator, startedAtRef.current));
          setEventLog((prev) => [...prev, eventToLogEntry(event, elapsedMs)]);
          if (nextAccumulator.status === "done") {
            stopElapsedTicker();
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const normalized = buffer.replaceAll("\r\n", "\n");
          const chunks = normalized.split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const chunk of chunks) {
            if (signal.aborted) return;
            const event = parseHedgeEvent(chunk);
            if (event) applyEvent(event);
          }
        }

        if (!signal.aborted && buffer.trim()) {
          const event = parseHedgeEvent(buffer.replaceAll("\r\n", "\n"));
          if (event) applyEvent(event);
        }
      } catch (cause: unknown) {
        if (cause instanceof Error && cause.name === "AbortError") return;
        if (signal.aborted) return;
        const detail = cause instanceof Error ? cause.message : "Readable stream failed";
        setError(detail);
        stopElapsedTicker();
      } finally {
        if (accumulatorRef.current?.status === "done") {
          stopElapsedTicker();
        }
      }
    },
    [ensureAbortController, stopElapsedTicker]
  );

  const handleStart = async () => {
    setError(null);
    setSnapshot(null);
    setRunId(null);
    setEventLog([]);

    stopElapsedTicker();
    abortRef.current?.abort();
    abortRef.current = null;
    startedAtRef.current = null;
    accumulatorRef.current = null;

    try {
      const controller = ensureAbortController();
      const payload = await postJson<StartResponse>(
        "/api/hedge-request",
        { query: "translate greeting", providers: SAMPLE_PROVIDERS },
        controller.signal
      );
      if (controller.signal.aborted) return;

      const startedAt = Date.now();
      const nextAccumulator = createAccumulator(payload);
      startedAtRef.current = startedAt;
      accumulatorRef.current = nextAccumulator;
      setRunId(payload.runId);
      setSnapshot(toSnapshot(nextAccumulator, startedAt));
      setEventLog([
        { text: `[0.00s] hedged request sent to ${payload.providerCount} providers`, tone: "default" },
      ]);

      if (controller.signal.aborted) return;

      startElapsedTicker();
      void connectToReadable(payload);
    } catch (cause: unknown) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      const detail = cause instanceof Error ? cause.message : "Unknown error";
      setError(detail);
    }
  };

  const handleReset = () => {
    stopElapsedTicker();
    abortRef.current?.abort();
    abortRef.current = null;
    startedAtRef.current = null;
    accumulatorRef.current = null;
    setRunId(null);
    setSnapshot(null);
    setError(null);
    setEventLog(IDLE_LOG);
    setTimeout(() => { startButtonRef.current?.focus(); }, 0);
  };

  const effectiveStatus: RunStatus | "idle" = snapshot?.status ?? (runId ? "queued" : "idle");
  const isRunning = runId !== null && snapshot?.status !== "done";

  const highlights = useMemo(
    () => buildHighlightState(snapshot, workflowLineMap, stepLineMap),
    [snapshot, workflowLineMap, stepLineMap]
  );
  const highlightTone = useMemo(
    () => highlightToneForSnapshot(snapshot),
    [snapshot]
  );

  return (
    <div className="space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-700/40 bg-red-700/10 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-gray-400 bg-background-100 p-4">
          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
              Provider Race
            </p>
            <ul className="space-y-1.5">
              {(snapshot?.providers ?? SAMPLE_PROVIDERS.map((p) => ({
                name: p.name,
                status: "pending" as const,
                latencyMs: 0,
                simulatedLatencyMs: p.simulatedLatencyMs,
              }))).map((provider) => (
                <li
                  key={provider.name}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
                    provider.status === "winner"
                      ? "border-green-700/40 bg-green-700/10 text-gray-1000"
                      : provider.status === "lost"
                        ? "border-red-700/40 bg-red-700/10 text-gray-1000 opacity-60"
                        : provider.status === "racing"
                          ? "border-cyan-700/40 bg-cyan-700/10 text-gray-1000"
                          : provider.status === "responded"
                            ? "border-amber-700/40 bg-amber-700/10 text-gray-1000"
                            : "border-gray-400/70 bg-background-100 text-gray-900"
                  }`}
                >
                  <span className="font-mono text-xs text-gray-900">{provider.name}</span>
                  <span className="flex-1">
                    <LatencyBar
                      latencyMs={provider.simulatedLatencyMs}
                      maxLatencyMs={2000}
                      status={provider.status}
                    />
                  </span>
                  {provider.status === "winner" && <span className="text-xs text-green-700">Winner</span>}
                  {provider.status === "lost" && <span className="text-xs text-red-700 line-through">Lost</span>}
                  {provider.status === "racing" && <span className="text-xs text-cyan-700 animate-pulse">racing</span>}
                  {provider.status === "responded" && <span className="text-xs text-amber-700">{provider.latencyMs}ms</span>}
                  {provider.status === "pending" && <span className="text-xs text-gray-900">{provider.simulatedLatencyMs}ms</span>}
                </li>
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                ref={startButtonRef}
                onClick={() => { void handleStart(); }}
                disabled={isRunning}
                className="cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Race Providers
              </button>

              <button
                type="button"
                onClick={handleReset}
                disabled={!runId}
                className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                  runId
                    ? "cursor-pointer border-gray-400 text-gray-900 hover:border-gray-300 hover:text-gray-1000"
                    : "invisible border-transparent"
                }`}
              >
                Reset Demo
              </button>
            </div>
          </div>

          <div
            className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2 text-xs text-gray-900"
            role="status"
            aria-live="polite"
          >
            {statusExplanation(
              effectiveStatus,
              snapshot?.winner ?? null,
              snapshot?.providers.length ?? SAMPLE_PROVIDERS.length
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-gray-400 bg-background-100 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-900">
              Race Summary
            </span>
            <RunStatusBadge status={effectiveStatus} />
          </div>

          <LatencyComparison
            providers={snapshot?.providers ?? SAMPLE_PROVIDERS.map((p) => ({
              name: p.name,
              status: "pending" as const,
              latencyMs: 0,
              simulatedLatencyMs: p.simulatedLatencyMs,
            }))}
            winner={snapshot?.winner ?? null}
          />

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">runId</span>
              <code className="font-mono text-xs text-gray-1000">
                {runId ?? "not started"}
              </code>
            </div>
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">Query</span>
              <code className="font-mono text-xs text-gray-1000">
                {snapshot?.query || "translate greeting"}
              </code>
            </div>
          </div>

          {snapshot?.status === "done" && snapshot.winner && (
            <div className="rounded-md border border-green-700/40 bg-green-700/10 px-3 py-2">
              <p className="text-xs text-green-700">
                {snapshot.winner} won the race in {snapshot.winnerLatencyMs}ms — {snapshot.providers.length - 1} slower responses discarded
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-md border border-gray-400 bg-background-100 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
          Execution Log
        </p>
        <ol className="space-y-1 font-mono text-xs">
          {eventLog.map((entry, index) => (
            <li key={`${entry.text}-${index}`} className={LOG_TONE_CLASS[entry.tone]}>{entry.text}</li>
          ))}
        </ol>
      </div>

      <p className="text-center text-xs italic text-gray-900">
        Hedge Request: send the same request to multiple providers concurrently — use the fastest response, discard the rest.
      </p>

      <QueueCodeWorkbench
        workflowCode={workflowCode}
        workflowLinesHtml={workflowLinesHtml}
        workflowActiveLines={highlights.workflowActiveLines}
        workflowGutterMarks={highlights.workflowGutterMarks}
        stepCode={stepCode}
        stepLinesHtml={stepLinesHtml}
        stepActiveLines={highlights.stepActiveLines}
        stepGutterMarks={highlights.stepGutterMarks}
        tone={highlightTone}
      />
    </div>
  );
}

function LatencyBar({
  latencyMs,
  maxLatencyMs,
  status,
}: {
  latencyMs: number;
  maxLatencyMs: number;
  status: ProviderState["status"];
}) {
  const widthPercent = Math.min(100, (latencyMs / maxLatencyMs) * 100);

  const barColor =
    status === "winner"
      ? "bg-green-700"
      : status === "lost"
        ? "bg-red-700/50"
        : status === "racing"
          ? "bg-cyan-700 animate-pulse"
          : status === "responded"
            ? "bg-amber-700"
            : "bg-gray-500";

  return (
    <div className="h-2 w-full rounded-full bg-background-100">
      <div
        className={`h-2 rounded-full transition-all duration-500 ${barColor}`}
        style={{ width: `${widthPercent}%` }}
      />
    </div>
  );
}

function LatencyComparison({
  providers,
  winner,
}: {
  providers: ProviderState[];
  winner: string | null;
}) {
  const maxLatency = Math.max(...providers.map((p) => p.simulatedLatencyMs), 1);

  return (
    <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-3">
      <p className="mb-2 text-xs text-gray-900">Latency Comparison</p>
      <div className="space-y-2">
        {providers.map((p) => {
          const widthPercent = Math.min(100, (p.simulatedLatencyMs / maxLatency) * 100);
          const isWinner = p.name === winner;

          return (
            <div key={p.name} className="flex items-center gap-2">
              <span className={`w-16 font-mono text-xs ${isWinner ? "text-green-700 font-medium" : "text-gray-900"}`}>
                {p.name}
              </span>
              <div className="flex-1 h-4 rounded bg-background-100">
                <div
                  className={`h-4 rounded transition-all duration-500 flex items-center justify-end pr-1 ${
                    isWinner ? "bg-green-700/30 border border-green-700" : p.status === "lost" ? "bg-red-700/20 border border-red-700/40" : "bg-gray-500/20 border border-gray-500/40"
                  }`}
                  style={{ width: `${widthPercent}%` }}
                >
                  <span className={`text-[10px] font-mono ${isWinner ? "text-green-700" : "text-gray-900"}`}>
                    {p.simulatedLatencyMs}ms
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RunStatusBadge({ status }: { status: RunStatus | "idle" }) {
  if (status === "done") {
    return (
      <span className="rounded-full bg-green-700/20 px-2 py-0.5 text-xs font-medium text-green-700">
        done
      </span>
    );
  }
  if (status === "racing" || status === "queued") {
    return (
      <span className="rounded-full bg-cyan-700/20 px-2 py-0.5 text-xs font-medium text-cyan-700">
        racing
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-900">
      idle
    </span>
  );
}
