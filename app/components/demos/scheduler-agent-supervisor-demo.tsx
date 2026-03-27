"use client";

import { useEffect, useRef, useState } from "react";

type QualityThreshold = "low" | "medium" | "high";

type SupervisorEvent =
  | { type: "agent_dispatched"; agentId: string; agentIndex: number; label: string }
  | { type: "agent_generating"; agentId: string; progressPct: number }
  | { type: "agent_generated"; agentId: string }
  | { type: "quality_check"; agentId: string }
  | {
      type: "quality_result";
      agentId: string;
      score: number;
      requiredScore: number;
      passed: boolean;
    }
  | { type: "cooldown"; fromAgentId: string; toAgentId: string; reason: string }
  | { type: "publishing"; agentId: string }
  | { type: "done"; publishedBy: string; publicationId: string; qualityScore: number }
  | { type: "failed"; reason: string };

type AgentState = {
  id: string;
  label: string;
  status: "waiting" | "running" | "generated" | "published" | "cooldown" | "failed";
  progressPct: number;
  quality: string;
};

const AGENTS: AgentState[] = [
  { id: "fast-model", label: "Fast Model", status: "waiting", progressPct: 0, quality: "" },
  { id: "thorough-model", label: "Thorough Model", status: "waiting", progressPct: 0, quality: "" },
  { id: "premium-model", label: "Premium Model", status: "waiting", progressPct: 0, quality: "" },
];

function parseEvent(chunk: string): SupervisorEvent | null {
  const payload = chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;

  try {
    return JSON.parse(payload) as SupervisorEvent;
  } catch {
    return null;
  }
}

function badgeClass(status: AgentState["status"]) {
  if (status === "published" || status === "generated") return "bg-green-700/15 text-green-700";
  if (status === "failed") return "bg-red-700/15 text-red-700";
  if (status === "running" || status === "cooldown") return "bg-amber-700/15 text-amber-700";
  return "bg-gray-500/10 text-gray-700";
}

export function SchedulerAgentSupervisorDemo() {
  const [topic, setTopic] = useState("How workflow durability changes content publishing");
  const [threshold, setThreshold] = useState<QualityThreshold>("medium");
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "running" | "published" | "failed">("idle");
  const [publicationId, setPublicationId] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentState[]>(AGENTS);
  const [events, setEvents] = useState<string[]>(["Start a run to route work through the supervisor ladder."]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  async function connectToStream(nextRunId: string, signal: AbortSignal) {
    const response = await fetch(`/api/readable/${nextRunId}`, { signal });
    if (!response.ok || !response.body) {
      throw new Error("Readable stream unavailable");
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
        const event = parseEvent(chunk);
        if (!event) continue;

        if (event.type === "agent_dispatched") {
          setAgents((current) =>
            current.map((agent) =>
              agent.id === event.agentId ? { ...agent, status: "running", progressPct: 0 } : agent,
            ),
          );
          setEvents((current) => [...current, `${event.label} dispatched`]);
        }

        if (event.type === "agent_generating") {
          setAgents((current) =>
            current.map((agent) =>
              agent.id === event.agentId
                ? { ...agent, status: "running", progressPct: event.progressPct }
                : agent,
            ),
          );
        }

        if (event.type === "agent_generated") {
          setAgents((current) =>
            current.map((agent) =>
              agent.id === event.agentId ? { ...agent, status: "generated", progressPct: 100 } : agent,
            ),
          );
        }

        if (event.type === "quality_result") {
          setAgents((current) =>
            current.map((agent) =>
              agent.id === event.agentId
                ? {
                    ...agent,
                    status: event.passed ? "generated" : "failed",
                    quality: `${event.score}/${event.requiredScore}`,
                  }
                : agent,
            ),
          );
          setEvents((current) => [
            ...current,
            `${event.agentId} scored ${event.score} against ${event.requiredScore}`,
          ]);
        }

        if (event.type === "cooldown") {
          setStatus("running");
          setEvents((current) => [...current, `Rerouting: ${event.reason}`]);
        }

        if (event.type === "publishing") {
          setEvents((current) => [...current, `${event.agentId} passed quality and is publishing`]);
        }

        if (event.type === "done") {
          setStatus("published");
          setPublicationId(event.publicationId);
          setAgents((current) =>
            current.map((agent) =>
              agent.id === event.publishedBy ? { ...agent, status: "published" } : agent,
            ),
          );
        }

        if (event.type === "failed") {
          setStatus("failed");
          setEvents((current) => [...current, `Supervisor failed: ${event.reason}`]);
        }
      }
    }
  }

  async function startRun() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setError(null);
    setRunId(null);
    setPublicationId(null);
    setStatus("running");
    setAgents(AGENTS);
    setEvents(["Dispatching topic to the first available agent."]);

    try {
      const response = await fetch("/api/scheduler-agent-supervisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, threshold }),
        signal: abortRef.current.signal,
      });

      const payload = (await response.json()) as
        | { ok: true; runId: string }
        | { error?: { message?: string } };

      if (!response.ok || !("runId" in payload)) {
        throw new Error(
          ("error" in payload ? payload.error?.message : undefined) ??
            "Failed to start supervisor",
        );
      }

      setRunId(payload.runId);
      await connectToStream(payload.runId, abortRef.current.signal);
    } catch (runError) {
      if (runError instanceof Error && runError.name === "AbortError") return;
      setStatus("idle");
      setError(runError instanceof Error ? runError.message : "Unknown error");
    }
  }

  return (
    <section className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">Scheduler Agent Supervisor</p>
          <h2 className="text-xl font-semibold text-gray-950">Escalate until quality clears the bar</h2>
        </div>
        <button
          className="rounded-md bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={startRun}
          disabled={status === "running"}
        >
          {status === "running" ? "Running..." : "Start Run"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1.4fr_0.6fr]">
        <label className="text-sm text-gray-700">
          Topic
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            disabled={status === "running"}
          />
        </label>
        <label className="text-sm text-gray-700">
          Threshold
          <select
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            value={threshold}
            onChange={(event) => setThreshold(event.target.value as QualityThreshold)}
            disabled={status === "running"}
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {agents.map((agent) => (
          <article key={agent.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-gray-900">{agent.label}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs ${badgeClass(agent.status)}`}>
                {agent.status}
              </span>
            </div>
            <p className="mt-3 text-sm text-gray-700">Progress: {agent.progressPct}%</p>
            <p className="mt-1 text-xs text-gray-500">{agent.quality || "Awaiting quality gate"}</p>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-900">Execution Log</p>
          <div className="mt-3 space-y-2 text-sm text-gray-700">
            {events.map((event, index) => (
              <p key={`${event}-${index}`}>{event}</p>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-900">Summary</p>
          <dl className="mt-3 space-y-2 text-sm text-gray-700">
            <div className="flex justify-between gap-4">
              <dt>Status</dt>
              <dd>{status}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Run ID</dt>
              <dd className="truncate">{runId ?? "Pending"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Publication</dt>
              <dd className="truncate">{publicationId ?? "Pending"}</dd>
            </div>
          </dl>
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
