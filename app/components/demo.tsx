"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApprovalChainCodeWorkbench } from "@/components/approval-chain-code-workbench";

type DemoStatus = "idle" | "running" | "approved" | "rejected" | "expired";
type ApprovalRole = "manager" | "director" | "vp";
type LevelStatus = "pending" | "waiting" | "approved" | "rejected" | "timeout";
type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail";

type ChainEvent =
  | { type: "submitted"; expenseId: string; amount: number; levels: ApprovalRole[] }
  | { type: "level_waiting"; role: ApprovalRole; token: string; timeout: string }
  | { type: "level_approved"; role: ApprovalRole; comment?: string }
  | { type: "level_rejected"; role: ApprovalRole; comment?: string }
  | { type: "level_timeout"; role: ApprovalRole }
  | { type: "approved"; decidedBy: ApprovalRole; comment?: string }
  | { type: "rejected"; decidedBy: ApprovalRole; comment?: string }
  | { type: "expired" }
  | { type: "done"; status: "approved" | "rejected" | "expired" };

type LevelState = {
  role: ApprovalRole;
  label: string;
  status: LevelStatus;
  token: string | null;
  timeout: string | null;
  required: boolean;
};

type Accumulator = {
  runId: string;
  expenseId: string;
  amount: number;
  status: DemoStatus;
  levels: Record<ApprovalRole, LevelState>;
  requiredRoles: ApprovalRole[];
  history: HistoryEntry[];
  currentWaitingRole: ApprovalRole | null;
};

type HistoryEntry = {
  id: string;
  kind: string;
  role: ApprovalRole | null;
  message: string;
};

type WorkflowLineMap = {
  loop: number[];
  notify: number[];
  race: number[];
  timeout: number[];
  approve: number[];
  reject: number[];
  expire: number[];
};

type StepLineMap = {
  notify: number[];
  timeout: number[];
  approve: number[];
  reject: number[];
};

type Props = {
  workflowCode: string;
  workflowHtmlLines: string[];
  workflowLineMap: WorkflowLineMap;
  stepCode: string;
  stepHtmlLines: string[];
  stepLineMap: StepLineMap;
};

type StartResponse = {
  ok: true;
  runId: string;
  expenseId: string;
  amount: number;
};

const ROLE_ORDER: ApprovalRole[] = ["manager", "director", "vp"];

const AMOUNT_OPTIONS = [
  { value: 250, label: "$250" },
  { value: 2500, label: "$2500" },
  { value: 7500, label: "$7500" },
] as const;

const ROLE_LABELS: Record<ApprovalRole, string> = {
  manager: "Manager",
  director: "Director",
  vp: "VP",
};

function createDefaultLevel(role: ApprovalRole, required: boolean): LevelState {
  return {
    role,
    label: ROLE_LABELS[role],
    status: "pending",
    token: null,
    timeout: null,
    required,
  };
}

function mergeUniqueLines(...groups: number[][]): number[] {
  return [...new Set(groups.flat())].sort((a, b) => a - b);
}

function parseChainEvent(rawChunk: string): ChainEvent | null {
  const payload = rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

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

  if (type === "submitted") return event as ChainEvent;
  if (type === "level_waiting") return event as ChainEvent;
  if (type === "level_approved") return event as ChainEvent;
  if (type === "level_rejected") return event as ChainEvent;
  if (type === "level_timeout") return event as ChainEvent;
  if (type === "approved") return event as ChainEvent;
  if (type === "rejected") return event as ChainEvent;
  if (type === "expired") return event as ChainEvent;
  if (type === "done") return event as ChainEvent;

  return null;
}

let historyCounter = 0;

