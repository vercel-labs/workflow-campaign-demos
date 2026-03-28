// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SchedulerAgentSupervisorCodeWorkbench,
  type GutterMarkKind,
  type HighlightTone,
} from "@/scheduler-agent-supervisor/components/scheduler-agent-supervisor-code-workbench";

/* ---------- types matching SupervisorEvent from the workflow ---------- */

type SupervisorAgentId = "fast-model" | "thorough-model" | "premium-model";
type QualityThreshold = "low" | "medium" | "high";

type SupervisorEvent =
  | { type: "agent_dispatched"; agentId: SupervisorAgentId; agentIndex: number; label: string }
  | { type: "agent_generating"; agentId: SupervisorAgentId; progressPct: number }
  | { type: "agent_generated"; agentId: SupervisorAgentId }
  | { type: "quality_check"; agentId: SupervisorAgentId }
  | { type: "quality_result"; agentId: SupervisorAgentId; score: number; requiredScore: number; passed: boolean }
  | { type: "cooldown"; fromAgentId: SupervisorAgentId; toAgentId: SupervisorAgentId; reason: string }
  | { type: "publishing"; agentId: SupervisorAgentId }
  | { type: "done"; publishedBy: SupervisorAgentId; publicationId: string; qualityScore: number }
  | { type: "failed"; reason: string };

/* ---------- UI snapshot types (rebuilt from events) ---------- */

type AgentStatus = "pending" | "generating" | "checking" | "passed" | "failed" | "published";
type RunPhase = "generating" | "quality-check" | "cooldown" | "publishing" | "completed" | "failed";

type AgentSnapshot = {
  id: SupervisorAgentId;
  label: string;
  status: AgentStatus;
  generationProgressPct: number;
  qualityScore: number | null;
  qualityPassed: boolean | null;
};

type RerouteRecord = {
  fromAgentId: SupervisorAgentId;
  toAgentId: SupervisorAgentId;
  reason: string;
  cooldownMs: number;
  occurredAtMs: number;
};

type QualityResult = {
  agentId: SupervisorAgentId;
  score: number;
  requiredScore: number;
  passed: boolean;
};

type Snapshot = {
  phase: RunPhase;
  status: "running" | "completed" | "failed";
  currentAgentId: SupervisorAgentId | null;
  currentAgentLabel: string | null;
  requiredScore: number;
  agents: AgentSnapshot[];
  qualityResult: QualityResult | null;
  rerouteHistory: RerouteRecord[];
  cooldownRemainingMs: number | null;
};

/* ---------- line map types ---------- */

type WorkflowLineMap = {
  dispatch: number[];
  qualityCheck: number[];
  cooldown: number[];
  publish: number[];
  failed: number[];
};

type StepLineMap = {
  dispatch: number[];
  qualityCheck: number[];
  qualityPass: number[];
  qualityFail: number[];
  publish: number[];
};

type Props = {
  workflowCode: string;
  workflowHtmlLines: string[];
  workflowLineMap: WorkflowLineMap;
  stepCode: string;
  stepHtmlLines: string[];
  stepLineMap: StepLineMap;
};

/* ---------- constants ---------- */

const AGENT_DEFS: Array<{ id: SupervisorAgentId; label: string }> = [
  { id: "fast-model", label: "Fast Model" },
  { id: "thorough-model", label: "Thorough Model" },
  { id: "premium-model", label: "Premium Model" },
];

