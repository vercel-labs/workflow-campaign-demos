// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScatterGatherCodeWorkbench } from "@/scatter-gather/app/components/scatter-gather-code-workbench";

type ProviderId = "fedex" | "ups" | "dhl" | "usps";
type RunStatus = "scatter" | "gathering" | "done";
type ProviderStatus = "pending" | "querying" | "quoted" | "failed";
type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail";

type ProviderSnapshot = {
  id: ProviderId;
  label: string;
  status: ProviderStatus;
  price?: number;
  days?: number;
  error?: string;
};

type ScatterGatherSnapshot = {
  runId: string;
  packageId: string;
  status: RunStatus;
  elapsedMs: number;
  providers: ProviderSnapshot[];
  winner: { provider: string; price: number; days: number } | null;
};

type StartResponse = {
  runId: string;
  packageId: string;
  failProviders: ProviderId[];
  status: "scatter";
};

type ProviderEvent =
  | { type: "provider_querying"; provider: string }
  | { type: "provider_quoted"; provider: string; price: number; days: number }
  | { type: "provider_failed"; provider: string; error: string }
  | { type: "gathering" }
  | { type: "done"; winner: { provider: string; price: number; days: number } | null };

type ProviderAccumulator = {
  status: ProviderStatus;
  price?: number;
  days?: number;
  error?: string;
};

type Accumulator = {
  runId: string;
  packageId: string;
  status: RunStatus;
  providers: Record<ProviderId, ProviderAccumulator>;
  winner: { provider: string; price: number; days: number } | null;
};

type WorkflowLineMap = {
  allSettled: number[];
  results: number[];
  returnGather: number[];
};

type StepLineMap = Record<ProviderId, number[]>;
type StepErrorLineMap = Record<ProviderId, number[]>;
type StepSuccessLineMap = Record<ProviderId, number[]>;

type HighlightState = {
  workflowActiveLines: number[];
  stepActiveLines: number[];
  workflowGutterMarks: Record<number, GutterMarkKind>;
  stepGutterMarks: Record<number, GutterMarkKind>;
  activeProvider: ProviderId | null;
};

type DemoProps = {
  workflowCode: string;
  workflowLinesHtml: string[];
  stepCode: string;
  stepLinesHtml: string[];
  workflowLineMap: WorkflowLineMap;
  stepLineMap: StepLineMap;
  stepErrorLineMap: StepErrorLineMap;
  stepSuccessLineMap: StepSuccessLineMap;
};

const ELAPSED_TICK_MS = 120;

const PROVIDER_OPTIONS: Array<{
  id: ProviderId;
  label: string;
  compactLabel: string;
}> = [
  { id: "fedex", label: "FedEx", compactLabel: "FDX" },
  { id: "ups", label: "UPS", compactLabel: "UPS" },
  { id: "dhl", label: "DHL", compactLabel: "DHL" },
  { id: "usps", label: "USPS", compactLabel: "USPS" },
];

const DEFAULTS = {
  packageId: "PKG-7742",
  failProviders: [] as ProviderId[],
};

function isProviderId(value: string): value is ProviderId {
  return value === "fedex" || value === "ups" || value === "dhl" || value === "usps";
}

function createInitialProviders(): Record<ProviderId, ProviderAccumulator> {
  return {
    fedex: { status: "pending" },
    ups: { status: "pending" },
    dhl: { status: "pending" },
    usps: { status: "pending" },
  };
}

function createAccumulator(start: StartResponse): Accumulator {
  return {
    runId: start.runId,
    packageId: start.packageId,
    status: start.status,
    providers: createInitialProviders(),
    winner: null,
  };
}

