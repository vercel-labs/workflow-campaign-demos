// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DetourCodeWorkbench } from "@/detour/app/components/detour-code-workbench";

type PipelineStep = "build" | "lint" | "qa-review" | "staging-test" | "security-scan" | "deploy";
type RunStatus = "deploying" | "building" | "detour" | "done";
type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail" | "retry";

type DetourEvent =
  | { type: "pipeline_started"; deployId: string; qaMode: boolean }
  | { type: "step_running"; deployId: string; step: string }
  | { type: "step_complete"; deployId: string; step: string; result: string }
  | { type: "detour_entered"; deployId: string }
  | { type: "detour_exited"; deployId: string }
  | { type: "done"; deployId: string; totalSteps: number; qaMode: boolean };

type DetourAccumulator = {
  runId: string;
  deployId: string;
  qaMode: boolean;
  status: RunStatus;
  completedSteps: Array<{ step: string; result: string }>;
  currentStep: string | null;
  inDetour: boolean;
  totalSteps: number | null;
};

type DetourSnapshot = DetourAccumulator & {
  elapsedMs: number;
};

type StartResponse = {
  runId: string;
  deployId: string;
  qaMode: boolean;
  status: "deploying";
};

export type WorkflowLineMap = {
  build: number[];
  lint: number[];
  qaDetour: number[];
  deploy: number[];
  done: number[];
};