const THRESHOLD_OPTIONS: Array<{ value: QualityThreshold; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const QUALITY_THRESHOLD_SCORE: Record<QualityThreshold, number> = {
  low: 65,
  medium: 80,
  high: 92,
};

/* ---------- SSE parser ---------- */

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

/* ---------- helpers ---------- */

function applyTone(target: Record<number, HighlightTone>, lines: number[], tone: HighlightTone) {
  for (const line of lines) {
    target[line] = tone;
  }
}

function formatDurationMs(durationMs: number | null): string {
  if (!durationMs || durationMs <= 0) return "0.0s";
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function statusPillClass(status: AgentStatus) {
  if (status === "generating" || status === "checking") {
    return "border-amber-700/40 bg-amber-700/15 text-amber-700";
  }
  if (status === "published" || status === "passed") {
    return "border-green-700/40 bg-green-700/15 text-green-700";
  }
  if (status === "failed") {
    return "border-red-700/40 bg-red-700/15 text-red-700";
  }
  return "border-gray-400/70 bg-background-100 text-gray-900";
}

function makeInitialAgents(): AgentSnapshot[] {
  return AGENT_DEFS.map((a) => ({
    id: a.id,
    label: a.label,
    status: "pending" as const,
    generationProgressPct: 0,
    qualityScore: null,
    qualityPassed: null,
  }));
}

/* ---------- component ---------- */

export function SchedulerAgentSupervisorDemo({
  workflowCode,
  workflowHtmlLines,
  workflowLineMap,
  stepCode,
  stepHtmlLines,
  stepLineMap,
}: Props) {
  const [topic, setTopic] = useState("Quarterly roadmap narrative");
  const [threshold, setThreshold] = useState<QualityThreshold>("medium");
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const processEvent = useCallback((event: SupervisorEvent, prev: Snapshot): Snapshot => {
    const agents = prev.agents.map((a) => ({ ...a }));
    const rerouteHistory = [...prev.rerouteHistory];

    const findAgent = (id: SupervisorAgentId) => agents.find((a) => a.id === id)!;

    switch (event.type) {
      case "agent_dispatched": {
        const agent = findAgent(event.agentId);
        agent.status = "generating";
        agent.generationProgressPct = 0;
        return {
          ...prev,
          phase: "generating",
          status: "running",
          currentAgentId: event.agentId,
          currentAgentLabel: event.label,
          agents,
        };
      }

      case "agent_generating": {
        const agent = findAgent(event.agentId);
        agent.generationProgressPct = event.progressPct;
        return { ...prev, agents };
      }

      case "agent_generated": {
        const agent = findAgent(event.agentId);
        agent.generationProgressPct = 100;
        return { ...prev, agents };
      }

      case "quality_check": {
        const agent = findAgent(event.agentId);
        agent.status = "checking";
        return {
          ...prev,
          phase: "quality-check",
          currentAgentId: event.agentId,
          agents,
          qualityResult: null,
        };
      }

      case "quality_result": {
        const agent = findAgent(event.agentId);
        agent.qualityScore = event.score;
        agent.qualityPassed = event.passed;
        agent.status = event.passed ? "passed" : "failed";
        return {
          ...prev,
          agents,
          qualityResult: {
            agentId: event.agentId,
            score: event.score,
            requiredScore: event.requiredScore,
            passed: event.passed,
          },
        };
      }

      case "cooldown": {
        rerouteHistory.push({
          fromAgentId: event.fromAgentId,
          toAgentId: event.toAgentId,
          reason: event.reason,
          cooldownMs: 2000,
          occurredAtMs: Date.now(),
        });
        return {
          ...prev,
          phase: "cooldown",
          cooldownRemainingMs: 2000,
          rerouteHistory,
          agents,
        };
      }

      case "publishing": {
        return {
          ...prev,
          phase: "publishing",
          currentAgentId: event.agentId,
          cooldownRemainingMs: null,
          agents,
        };
      }

      case "done": {
        const agent = findAgent(event.publishedBy);
        agent.status = "published";
        return {
          ...prev,
          phase: "completed",
          status: "completed",
          currentAgentId: event.publishedBy,
          agents,
          qualityResult: {
            agentId: event.publishedBy,
            score: event.qualityScore,
            requiredScore: prev.requiredScore,
            passed: true,
          },
        };
      }

      case "failed": {
        return {
          ...prev,
          phase: "failed",
          status: "failed",
          agents,
        };
      }

      default:
        return prev;
    }
  }, []);

  const connectSse = useCallback(
    async (targetRunId: string, signal: AbortSignal, requiredScore: number) => {
      const initialSnapshot: Snapshot = {
        phase: "generating",
        status: "running",
        currentAgentId: null,
        currentAgentLabel: null,
        requiredScore,
        agents: makeInitialAgents(),
        qualityResult: null,
        rerouteHistory: [],
        cooldownRemainingMs: null,
      };

      let current = initialSnapshot;
      setSnapshot(current);

      const res = await fetch(`/api/readable/${encodeURIComponent(targetRunId)}`, { signal });
      if (!res.ok || !res.body) {
        throw new Error(`Stream unavailable (${res.status})`);
      }

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
          const event = parseSseChunk(chunk) as SupervisorEvent | null;
          if (event) {
            current = processEvent(event, current);
            setSnapshot({ ...current });
          }
        }
      }

      if (buffer.trim()) {
        const event = parseSseChunk(buffer) as SupervisorEvent | null;
        if (event) {
          current = processEvent(event, current);
          setSnapshot({ ...current });
        }
      }
    },
    [processEvent]
  );

  const handleStart = useCallback(async () => {
    const normalizedTopic = topic.trim();
    if (!normalizedTopic) {
      setError("Topic is required");
      return;
    }

    setError(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;

    try {
      const response = await fetch("/api/scheduler-agent-supervisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: normalizedTopic, threshold }),
        signal,
      });

      const payload = await response.json();
      if (signal.aborted) return;

      if (!response.ok || !payload.ok) {
        throw new Error(payload?.error?.message ?? `Start failed (${response.status})`);
      }

      setRunId(payload.runId);

      const requiredScore = QUALITY_THRESHOLD_SCORE[threshold];
      await connectSse(payload.runId, signal, requiredScore);
    } catch (err) {
      if (signal.aborted || (err instanceof Error && err.name === "AbortError")) return;
      setError(err instanceof Error ? err.message : "Failed to start demo");
    }
  }, [connectSse, threshold, topic]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunId(null);
    setSnapshot(null);
    setError(null);
    setTopic("Quarterly roadmap narrative");
    setThreshold("medium");
  }, []);

  const runIsActive = Boolean(snapshot && snapshot.status === "running");

  const statusExplainer = useMemo(() => {
    if (!snapshot) {
      return "Start the run to watch the supervisor route across Fast, Thorough, and Premium agents.";
    }
    if (snapshot.phase === "generating") {
      return `${snapshot.currentAgentLabel ?? "Agent"} is generating content...`;
    }
    if (snapshot.phase === "quality-check") {
      return `Supervisor is running a quality gate on ${snapshot.currentAgentLabel ?? "agent"}.`;
    }
    if (snapshot.phase === "cooldown") {
      const latest = snapshot.rerouteHistory[snapshot.rerouteHistory.length - 1];
      return `Quality failed. Cooling down before rerouting to ${latest?.toAgentId ?? "next agent"}.`;
    }
    if (snapshot.phase === "publishing") {
      return `${snapshot.currentAgentLabel ?? "Agent"} passed quality. Publishing approved content...`;
    }
    if (snapshot.phase === "completed") {
      return `Published successfully by ${snapshot.currentAgentLabel ?? "agent"}.`;
    }
    return "All agents failed the selected threshold. No content was published.";
  }, [snapshot]);

  const activeReroute = useMemo(() => {
    if (!snapshot || snapshot.phase !== "cooldown") return null;
    return snapshot.rerouteHistory[snapshot.rerouteHistory.length - 1] ?? null;
  }, [snapshot]);

  const codeState = useMemo(() => {
    const workflowLineTones: Record<number, HighlightTone> = {};
    const stepLineTones: Record<number, HighlightTone> = {};
    const workflowGutterMarks: Record<number, GutterMarkKind> = {};
    const stepGutterMarks: Record<number, GutterMarkKind> = {};

    if (!snapshot) {
      return { workflowLineTones, stepLineTones, workflowGutterMarks, stepGutterMarks };
    }

    const markQualityResult = () => {
      if (!snapshot.qualityResult) return;
      const workflowQualityLine = workflowLineMap.qualityCheck[0];
      if (workflowQualityLine) {
        workflowGutterMarks[workflowQualityLine] = snapshot.qualityResult.passed ? "success" : "fail";
      }
      const stepQualityLine = snapshot.qualityResult.passed
        ? stepLineMap.qualityPass[0]
        : stepLineMap.qualityFail[0];
      if (stepQualityLine) {
        stepGutterMarks[stepQualityLine] = snapshot.qualityResult.passed ? "success" : "fail";
      }
    };

    if (snapshot.phase === "generating") {
      applyTone(workflowLineTones, workflowLineMap.dispatch, "amber");
      applyTone(stepLineTones, stepLineMap.dispatch, "amber");
      markQualityResult();
      return { workflowLineTones, stepLineTones, workflowGutterMarks, stepGutterMarks };
    }

    if (snapshot.phase === "quality-check") {
      applyTone(workflowLineTones, workflowLineMap.qualityCheck, "amber");
      applyTone(stepLineTones, stepLineMap.qualityCheck, "amber");
      return { workflowLineTones, stepLineTones, workflowGutterMarks, stepGutterMarks };
    }

    if (snapshot.phase === "cooldown") {
      applyTone(workflowLineTones, workflowLineMap.qualityCheck, "red");
      applyTone(workflowLineTones, workflowLineMap.cooldown, "cyan");
      applyTone(stepLineTones, stepLineMap.qualityFail, "red");
      markQualityResult();
      return { workflowLineTones, stepLineTones, workflowGutterMarks, stepGutterMarks };
    }

    if (snapshot.phase === "publishing" || snapshot.phase === "completed") {
      applyTone(workflowLineTones, workflowLineMap.qualityCheck, "green");
      applyTone(workflowLineTones, workflowLineMap.publish, "green");
      applyTone(stepLineTones, stepLineMap.qualityPass, "green");
      applyTone(stepLineTones, stepLineMap.publish, "green");
      markQualityResult();
      return { workflowLineTones, stepLineTones, workflowGutterMarks, stepGutterMarks };
    }

    applyTone(workflowLineTones, workflowLineMap.failed, "red");
    applyTone(stepLineTones, stepLineMap.qualityFail, "red");
    markQualityResult();
    return { workflowLineTones, stepLineTones, workflowGutterMarks, stepGutterMarks };
  }, [snapshot, stepLineMap, workflowLineMap]);

  return (
    <div className="space-y-4">
      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-red-700/40 bg-red-700/10 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      ) : null}

      <div className="rounded-lg border border-gray-400/70 bg-background-100 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            disabled={runIsActive}
            placeholder="Content topic"
            className="min-h-10 min-w-[220px] flex-1 rounded-md border border-gray-400 bg-background-200 px-3 py-2 text-sm text-gray-1000 placeholder:text-gray-900 focus:border-gray-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />

          <select
            value={threshold}
            onChange={(event) => setThreshold(event.target.value as QualityThreshold)}
            disabled={runIsActive}
            className="min-h-10 rounded-md border border-gray-400 bg-background-200 px-3 py-2 text-sm text-gray-1000 focus:border-gray-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Quality threshold"
          >
            {THRESHOLD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={runIsActive}
            className="min-h-10 rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="min-h-10 rounded-md border border-gray-400 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:border-gray-300 hover:text-gray-1000"
          >
            Reset
          </button>

          {runId ? (
            <span className="ml-auto rounded-full bg-background-200 px-2.5 py-1 text-xs font-mono text-gray-900">
              run: {runId}
            </span>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-gray-400/70 bg-background-100 p-4">
        <p className="mb-3 text-sm text-gray-900" role="status" aria-live="polite">
          {statusExplainer}
        </p>

        <div className="flex flex-nowrap items-stretch gap-2 overflow-x-auto pb-1">
          {(snapshot?.agents ?? makeInitialAgents()).map((agent, index, arr) => {
            const isGenerating =
              snapshot?.currentAgentId === agent.id && agent.status === "generating";

            return (
              <div key={agent.id} className="flex items-center gap-2">
                <article className="w-[220px] shrink-0 rounded-lg border border-gray-400/70 bg-background-200 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gray-1000">{agent.label}</h3>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusPillClass(agent.status)}`}
                    >
                      {agent.status}
                    </span>
                  </div>

                  <div className="mb-2 h-2 overflow-hidden rounded-full bg-gray-400/40">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        agent.status === "failed"
                          ? "bg-red-700"
                          : agent.status === "published" || agent.status === "passed"
                            ? "bg-green-700"
                            : "bg-amber-700"
                      }`}
                      style={{ width: `${agent.generationProgressPct}%` }}
                    />
                  </div>

                  <p className="mb-2 text-xs text-gray-900">
                    {isGenerating ? (
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <span className="h-2.5 w-2.5 animate-spin rounded-full border border-amber-700 border-t-transparent" />
                        generating...
                      </span>
                    ) : agent.status === "checking" ? (
                      "running quality gate..."
                    ) : (
                      `${agent.generationProgressPct}% generated`
                    )}
                  </p>

                  {agent.qualityPassed !== null ? (
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                        agent.qualityPassed
                          ? "border-green-700/40 bg-green-700/15 text-green-700"
                          : "border-red-700/40 bg-red-700/15 text-red-700"
                      }`}
                    >
                      {agent.qualityPassed ? "quality: pass" : "quality: fail"}
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full border border-gray-400/70 bg-background-100 px-2 py-0.5 text-xs text-gray-900">
                      quality: pending
                    </span>
                  )}
                </article>

                {index < arr.length - 1 ? (
                  <div className="w-16 shrink-0 text-center">
                    {activeReroute &&
                    agent.id === activeReroute.fromAgentId ? (
                      <div className="flex flex-col items-center">
                        <span className="text-xl font-bold text-red-700 animate-pulse">→</span>
                        <span className="text-xs font-mono text-cyan-700">
                          {formatDurationMs(snapshot?.cooldownRemainingMs ?? null)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xl font-bold text-gray-900">→</span>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-lg border border-gray-400/70 bg-background-100 p-3">
          <h3 className="mb-2 text-sm font-semibold text-gray-1000">Quality Scores</h3>
          <div className="max-h-[250px] overflow-y-auto rounded-md border border-gray-400/70 bg-background-200 p-2">
            {snapshot ? (
              <ul className="space-y-2">
                {snapshot.agents.map((agent) => (
                  <li
                    key={`score-${agent.id}`}
                    className="flex items-center justify-between gap-2 rounded border border-gray-400/70 bg-background-100 px-2 py-1.5 text-xs"
                  >
                    <span className="font-mono text-gray-900">{agent.id}</span>
                    <span className="text-gray-900">
                      {agent.qualityScore !== null
                        ? `${agent.qualityScore} / ${snapshot.requiredScore}`
                        : "pending"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-900">No run started yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-gray-400/70 bg-background-100 p-3">
          <h3 className="mb-2 text-sm font-semibold text-gray-1000">Reroute History</h3>
          <div className="max-h-[250px] overflow-y-auto rounded-md border border-gray-400/70 bg-background-200 p-2">
            {snapshot && snapshot.rerouteHistory.length > 0 ? (
              <ul className="space-y-2">
                {snapshot.rerouteHistory.map((entry) => (
                  <li
                    key={`${entry.fromAgentId}:${entry.toAgentId}:${entry.occurredAtMs}`}
                    className="rounded border border-gray-400/70 bg-background-100 px-2 py-1.5 text-xs text-gray-900"
                  >
                    <p className="font-mono text-red-700">
                      {entry.fromAgentId} → {entry.toAgentId}
                    </p>
                    <p>{entry.reason}</p>
                    <p className="font-mono text-cyan-700">
                      cooldown {formatDurationMs(entry.cooldownMs)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-900">No reroutes yet.</p>
            )}
          </div>
        </section>
      </div>

      <SchedulerAgentSupervisorCodeWorkbench
        workflowCode={workflowCode}
        workflowHtmlLines={workflowHtmlLines}
        workflowLineTones={codeState.workflowLineTones}
        workflowGutterMarks={codeState.workflowGutterMarks}
        stepCode={stepCode}
        stepHtmlLines={stepHtmlLines}
        stepLineTones={codeState.stepLineTones}
        stepGutterMarks={codeState.stepGutterMarks}
      />
    </div>
  );
}

export type SchedulerAgentSupervisorNativeDemoProps = Parameters<typeof SchedulerAgentSupervisorDemo>[0];

export default function SchedulerAgentSupervisorNativeDemo(props: SchedulerAgentSupervisorNativeDemoProps) {
  return <SchedulerAgentSupervisorDemo {...props} />;
}