function applyEvent(current: Accumulator, event: ProviderEvent): Accumulator {
  if (event.type === "gathering") {
    return { ...current, status: "gathering" };
  }

  if (event.type === "done") {
    return { ...current, status: "done", winner: event.winner };
  }

  if (!isProviderId(event.provider)) {
    return current;
  }

  const providers = { ...current.providers };

  if (event.type === "provider_querying") {
    providers[event.provider] = { status: "querying" };
  } else if (event.type === "provider_quoted") {
    providers[event.provider] = {
      status: "quoted",
      price: event.price,
      days: event.days,
    };
  } else if (event.type === "provider_failed") {
    providers[event.provider] = {
      status: "failed",
      error: event.error,
    };
  }

  return { ...current, status: "scatter", providers };
}

function toSnapshot(
  accumulator: Accumulator,
  startedAtMs: number
): ScatterGatherSnapshot {
  const providers: ProviderSnapshot[] = PROVIDER_OPTIONS.map((opt) => {
    const p = accumulator.providers[opt.id];
    return {
      id: opt.id,
      label: opt.label,
      status: p.status,
      price: p.price,
      days: p.days,
      error: p.error,
    };
  });

  return {
    runId: accumulator.runId,
    packageId: accumulator.packageId,
    status: accumulator.status,
    elapsedMs: Math.max(0, Date.now() - startedAtMs),
    providers,
    winner: accumulator.winner,
  };
}

function parseSseData(rawChunk: string): string {
  return rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
}

function parseProviderEvent(rawChunk: string): ProviderEvent | null {
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

  if (type === "provider_querying" && typeof event.provider === "string") {
    return { type, provider: event.provider };
  }

  if (
    type === "provider_quoted" &&
    typeof event.provider === "string" &&
    typeof event.price === "number" &&
    typeof event.days === "number"
  ) {
    return { type, provider: event.provider, price: event.price, days: event.days };
  }

  if (
    type === "provider_failed" &&
    typeof event.provider === "string" &&
    typeof event.error === "string"
  ) {
    return { type, provider: event.provider, error: event.error };
  }

  if (type === "gathering") {
    return { type };
  }

  if (type === "done") {
    const winner = event.winner;
    if (
      winner &&
      typeof winner === "object" &&
      typeof (winner as Record<string, unknown>).provider === "string" &&
      typeof (winner as Record<string, unknown>).price === "number" &&
      typeof (winner as Record<string, unknown>).days === "number"
    ) {
      const w = winner as { provider: string; price: number; days: number };
      return { type, winner: { provider: w.provider, price: w.price, days: w.days } };
    }
    return { type, winner: null };
  }

  return null;
}

const EMPTY_HIGHLIGHT_STATE: HighlightState = {
  workflowActiveLines: [],
  stepActiveLines: [],
  workflowGutterMarks: {},
  stepGutterMarks: {},
  activeProvider: null,
};

function pickActiveProvider(snapshot: ScatterGatherSnapshot): ProviderId | null {
  if (snapshot.status !== "scatter") return null;

  const active = snapshot.providers.filter((p) => p.status === "querying");
  if (active.length === 0) return null;

  return active[0].id;
}

function addGutterMarks(
  target: Record<number, GutterMarkKind>,
  lines: number[],
  kind: GutterMarkKind = "success"
) {
  for (const lineNumber of lines) {
    target[lineNumber] = kind;
  }
}

function mergeUniqueLines(...lineGroups: number[][]): number[] {
  return [...new Set(lineGroups.flat())].sort((a, b) => a - b);
}