function applyChainEvent(acc: Accumulator, event: ChainEvent): Accumulator {
  const id = `h-${++historyCounter}`;

  if (event.type === "submitted") {
    const requiredRoles = event.levels;
    const levels = { ...acc.levels };
    for (const role of ROLE_ORDER) {
      levels[role] = createDefaultLevel(role, requiredRoles.includes(role));
    }
    return {
      ...acc,
      expenseId: event.expenseId,
      amount: event.amount,
      requiredRoles,
      levels,
      history: [...acc.history, { id, kind: "submitted", role: null, message: `Expense ${event.expenseId} submitted ($${event.amount})` }],
    };
  }

  if (event.type === "level_waiting") {
    const levels = { ...acc.levels };
    levels[event.role] = {
      ...levels[event.role],
      status: "waiting",
      token: event.token,
      timeout: event.timeout,
    };
    return {
      ...acc,
      levels,
      currentWaitingRole: event.role,
      history: [...acc.history, { id, kind: "waiting", role: event.role, message: `${ROLE_LABELS[event.role]} notified — waiting (${event.timeout} timeout)` }],
    };
  }

  if (event.type === "level_approved") {
    const levels = { ...acc.levels };
    levels[event.role] = { ...levels[event.role], status: "approved" };
    return {
      ...acc,
      levels,
      currentWaitingRole: null,
      history: [...acc.history, { id, kind: "approved", role: event.role, message: `${ROLE_LABELS[event.role]} approved` }],
    };
  }

  if (event.type === "level_rejected") {
    const levels = { ...acc.levels };
    levels[event.role] = { ...levels[event.role], status: "rejected" };
    return {
      ...acc,
      levels,
      currentWaitingRole: null,
      history: [...acc.history, { id, kind: "rejected", role: event.role, message: `${ROLE_LABELS[event.role]} rejected` }],
    };
  }

  if (event.type === "level_timeout") {
    const levels = { ...acc.levels };
    levels[event.role] = { ...levels[event.role], status: "timeout" };
    return {
      ...acc,
      levels,
      currentWaitingRole: null,
      history: [...acc.history, { id, kind: "timeout", role: event.role, message: `${ROLE_LABELS[event.role]} timed out — escalating` }],
    };
  }

  if (event.type === "approved") {
    return {
      ...acc,
      status: "approved",
      history: [...acc.history, { id, kind: "done", role: event.decidedBy, message: `Expense approved by ${ROLE_LABELS[event.decidedBy]}` }],
    };
  }

  if (event.type === "rejected") {
    return {
      ...acc,
      status: "rejected",
      history: [...acc.history, { id, kind: "done", role: event.decidedBy, message: `Expense rejected by ${ROLE_LABELS[event.decidedBy]}` }],
    };
  }

  if (event.type === "expired") {
    return {
      ...acc,
      status: "expired",
      history: [...acc.history, { id, kind: "done", role: null, message: "All levels timed out — expense expired" }],
    };
  }

  if (event.type === "done") {
    const statusMap: Record<string, DemoStatus> = {
      approved: "approved",
      rejected: "rejected",
      expired: "expired",
    };
    return {
      ...acc,
      status: statusMap[event.status] ?? acc.status,
    };
  }

  return acc;
}

function createInitialAccumulator(runId: string): Accumulator {
  return {
    runId,
    expenseId: "",
    amount: 0,
    status: "running",
    levels: {
      manager: createDefaultLevel("manager", true),
      director: createDefaultLevel("director", false),
      vp: createDefaultLevel("vp", false),
    },
    requiredRoles: [],
    history: [],
    currentWaitingRole: null,
  };
}