export type StepLineMap = {
  runBuild: number[];
  runLint: number[];
  runQaDetour: number[];
  runDeploy: number[];
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

const QA_STEPS = new Set<string>(["qa-review", "staging-test", "security-scan"]);

const STEP_LABELS: Record<string, string> = {
  build: "Build",
  lint: "Lint",
  "qa-review": "QA Review",
  "staging-test": "Staging Test",
  "security-scan": "Security Scan",
  deploy: "Deploy",
};

function parseSseData(rawChunk: string): string {
  return rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
}

export function parseDetourEvent(rawChunk: string): DetourEvent | null {
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

  if (type === "pipeline_started" && typeof event.deployId === "string" && typeof event.qaMode === "boolean") {
    return { type, deployId: event.deployId, qaMode: event.qaMode };
  }
  if (type === "step_running" && typeof event.deployId === "string" && typeof event.step === "string") {
    return { type, deployId: event.deployId, step: event.step };
  }
  if (type === "step_complete" && typeof event.deployId === "string" && typeof event.step === "string" && typeof event.result === "string") {
    return { type, deployId: event.deployId, step: event.step, result: event.result };
  }
  if (type === "detour_entered" && typeof event.deployId === "string") {
    return { type, deployId: event.deployId };
  }
  if (type === "detour_exited" && typeof event.deployId === "string") {
    return { type, deployId: event.deployId };
  }
  if (type === "done" && typeof event.deployId === "string" && typeof event.totalSteps === "number" && typeof event.qaMode === "boolean") {
    return { type, deployId: event.deployId, totalSteps: event.totalSteps, qaMode: event.qaMode };
  }

  return null;
}

export function createAccumulator(start: StartResponse): DetourAccumulator {
  return {
    runId: start.runId,
    deployId: start.deployId,
    qaMode: start.qaMode,
    status: "deploying",
    completedSteps: [],
    currentStep: null,
    inDetour: false,
    totalSteps: null,
  };
}

export function applyDetourEvent(current: DetourAccumulator, event: DetourEvent): DetourAccumulator {
  switch (event.type) {
    case "pipeline_started":
      return { ...current, status: "building" };
    case "step_running":
      return { ...current, currentStep: event.step };
    case "step_complete":
      return {
        ...current,
        completedSteps: [...current.completedSteps, { step: event.step, result: event.result }],
        currentStep: null,
      };
    case "detour_entered":
      return { ...current, status: "detour", inDetour: true };
    case "detour_exited":
      return { ...current, status: "building", inDetour: false };
    case "done":
      return { ...current, status: "done", totalSteps: event.totalSteps };
  }
}

function toSnapshot(accumulator: DetourAccumulator, startedAtMs: number): DetourSnapshot {
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
  snapshot: DetourSnapshot | null,
  workflowLineMap: WorkflowLineMap,
  stepLineMap: StepLineMap
): HighlightState {
  if (!snapshot) return EMPTY_HIGHLIGHT_STATE;

  const workflowGutterMarks: Record<number, GutterMarkKind> = {};
  const stepGutterMarks: Record<number, GutterMarkKind> = {};

  const completedStepNames = new Set(snapshot.completedSteps.map((s) => s.step));

  // Mark completed steps in gutter
  if (completedStepNames.has("build")) {
    for (const line of stepLineMap.runBuild.slice(0, 1)) stepGutterMarks[line] = "success";
  }
  if (completedStepNames.has("lint")) {
    for (const line of stepLineMap.runLint.slice(0, 1)) stepGutterMarks[line] = "success";
  }
  if (completedStepNames.has("deploy")) {
    for (const line of stepLineMap.runDeploy.slice(0, 1)) stepGutterMarks[line] = "success";
  }
  if (completedStepNames.has("security-scan")) {
    for (const line of stepLineMap.runQaDetour.slice(0, 1)) stepGutterMarks[line] = "success";
  }

  if (snapshot.status === "done") {
    for (const line of workflowLineMap.done.slice(0, 1)) workflowGutterMarks[line] = "success";
    return {
      workflowActiveLines: [],
      stepActiveLines: [],
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  const currentStep = snapshot.currentStep;

  if (currentStep === "build") {
    return {
      workflowActiveLines: workflowLineMap.build,
      stepActiveLines: stepLineMap.runBuild,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (currentStep === "lint") {
    return {
      workflowActiveLines: workflowLineMap.lint,
      stepActiveLines: stepLineMap.runLint,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (currentStep && QA_STEPS.has(currentStep)) {
    return {
      workflowActiveLines: workflowLineMap.qaDetour,
      stepActiveLines: stepLineMap.runQaDetour,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (currentStep === "deploy") {
    return {
      workflowActiveLines: workflowLineMap.deploy,
      stepActiveLines: stepLineMap.runDeploy,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  // In between steps — show detour block if in detour
  if (snapshot.inDetour) {
    return {
      workflowActiveLines: workflowLineMap.qaDetour,
      stepActiveLines: stepLineMap.runQaDetour,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  return { ...EMPTY_HIGHLIGHT_STATE, workflowGutterMarks, stepGutterMarks };
}

function highlightToneForSnapshot(snapshot: DetourSnapshot | null): HighlightTone {
  if (!snapshot) return "amber";
  if (snapshot.inDetour) return "cyan";
  if (snapshot.status === "done") return "green";
  return "amber";
}

type LogTone = "default" | "green" | "amber" | "red" | "cyan";
type LogEntry = { text: string; tone: LogTone };

function formatElapsedMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function eventToLogEntry(event: DetourEvent, elapsedMs: number): LogEntry {
  const ts = formatElapsedMs(elapsedMs);

  switch (event.type) {
    case "pipeline_started":
      return { text: `[${ts}] pipeline started — qaMode: ${event.qaMode}`, tone: "default" };
    case "step_running":
      return {
        text: `[${ts}] running: ${STEP_LABELS[event.step] ?? event.step}`,
        tone: QA_STEPS.has(event.step) ? "cyan" : "amber",
      };
    case "step_complete":
      return { text: `[${ts}] ${event.result}`, tone: "green" };
    case "detour_entered":
      return { text: `[${ts}] detour entered — QA stages starting`, tone: "cyan" };
    case "detour_exited":
      return { text: `[${ts}] detour exited — resuming main pipeline`, tone: "cyan" };
    case "done":
      return { text: `[${ts}] done — ${event.totalSteps} steps completed (qaMode: ${event.qaMode})`, tone: "green" };
  }
}

const IDLE_LOG: LogEntry[] = [
  { text: "Idle: toggle QA mode and start a deployment.", tone: "default" },
  { text: "The detour conditionally adds QA review stages to the pipeline.", tone: "default" },
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
  inDetour: boolean
): string {
  if (status === "idle") {
    return "Waiting to start. Toggle QA mode and press Deploy to run the workflow.";
  }
  if (status === "building" && !inDetour) {
    return "Running: executing main pipeline steps (build, lint, deploy).";
  }
  if (status === "detour" || inDetour) {
    return "Detour: QA mode enabled — running additional QA review, staging test, and security scan.";
  }
  return "Completed: deployment pipeline finished.";
}

let deployCounter = 0;

export function DetourDemo({
  workflowCode,
  workflowLinesHtml,
  stepCode,
  stepLinesHtml,
  workflowLineMap,
  stepLineMap,
}: DemoProps) {
  const [qaMode, setQaMode] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<DetourSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<LogEntry[]>(IDLE_LOG);

  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const accumulatorRef = useRef<DetourAccumulator | null>(null);
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

        const applyEvent = (event: DetourEvent) => {
          if (signal.aborted || !startedAtRef.current || !accumulatorRef.current) return;
          const elapsedMs = Math.max(0, Date.now() - startedAtRef.current);
          const nextAccumulator = applyDetourEvent(accumulatorRef.current, event);
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
            const event = parseDetourEvent(chunk);
            if (event) applyEvent(event);
          }
        }

        if (!signal.aborted && buffer.trim()) {
          const event = parseDetourEvent(buffer.replaceAll("\r\n", "\n"));
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

    deployCounter += 1;
    const deployId = `DEPLOY-${String(deployCounter).padStart(3, "0")}`;

    try {
      const controller = ensureAbortController();
      const payload = await postJson<StartResponse>(
        "/api/detour",
        { deployId, qaMode },
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
        { text: `[0.00s] deployment ${deployId} submitted (qaMode: ${qaMode})`, tone: "default" },
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

  const effectiveStatus: RunStatus | "idle" = snapshot?.status ?? (runId ? "deploying" : "idle");
  const isRunning = runId !== null && snapshot?.status !== "done";

  const highlights = useMemo(
    () => buildHighlightState(snapshot, workflowLineMap, stepLineMap),
    [snapshot, workflowLineMap, stepLineMap]
  );
  const highlightTone = useMemo(
    () => highlightToneForSnapshot(snapshot),
    [snapshot]
  );

  const directSteps: PipelineStep[] = ["build", "lint", "deploy"];
  const detourSteps: PipelineStep[] = ["build", "lint", "qa-review", "staging-test", "security-scan", "deploy"];
  const visibleSteps = qaMode ? detourSteps : directSteps;

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
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-900">
              Deployment Config
            </p>

            <label className="flex cursor-pointer items-center gap-3">
              <span
                role="switch"
                aria-checked={qaMode}
                tabIndex={0}
                onClick={() => { if (!isRunning) setQaMode((prev) => !prev); }}
                onKeyDown={(e) => { if (!isRunning && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setQaMode((prev) => !prev); } }}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                  isRunning ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                } ${qaMode ? "bg-cyan-700" : "bg-gray-500"}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    qaMode ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </span>
              <span className="text-sm text-gray-1000">
                QA Mode {qaMode ? "ON" : "OFF"}
              </span>
            </label>

            <p className="mt-2 text-xs text-gray-900">
              {qaMode
                ? "Pipeline detours through QA review, staging test, and security scan before deploying."
                : "Pipeline runs direct path: build, lint, deploy."}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                ref={startButtonRef}
                onClick={() => { void handleStart(); }}
                disabled={isRunning}
                className="cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Deploy
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
            {statusExplanation(effectiveStatus, snapshot?.inDetour ?? false)}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-gray-400 bg-background-100 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-900">
              Pipeline Status
            </span>
            <RunStatusBadge status={effectiveStatus} inDetour={snapshot?.inDetour ?? false} />
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
              <span className="text-gray-900">QA Mode</span>
              <span className={`font-mono text-xs ${snapshot?.qaMode ? "text-cyan-700" : "text-gray-1000"}`}>
                {snapshot ? (snapshot.qaMode ? "enabled" : "disabled") : "pending"}
              </span>
            </div>
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">Steps Completed</span>
              <span className="font-mono text-gray-1000">
                {snapshot?.completedSteps.length ?? 0}
                {snapshot?.totalSteps ? ` / ${snapshot.totalSteps}` : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DetourGraph
          qaMode={snapshot?.qaMode ?? qaMode}
          status={effectiveStatus}
          currentStep={snapshot?.currentStep ?? null}
          completedSteps={new Set(snapshot?.completedSteps.map((s) => s.step) ?? [])}
          inDetour={snapshot?.inDetour ?? false}
        />
        <PipelineStepsList
          visibleSteps={visibleSteps}
          completedSteps={snapshot?.completedSteps ?? []}
          currentStep={snapshot?.currentStep ?? null}
          status={effectiveStatus}
        />
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
        Detour: conditionally add processing stages to a fixed pipeline via a runtime toggle.
      </p>

      <DetourCodeWorkbench
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

function DetourGraph({
  qaMode,
  status,
  currentStep,
  completedSteps,
  inDetour,
}: {
  qaMode: boolean;
  status: RunStatus | "idle";
  currentStep: string | null;
  completedSteps: Set<string>;
  inDetour: boolean;
}) {
  const nodes: Array<{ id: string; x: number; y: number; label: string; isDetour: boolean }> = [
    { id: "build", x: 50, y: 70, label: "Build", isDetour: false },
    { id: "lint", x: 130, y: 70, label: "Lint", isDetour: false },
    ...(qaMode
      ? [
          { id: "qa-review", x: 100, y: 170, label: "QA Review", isDetour: true },
          { id: "staging-test", x: 180, y: 170, label: "Staging", isDetour: true },
          { id: "security-scan", x: 260, y: 170, label: "Security", isDetour: true },
        ]
      : []),
    { id: "deploy", x: qaMode ? 310 : 210, y: 70, label: "Deploy", isDetour: false },
  ];

  const edges: Array<{ from: string; to: string }> = [
    { from: "build", to: "lint" },
    ...(qaMode
      ? [
          { from: "lint", to: "qa-review" },
          { from: "qa-review", to: "staging-test" },
          { from: "staging-test", to: "security-scan" },
          { from: "security-scan", to: "deploy" },
        ]
      : [{ from: "lint", to: "deploy" }]),
  ];

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Pipeline Graph
        {qaMode && (
          <span className="ml-2 rounded-full bg-cyan-700/20 px-2 py-0.5 text-[10px] font-medium text-cyan-700">
            QA Detour
          </span>
        )}
      </p>

      <svg
        viewBox={`0 0 ${qaMode ? 360 : 260} ${qaMode ? 210 : 120}`}
        role="img"
        aria-label={`Detour pipeline graph${qaMode ? " with QA stages" : ""}`}
        className="h-auto w-full"
      >
        <rect x={0} y={0} width={qaMode ? 360 : 260} height={qaMode ? 210 : 120} fill="var(--color-background-100)" rx={8} />

        {qaMode && (
          <rect
            x={80}
            y={140}
            width={210}
            height={60}
            rx={8}
            fill="none"
            stroke="var(--color-cyan-700)"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            opacity={0.4}
          />
        )}

        {edges.map(({ from, to }) => {
          const fromNode = nodeMap.get(from);
          const toNode = nodeMap.get(to);
          if (!fromNode || !toNode) return null;

          const isActive =
            (currentStep === to) ||
            (completedSteps.has(from) && (currentStep === to || completedSteps.has(to)));
          const isDetourEdge = fromNode.isDetour || toNode.isDetour;

          return (
            <line
              key={`${from}-${to}`}
              x1={fromNode.x}
              y1={fromNode.y}
              x2={toNode.x}
              y2={toNode.y}
              stroke={
                isActive
                  ? isDetourEdge
                    ? "var(--color-cyan-700)"
                    : "var(--color-amber-700)"
                  : "var(--color-gray-500)"
              }
              strokeWidth={isActive ? 2.5 : 1.5}
              strokeDasharray={isDetourEdge && !completedSteps.has(to) ? "6 4" : undefined}
            />
          );
        })}

        {nodes.map((node) => {
          const isCurrent = currentStep === node.id;
          const isCompleted = completedSteps.has(node.id);
          const color = isCurrent
            ? node.isDetour
              ? "var(--color-cyan-700)"
              : "var(--color-amber-700)"
            : isCompleted
              ? "var(--color-green-700)"
              : "var(--color-gray-500)";

          return (
            <g key={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                r={16}
                fill="var(--color-background-200)"
                stroke={color}
                strokeWidth={isCurrent ? 2.5 : 1.5}
                className={isCurrent ? "animate-pulse" : undefined}
              />
              {isCompleted && (
                <polyline
                  points={`${node.x - 5},${node.y} ${node.x - 1},${node.y + 4} ${node.x + 6},${node.y - 4}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {!isCompleted && (
                <text
                  x={node.x}
                  y={node.y + 4}
                  textAnchor="middle"
                  className={`font-mono text-[9px] ${isCurrent ? (node.isDetour ? "fill-cyan-700" : "fill-amber-700") : "fill-gray-500"}`}
                >
                  {node.label.slice(0, 3).toUpperCase()}
                </text>
              )}
              <text
                x={node.x}
                y={node.y + (node.isDetour ? 30 : -22)}
                textAnchor="middle"
                className={`font-mono text-[9px] ${isCurrent || isCompleted ? "fill-gray-900" : "fill-gray-500"}`}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function PipelineStepsList({
  visibleSteps,
  completedSteps,
  currentStep,
  status,
}: {
  visibleSteps: PipelineStep[];
  completedSteps: Array<{ step: string; result: string }>;
  currentStep: string | null;
  status: RunStatus | "idle";
}) {
  const completedSet = new Set(completedSteps.map((s) => s.step));
  const completedMap = new Map(completedSteps.map((s) => [s.step, s.result]));

  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Pipeline Steps
      </p>
      <ul className="space-y-2">
        {visibleSteps.map((step, index) => {
          const isCompleted = completedSet.has(step);
          const isCurrent = currentStep === step;
          const isQa = QA_STEPS.has(step);
          const result = completedMap.get(step);

          return (
            <li
              key={step}
              className={`rounded-md border px-3 py-2 ${
                isCurrent
                  ? isQa
                    ? "border-cyan-700/40 bg-cyan-700/10"
                    : "border-amber-700/40 bg-amber-700/10"
                  : isCompleted
                    ? "border-green-700/40 bg-green-700/10"
                    : "border-gray-400/70 bg-background-200"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-mono ${
                    isCompleted
                      ? "bg-green-700/20 text-green-700"
                      : isCurrent
                        ? isQa
                          ? "bg-cyan-700/20 text-cyan-700"
                          : "bg-amber-700/20 text-amber-700"
                        : "bg-gray-300 text-gray-1000"
                  }`}
                >
                  {isCompleted ? "\u2713" : index + 1}
                </span>
                <span className={`text-sm ${isCurrent || isCompleted ? "text-gray-1000" : "text-gray-900"}`}>
                  {STEP_LABELS[step] ?? step}
                  {isQa && (
                    <span className="ml-1.5 text-[10px] text-cyan-700">(detour)</span>
                  )}
                </span>
              </div>
              {result && (
                <p className="mt-1 ml-7 text-xs text-green-700">{result}</p>
              )}
            </li>
          );
        })}
        {status === "idle" && (
          <li className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2 text-sm text-gray-900">
            No pipeline active
          </li>
        )}
      </ul>
    </div>
  );
}

function RunStatusBadge({ status, inDetour }: { status: RunStatus | "idle"; inDetour: boolean }) {
  if (status === "done") {
    return (
      <span className="rounded-full bg-green-700/20 px-2 py-0.5 text-xs font-medium text-green-700">
        done
      </span>
    );
  }
  if (status === "detour" || inDetour) {
    return (
      <span className="rounded-full bg-cyan-700/20 px-2 py-0.5 text-xs font-medium text-cyan-700">
        detour
      </span>
    );
  }
  if (status === "deploying" || status === "building") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        running
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-900">
      idle
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
} as unknown as Parameters<typeof DetourDemo>[0];

export default function DetourNativeDemo() {
  return <DetourDemo {...demoProps} />;
}