function buildHighlightState(
  snapshot: ScatterGatherSnapshot | null,
  workflowLineMap: WorkflowLineMap,
  stepLineMap: StepLineMap,
  stepErrorLineMap: StepErrorLineMap,
  stepSuccessLineMap: StepSuccessLineMap
): HighlightState {
  if (!snapshot) return EMPTY_HIGHLIGHT_STATE;

  const workflowGutterMarks: Record<number, GutterMarkKind> = {};
  const stepGutterMarks: Record<number, GutterMarkKind> = {};

  if (snapshot.status === "scatter") {
    const activeProvider = pickActiveProvider(snapshot);

    for (const provider of snapshot.providers) {
      if (provider.status !== "querying" && provider.status !== "pending") {
        const isFailed = provider.status === "failed";
        addGutterMarks(
          stepGutterMarks,
          isFailed
            ? (stepErrorLineMap[provider.id] ?? [])
            : (stepSuccessLineMap[provider.id] ?? []),
          isFailed ? "fail" : "success"
        );
      }
    }

    return {
      workflowActiveLines: workflowLineMap.allSettled,
      stepActiveLines: activeProvider ? stepLineMap[activeProvider] ?? [] : [],
      workflowGutterMarks,
      stepGutterMarks,
      activeProvider,
    };
  }

  for (const provider of snapshot.providers) {
    if (provider.status === "failed") {
      addGutterMarks(stepGutterMarks, stepErrorLineMap[provider.id] ?? [], "fail");
    } else if (provider.status === "quoted") {
      addGutterMarks(stepGutterMarks, stepSuccessLineMap[provider.id] ?? [], "success");
    }
  }

  if (snapshot.status === "gathering") {
    addGutterMarks(workflowGutterMarks, workflowLineMap.allSettled.slice(0, 1));

    return {
      workflowActiveLines: mergeUniqueLines(
        workflowLineMap.results,
        workflowLineMap.returnGather
      ),
      stepActiveLines: [],
      workflowGutterMarks,
      stepGutterMarks,
      activeProvider: null,
    };
  }

  // done
  addGutterMarks(
    workflowGutterMarks,
    mergeUniqueLines(
      workflowLineMap.allSettled.slice(0, 1),
      workflowLineMap.returnGather
    )
  );

  return {
    workflowActiveLines: [],
    stepActiveLines: [],
    workflowGutterMarks,
    stepGutterMarks,
    activeProvider: null,
  };
}

function highlightToneForSnapshot(snapshot: ScatterGatherSnapshot | null): HighlightTone {
  if (!snapshot || snapshot.status === "scatter") return "amber";
  if (snapshot.status === "gathering") return "cyan";
  return snapshot.winner ? "green" : "red";
}

function formatElapsedMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function buildExecutionLog(snapshot: ScatterGatherSnapshot | null): string[] {
  if (!snapshot) {
    return [
      "Idle: click Get Quotes to start the run.",
      "Promise.allSettled() will scatter requests to all providers in parallel.",
    ];
  }

  const entries: string[] = [
    `[0.00s] package ${snapshot.packageId} queued`,
    "[0.00s] Promise.allSettled() scattered 4 provider queries",
  ];

  for (const provider of snapshot.providers) {
    if (provider.status === "pending") continue;

    if (provider.status === "querying") {
      entries.push(`[${formatElapsedMs(snapshot.elapsedMs)}] ${provider.id} querying...`);
    } else if (provider.status === "quoted") {
      entries.push(
        `[${formatElapsedMs(snapshot.elapsedMs)}] ${provider.id} quoted $${provider.price?.toFixed(2)} (${provider.days}d)`
      );
    } else if (provider.status === "failed") {
      entries.push(
        `[${formatElapsedMs(snapshot.elapsedMs)}] ${provider.id} failed: ${provider.error}`
      );
    }
  }

  if (snapshot.status === "gathering") {
    entries.push(`[${formatElapsedMs(snapshot.elapsedMs)}] gathering: selecting best quote`);
  }

  if (snapshot.status === "done") {
    if (snapshot.winner) {
      entries.push(
        `[${formatElapsedMs(snapshot.elapsedMs)}] winner: ${snapshot.winner.provider} at $${snapshot.winner.price.toFixed(2)} (${snapshot.winner.days}d)`
      );
    } else {
      entries.push(`[${formatElapsedMs(snapshot.elapsedMs)}] no quotes received`);
    }
  }

  return entries;
}