export function ApprovalChainDemo({
  workflowCode,
  workflowHtmlLines,
  workflowLineMap,
  stepCode,
  stepHtmlLines,
  stepLineMap,
}: Props) {
  const [amount, setAmount] = useState<number>(AMOUNT_OPTIONS[0].value);
  const [runId, setRunId] = useState<string | null>(null);
  const [demoStatus, setDemoStatus] = useState<DemoStatus>("idle");
  const [levels, setLevels] = useState<Record<ApprovalRole, LevelState>>({
    manager: createDefaultLevel("manager", true),
    director: createDefaultLevel("director", false),
    vp: createDefaultLevel("vp", false),
  });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentWaitingRole, setCurrentWaitingRole] = useState<ApprovalRole | null>(null);
  const [isDeciding, setIsDeciding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const accumulatorRef = useRef<Accumulator | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const ensureAbortController = useCallback((): AbortController => {
    if (!abortRef.current || abortRef.current.signal.aborted) {
      abortRef.current = new AbortController();
    }
    return abortRef.current;
  }, []);

  const applyAccumulatorToState = useCallback((acc: Accumulator) => {
    setDemoStatus(acc.status);
    setLevels({ ...acc.levels });
    setHistory([...acc.history]);
    setCurrentWaitingRole(acc.currentWaitingRole);
  }, []);

  const connectToReadable = useCallback(
    async (targetRunId: string) => {
      const controller = ensureAbortController();
      const signal = controller.signal;

      try {
        const response = await fetch(
          `/api/readable/${encodeURIComponent(targetRunId)}`,
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

        const applyEvent = (event: ChainEvent) => {
          if (signal.aborted || !accumulatorRef.current) return;

          const next = applyChainEvent(accumulatorRef.current, event);
          accumulatorRef.current = next;
          applyAccumulatorToState(next);
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
            const event = parseChainEvent(chunk);
            if (event) applyEvent(event);
          }
        }

        if (!signal.aborted && buffer.trim()) {
          const event = parseChainEvent(buffer.replaceAll("\r\n", "\n"));
          if (event) applyEvent(event);
        }
      } catch (cause: unknown) {
        if (cause instanceof Error && cause.name === "AbortError") return;
        if (signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Readable stream failed");
      }
    },
    [applyAccumulatorToState, ensureAbortController]
  );

  const handleStart = useCallback(async () => {
    setError(null);
    setRunId(null);
    setDemoStatus("running");
    setHistory([]);
    setCurrentWaitingRole(null);

    abortRef.current?.abort();
    abortRef.current = null;
    accumulatorRef.current = null;

    const controller = ensureAbortController();
    const signal = controller.signal;

    try {
      const res = await fetch("/api/approval-chain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount }),
        signal,
      });

      const payload = (await res.json().catch(() => ({}))) as StartResponse | { ok?: false; error?: { message?: string } };

      if (signal.aborted) return;

      if (!res.ok || !("runId" in payload)) {
        const msg = "error" in payload && payload.error && typeof payload.error === "object" && "message" in payload.error
          ? (payload.error as { message: string }).message
          : `Start failed (${res.status})`;
        throw new Error(msg);
      }

      const acc = createInitialAccumulator(payload.runId);
      accumulatorRef.current = acc;
      setRunId(payload.runId);

      void connectToReadable(payload.runId);
    } catch (startError) {
      if (signal.aborted || (startError instanceof Error && startError.name === "AbortError")) return;
      setDemoStatus("idle");
      setError(startError instanceof Error ? startError.message : "Failed to start workflow");
    }
  }, [amount, connectToReadable, ensureAbortController]);

  const handleDecision = useCallback(
    async (approved: boolean) => {
      if (!currentWaitingRole || demoStatus !== "running") return;

      const level = levels[currentWaitingRole];
      if (!level.token) return;

      setError(null);
      setIsDeciding(true);

      const controller = ensureAbortController();
      const signal = controller.signal;

      try {
        const res = await fetch("/api/approve", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            token: level.token,
            approved,
            decidedBy: level.role,
          }),
          signal,
        });

        if (signal.aborted) return;

        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
          const msg = payload.error?.message ?? `Decision failed (${res.status})`;
          throw new Error(msg);
        }
      } catch (decisionError) {
        if (signal.aborted || (decisionError instanceof Error && decisionError.name === "AbortError")) return;
        setError(decisionError instanceof Error ? decisionError.message : "Failed to submit decision");
      } finally {
        setIsDeciding(false);
      }
    },
    [currentWaitingRole, demoStatus, ensureAbortController, levels]
  );

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    accumulatorRef.current = null;

    setDemoStatus("idle");
    setRunId(null);
    setLevels({
      manager: createDefaultLevel("manager", true),
      director: createDefaultLevel("director", false),
      vp: createDefaultLevel("vp", false),
    });
    setHistory([]);
    setCurrentWaitingRole(null);
    setError(null);
    setIsDeciding(false);
  }, []);

  const statusMessage = useMemo(() => {
    if (demoStatus === "idle") return "Pick an amount and start an approval run.";
    if (demoStatus === "running") {
      if (!currentWaitingRole) return "Bootstrapping run state and entering the first approval level...";
      return `${ROLE_LABELS[currentWaitingRole]} is active. The workflow is durably suspended at Promise.race() and consumes zero compute while waiting.`;
    }
    if (demoStatus === "approved") return "Approval received. The workflow resumed and finished successfully.";
    if (demoStatus === "rejected") return "A level rejected the request. The workflow resumed and stopped.";
    return "All required levels timed out. The workflow expired after escalation.";
  }, [demoStatus, currentWaitingRole]);

  const codeState = useMemo(() => {
    const workflowGutterMarks: Record<number, GutterMarkKind> = {};
    const stepGutterMarks: Record<number, GutterMarkKind> = {};

    for (const role of ROLE_ORDER) {
      const level = levels[role];
      if (level.status === "approved") {
        for (const line of workflowLineMap.approve) workflowGutterMarks[line] = "success";
        for (const line of stepLineMap.approve) stepGutterMarks[line] = "success";
      }
      if (level.status === "rejected") {
        for (const line of workflowLineMap.reject) workflowGutterMarks[line] = "fail";
        for (const line of stepLineMap.reject) stepGutterMarks[line] = "fail";
      }
      if (level.status === "timeout") {
        for (const line of workflowLineMap.timeout) workflowGutterMarks[line] = "fail";
        for (const line of stepLineMap.timeout) stepGutterMarks[line] = "fail";
      }
    }

    if (demoStatus === "idle") {
      return {
        tone: "amber" as HighlightTone,
        workflowActiveLines: [] as number[],
        workflowGutterMarks,
        stepActiveLines: [] as number[],
        stepGutterMarks,
      };
    }

    if (demoStatus === "running") {
      if (!currentWaitingRole) {
        return {
          tone: "amber" as HighlightTone,
          workflowActiveLines: mergeUniqueLines(workflowLineMap.loop, workflowLineMap.notify),
          workflowGutterMarks,
          stepActiveLines: stepLineMap.notify,
          stepGutterMarks,
        };
      }

      return {
        tone: "cyan" as HighlightTone,
        workflowActiveLines: mergeUniqueLines(workflowLineMap.loop, workflowLineMap.race),
        workflowGutterMarks,
        stepActiveLines: stepLineMap.timeout,
        stepGutterMarks,
      };
    }

    if (demoStatus === "approved") {
      return {
        tone: "green" as HighlightTone,
        workflowActiveLines: workflowLineMap.approve,
        workflowGutterMarks,
        stepActiveLines: stepLineMap.approve,
        stepGutterMarks,
      };
    }

    if (demoStatus === "rejected") {
      return {
        tone: "red" as HighlightTone,
        workflowActiveLines: workflowLineMap.reject,
        workflowGutterMarks,
        stepActiveLines: stepLineMap.reject,
        stepGutterMarks,
      };
    }

    return {
      tone: "red" as HighlightTone,
      workflowActiveLines: mergeUniqueLines(workflowLineMap.timeout, workflowLineMap.expire),
      workflowGutterMarks,
      stepActiveLines: stepLineMap.timeout,
      stepGutterMarks,
    };
  }, [demoStatus, levels, currentWaitingRole, stepLineMap, workflowLineMap]);

  const canStart = demoStatus === "idle";
  const isDone = demoStatus === "approved" || demoStatus === "rejected" || demoStatus === "expired";

  return (
    <div className="space-y-4">
      {error ? (
        <div role="alert" className="rounded-lg border border-red-700/40 bg-red-700/10 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-lg border border-gray-400/70 bg-background-100 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="amount">
            Expense amount
          </label>
          <select
            id="amount"
            value={amount}
            onChange={(event) => setAmount(Number(event.target.value))}
            disabled={!canStart}
            className="min-h-9 rounded-md border border-gray-400 bg-background-200 px-3 py-2 text-xs font-mono text-gray-1000 transition-colors focus:border-gray-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {AMOUNT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={!canStart}
            className="min-h-9 rounded-md bg-white px-4 py-2 text-xs font-medium text-black transition-colors hover:bg-white/85 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={demoStatus === "idle"}
            className="min-h-9 rounded-md border border-gray-400 px-3 py-2 text-xs font-medium text-gray-900 transition-colors hover:border-gray-300 hover:text-gray-1000 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset
          </button>

          <span className="ml-auto rounded-full border border-gray-400/60 bg-background-200 px-2 py-1 font-mono text-xs text-gray-900">
            {runId ? `run: ${runId.slice(0, 12)}…` : "run: —"}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-gray-400/70 bg-background-100 p-3">
        <p className="mb-2 text-xs text-gray-900" role="status" aria-live="polite">
          {statusMessage}
        </p>

        <div className="max-h-[250px] overflow-y-auto pr-1">
          <div className="space-y-2">
            {ROLE_ORDER.map((role) => {
              const level = levels[role];
              const isWaiting = level.status === "waiting";
              const isApproved = level.status === "approved";
              const isRejected = level.status === "rejected";
              const isTimedOut = level.status === "timeout";
              const isResolved = isApproved || isRejected || isTimedOut;

              const cardTone = isWaiting
                ? "border-amber-700/50 bg-amber-700/10"
                : isApproved
                  ? "border-green-700/50 bg-green-700/10"
                  : isRejected || isTimedOut
                    ? "border-red-700/50 bg-red-700/10"
                    : "border-gray-400/60 bg-background-200";

              const badgeTone = isWaiting
                ? "border-amber-700/40 bg-amber-700/20 text-amber-700"
                : isApproved
                  ? "border-green-700/40 bg-green-700/20 text-green-700"
                  : isRejected || isTimedOut
                    ? "border-red-700/40 bg-red-700/20 text-red-700"
                    : "border-gray-400/60 bg-background-100 text-gray-900";

              const badgeLabel =
                !level.required
                  ? "Not Required"
                  : isWaiting
                    ? "Waiting"
                    : isApproved
                      ? "Approved"
                      : isRejected
                        ? "Rejected"
                        : isTimedOut
                          ? "Timed Out"
                          : "Pending";

              return (
                <article key={role} className={`rounded-md border p-2 ${cardTone}`}>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-1000">
                      {level.label}
                    </p>
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badgeTone}`}>
                      {badgeLabel}
                    </span>
                    {isWaiting && level.timeout ? (
                      <span className="ml-auto font-mono text-xs tabular-nums text-gray-900">
                        timeout: {level.timeout}
                      </span>
                    ) : null}
                  </div>

                  {isWaiting && level.token ? (
                    <p className="mt-1 text-xs text-gray-900">
                      token: <code className="font-mono text-cyan-700">{level.token}</code>
                    </p>
                  ) : null}

                  {isWaiting && demoStatus === "running" ? (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleDecision(true)}
                        disabled={isDeciding}
                        className="min-h-8 rounded-md bg-green-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-green-700/80 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDecision(false)}
                        disabled={isDeciding}
                        className="min-h-8 rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-700/80 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}

                  {!level.required ? (
                    <p className="mt-1 text-xs text-gray-900">Skipped for this amount.</p>
                  ) : isResolved ? (
                    <p className="mt-1 text-xs text-gray-900">
                      {isApproved
                        ? "Approval signal received"
                        : isRejected
                          ? "Rejection signal received"
                          : "Level timed out and escalated"}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>

        <div className="mt-3 rounded-md border border-gray-400/60 bg-background-200 p-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-900">History</p>
          <div className="max-h-[100px] overflow-y-auto">
            {history.length === 0 ? (
              <p className="text-xs text-gray-900">No events yet.</p>
            ) : (
              <ul className="space-y-1" role="list">
                {history.map((event) => (
                  <li key={event.id} className="flex items-center gap-2 text-xs text-gray-900">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-700" aria-hidden="true" />
                    <span className="w-16 shrink-0 font-mono uppercase text-cyan-700">{event.kind}</span>
                    <span className="min-w-0 flex-1 truncate">{event.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <ApprovalChainCodeWorkbench
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