function statusExplanation(
  status: RunStatus | "idle",
  activeProvider: ProviderId | null
): string {
  if (status === "idle") {
    return "Waiting to start. Click Get Quotes to scatter price requests.";
  }
  if (status === "scatter") {
    if (activeProvider) {
      return `Scatter active: tracing ${activeProvider} while all providers respond in parallel.`;
    }
    return "Scatter active: Promise.allSettled() is waiting for every provider to respond.";
  }
  if (status === "gathering") {
    return "Gather active: comparing quotes and selecting the cheapest provider.";
  }
  return "Completed: best quote selected from all provider responses.";
}

function providerColor(status: ProviderStatus): string {
  if (status === "quoted") return "var(--color-green-700)";
  if (status === "failed") return "var(--color-red-700)";
  if (status === "querying") return "var(--color-amber-700)";
  return "var(--color-gray-500)";
}

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

export function ScatterGatherDemo({
  workflowCode,
  workflowLinesHtml,
  stepCode,
  stepLinesHtml,
  workflowLineMap,
  stepLineMap,
  stepErrorLineMap,
  stepSuccessLineMap,
}: DemoProps) {
  const [failProviders, setFailProviders] = useState<ProviderId[]>(DEFAULTS.failProviders);
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ScatterGatherSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const accumulatorRef = useRef<Accumulator | null>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);

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

  useEffect(() => {
    return () => {
      stopElapsedTicker();
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [stopElapsedTicker]);

  const ensureAbortController = useCallback((): AbortController => {
    if (!abortRef.current || abortRef.current.signal.aborted) {
      abortRef.current = new AbortController();
    }
    return abortRef.current;
  }, []);

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
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(
            payload?.error ?? `Readable stream request failed: ${response.status}`
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        const apply = (event: ProviderEvent) => {
          if (signal.aborted || !startedAtRef.current || !accumulatorRef.current) return;

          const next = applyEvent(accumulatorRef.current, event);
          accumulatorRef.current = next;
          setSnapshot(toSnapshot(next, startedAtRef.current));

          if (next.status === "done") {
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
            const event = parseProviderEvent(chunk);
            if (event) apply(event);
          }
        }

        if (!signal.aborted && buffer.trim()) {
          const event = parseProviderEvent(buffer.replaceAll("\r\n", "\n"));
          if (event) apply(event);
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

    stopElapsedTicker();
    abortRef.current?.abort();
    abortRef.current = null;
    startedAtRef.current = null;
    accumulatorRef.current = null;

    try {
      const controller = ensureAbortController();
      const payload = await postJson<StartResponse>(
        "/api/scatter-gather",
        { packageId: DEFAULTS.packageId, failProviders },
        controller.signal
      );
      if (controller.signal.aborted) return;

      const startedAt = Date.now();
      const nextAccumulator = createAccumulator(payload);
      startedAtRef.current = startedAt;
      accumulatorRef.current = nextAccumulator;
      setRunId(payload.runId);
      setSnapshot(toSnapshot(nextAccumulator, startedAt));

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
    setTimeout(() => startButtonRef.current?.focus(), 0);
  };

  const effectiveStatus: RunStatus | "idle" =
    snapshot?.status ?? (runId ? "scatter" : "idle");
  const isRunning = runId !== null && snapshot?.status !== "done";
  const canSelectFailProviders = !isRunning;

  const executionLog = useMemo(() => buildExecutionLog(snapshot), [snapshot]);

  const highlights = useMemo(
    () =>
      buildHighlightState(
        snapshot,
        workflowLineMap,
        stepLineMap,
        stepErrorLineMap,
        stepSuccessLineMap
      ),
    [snapshot, workflowLineMap, stepLineMap, stepErrorLineMap, stepSuccessLineMap]
  );

  const highlightTone = useMemo(() => highlightToneForSnapshot(snapshot), [snapshot]);

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
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                ref={startButtonRef}
                onClick={() => void handleStart()}
                disabled={isRunning}
                className="cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Get Quotes
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

              <div className="flex items-center gap-2 overflow-x-auto rounded-md border border-gray-400/70 bg-background-100 px-2 py-1 text-xs text-gray-900">
                <span className="font-semibold uppercase tracking-wide text-gray-900">
                  Fail
                </span>
                {PROVIDER_OPTIONS.map((provider) => {
                  const checked = failProviders.includes(provider.id);
                  return (
                    <label
                      key={provider.id}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-gray-1000"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!canSelectFailProviders}
                        aria-label={`Fail ${provider.label}`}
                        onChange={(e) => {
                          setFailProviders((prev) =>
                            e.target.checked
                              ? [...prev, provider.id]
                              : prev.filter((p) => p !== provider.id)
                          );
                        }}
                        className="h-3.5 w-3.5 rounded border-gray-400 bg-background-100 text-blue-700 focus:ring-2 focus:ring-blue-700 focus:ring-offset-0 disabled:cursor-not-allowed"
                      />
                      <span>{provider.compactLabel}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div
            className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2 text-xs text-gray-900"
            role="status"
            aria-live="polite"
          >
            {statusExplanation(effectiveStatus, highlights.activeProvider)}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-gray-400 bg-background-100 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-900">
              Workflow Phase
            </span>
            <RunStatusBadge status={effectiveStatus} />
          </div>

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
              <span className="text-gray-900">Settled Providers</span>
              <span className="font-mono text-gray-1000">
                {snapshot
                  ? snapshot.providers.filter(
                      (p) => p.status === "quoted" || p.status === "failed"
                    ).length
                  : 0}
                /4
              </span>
            </div>
          </div>

          {snapshot?.status === "done" && snapshot.winner && (
            <div className="rounded-md border border-green-700/40 bg-green-700/10 px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-green-700 font-medium">Winner</span>
                <code className="font-mono text-xs text-green-700">
                  {snapshot.winner.provider.toUpperCase()} — ${snapshot.winner.price.toFixed(2)} ({snapshot.winner.days}d)
                </code>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ScatterGatherGraph
          providers={snapshot?.providers ?? PROVIDER_OPTIONS.map((o) => ({ ...o, status: "pending" as const }))}
          status={effectiveStatus}
          winner={snapshot?.winner ?? null}
        />
        <ProviderResultsList providers={snapshot?.providers ?? PROVIDER_OPTIONS.map((o) => ({ ...o, status: "pending" as const }))} />
      </div>

      <div className="rounded-md border border-gray-400 bg-background-100 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
          Execution Log
        </p>
        <ol className="space-y-1 font-mono text-xs text-gray-900">
          {executionLog.map((entry, index) => (
            <li key={`${entry}-${index}`}>{entry}</li>
          ))}
        </ol>
      </div>

      <ScatterGatherCodeWorkbench
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

function ScatterGatherGraph({
  providers,
  status,
  winner,
}: {
  providers: ProviderSnapshot[];
  status: RunStatus | "idle";
  winner: { provider: string; price: number; days: number } | null;
}) {
  const nodes: Array<{ id: ProviderId; x: number; y: number; short: string; label: string }> = [
    { id: "fedex", x: 50, y: 44, short: "FDX", label: "FedEx" },
    { id: "ups", x: 270, y: 44, short: "UPS", label: "UPS" },
    { id: "dhl", x: 50, y: 212, short: "DHL", label: "DHL" },
    { id: "usps", x: 270, y: 212, short: "USPS", label: "USPS" },
  ];

  const byId = new Map(providers.map((p) => [p.id, p]));

  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Scatter-Gather Graph
      </p>

      <svg
        viewBox="0 0 320 256"
        role="img"
        aria-label="Scatter-gather graph to four shipping providers"
        className="h-auto w-full"
      >
        <rect x={0} y={0} width={320} height={256} fill="var(--color-background-100)" rx={8} />

        {nodes.map((node) => {
          const p = byId.get(node.id);
          const pStatus = p?.status ?? "pending";
          const color = providerColor(pStatus);
          const isWinner = status === "done" && winner?.provider === node.id;

          return (
            <g key={node.id}>
              <line
                x1={160}
                y1={128}
                x2={node.x}
                y2={node.y}
                stroke={color}
                strokeWidth={isWinner ? 3.5 : 2.5}
                strokeDasharray={pStatus === "querying" ? "6 4" : undefined}
                className={pStatus === "querying" ? "animate-pulse" : undefined}
              />
              <circle
                cx={node.x}
                cy={node.y}
                r={18}
                fill="var(--color-background-200)"
                stroke={color}
                strokeWidth={isWinner ? 3.5 : 2.5}
              />
              <text
                x={node.x}
                y={node.y + 4}
                textAnchor="middle"
                className="fill-gray-1000 font-mono text-xs"
              >
                {node.short}
              </text>
              <text
                x={node.x}
                y={node.y + 30}
                textAnchor="middle"
                className="fill-gray-900 font-mono text-xs"
              >
                {node.label}
              </text>
            </g>
          );
        })}

        <circle
          cx={160}
          cy={128}
          r={26}
          fill="var(--color-background-200)"
          stroke={
            status === "done"
              ? "var(--color-green-700)"
              : status === "scatter" || status === "gathering"
                ? "var(--color-amber-700)"
                : "var(--color-blue-700)"
          }
          strokeWidth={2.5}
          className="transition-colors duration-500"
        />
        <text
          x={160}
          y={132}
          textAnchor="middle"
          className={`font-mono text-xs font-semibold transition-colors duration-500 ${
            status === "done"
              ? "fill-green-700"
              : status === "scatter" || status === "gathering"
                ? "fill-amber-700"
                : "fill-blue-700"
          }`}
        >
          SG
        </text>
      </svg>
    </div>
  );
}

function ProviderResultsList({ providers }: { providers: ProviderSnapshot[] }) {
  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Provider Quotes
      </p>
      <ul className="space-y-2">
        {providers.map((provider) => (
          <li
            key={provider.id}
            className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm text-gray-1000">{provider.label}</span>
              <div className="flex items-center gap-2">
                {provider.status === "quoted" && provider.price !== undefined && (
                  <span className="font-mono text-xs text-green-700">
                    ${provider.price.toFixed(2)} / {provider.days}d
                  </span>
                )}
                <ProviderStatusBadge status={provider.status} />
              </div>
            </div>
            {provider.status === "failed" && provider.error && (
              <p className="mt-1 text-xs text-red-700">{provider.error}</p>
            )}
          </li>
        ))}
      </ul>
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
  if (status === "gathering") {
    return (
      <span className="rounded-full bg-cyan-700/20 px-2 py-0.5 text-xs font-medium text-cyan-700">
        gathering
      </span>
    );
  }
  if (status === "scatter") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        scatter
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-900">
      idle
    </span>
  );
}

function ProviderStatusBadge({ status }: { status: ProviderStatus }) {
  if (status === "quoted") {
    return (
      <span className="rounded-full bg-green-700/20 px-2 py-0.5 text-xs font-medium text-green-700">
        quoted
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="rounded-full bg-red-700/10 px-2 py-0.5 text-xs font-medium text-red-700">
        failed
      </span>
    );
  }
  if (status === "querying") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        querying
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-900">
      pending
    </span>
  );
}

const demoProps = {
  workflowCode: "",
  workflowLinesHtml: [],
  stepCode: "",
  stepLinesHtml: [],
  workflowLineMap: {},
  stepLineMap: {},
  stepErrorLineMap: {},
  stepSuccessLineMap: {},
} as unknown as Parameters<typeof ScatterGatherDemo>[0];

export default function ScatterGatherNativeDemo() {
  return <ScatterGatherDemo {...demoProps} />;
}
