"use client";

import { useState, useCallback, useRef, useEffect, type ReactNode } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type WorkflowStatus = "idle" | "starting" | "waiting" | "approved" | "rejected" | "timeout";

interface WorkflowState {
  status: WorkflowStatus;
  runId: string | null;
  orderId: string;
  token: string | null;
  timeout: string;
  timeoutMs: number;
  startedAtMs: number;
  elapsed: number;
  comment?: string;
  approvedBy?: string;
  error?: string;
}

const initialState: WorkflowState = {
  status: "idle",
  runId: null,
  orderId: "",
  token: null,
  timeout: "30s",
  timeoutMs: 30000,
  startedAtMs: 0,
  elapsed: 0,
};

/* ------------------------------------------------------------------ */
/*  SSE helpers                                                        */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ApprovalDemo() {
  const [state, setState] = useState<WorkflowState>(initialState);
  const [orderId, setOrderId] = useState("order_123");
  const [approvedBy] = useState("manager@example.com");
  const abortRef = useRef<AbortController | null>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  /* -- Elapsed timer (ticks while waiting) -- */
  const startElapsedTimer = useCallback((startedAtMs: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setState((prev) => {
        if (prev.status !== "waiting") return prev;
        return { ...prev, elapsed: Date.now() - startedAtMs };
      });
    }, 200);
  }, []);

  /* -- Connect to SSE stream -- */
  const connectSse = useCallback(
    async (runId: string) => {
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch(`/api/readable/${runId}`, {
          signal: controller.signal,
        });
        if (!res.ok || !res.body) return;

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
            const event = parseSseChunk(chunk) as Record<string, unknown> | null;
            if (!event || !event.type) continue;

            switch (event.type) {
              case "request_sent":
                // Step 1 complete — already showing as "waiting" from start response
                break;
              case "waiting": {
                const now = Date.now();
                setState((prev) => ({
                  ...prev,
                  status: "waiting",
                  token: (event.token as string) ?? prev.token,
                  timeoutMs: (event.timeoutMs as number) ?? prev.timeoutMs,
                  startedAtMs: now,
                }));
                startElapsedTimer(now);
                break;
              }
              case "approved":
                if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
                setState((prev) => ({
                  ...prev,
                  status: "approved",
                  approvedBy: event.approvedBy as string | undefined,
                  comment: event.comment as string | undefined,
                }));
                break;
              case "rejected":
                if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
                setState((prev) => ({
                  ...prev,
                  status: "rejected",
                  approvedBy: event.approvedBy as string | undefined,
                  comment: event.comment as string | undefined,
                }));
                break;
              case "timeout":
                if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
                setState((prev) => ({ ...prev, status: "timeout" }));
                break;
              // fulfilling, fulfilled, cancelling, cancelled, done — UI already has final status
            }
          }
        }

        // Process any remaining buffer
        if (buffer.trim()) {
          const event = parseSseChunk(buffer) as Record<string, unknown> | null;
          if (event && event.type === "timeout") {
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
            setState((prev) => ({ ...prev, status: "timeout" }));
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
      }
    },
    [startElapsedTimer]
  );

  /* -- Start workflow -- */
  const handleStart = useCallback(async () => {
    if (!orderId.trim()) return;
    cleanup();
    setState((prev) => ({ ...prev, error: undefined, status: "starting" }));

    try {
      const res = await fetch("/api/approval-gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, timeout: state.timeout }),
      });

      const data = await res.json();
      if (!res.ok) {
        setState((prev) => ({ ...prev, status: "idle", error: data?.error?.message ?? "Start failed" }));
        return;
      }

      setState((prev) => ({
        ...prev,
        status: "starting",
        runId: data.runId,
        orderId: data.orderId,
        token: data.approvalToken,
        timeoutMs: parseTimeoutToMs(prev.timeout),
      }));

      // Connect to SSE stream for real-time events
      connectSse(data.runId);
    } catch {
      setState((prev) => ({ ...prev, status: "idle", error: "Failed to start workflow" }));
    }
  }, [orderId, state.timeout, cleanup, connectSse]);

  /* -- Approve / Reject via real hook -- */
  const handleDecision = useCallback(
    async (approved: boolean) => {
      if (!state.token) return;

      try {
        const res = await fetch("/api/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: state.token,
            approved,
            approvedBy: approvedBy || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setState((prev) => ({ ...prev, error: data?.error?.message ?? "Failed to send decision" }));
        }
        // SSE stream will deliver the outcome event
      } catch {
        setState((prev) => ({ ...prev, error: "Failed to send decision" }));
      }
    },
    [state.token, approvedBy]
  );

  /* -- Reset -- */
  const handleReset = useCallback(() => {
    cleanup();
    setState(initialState);
    setTimeout(() => startButtonRef.current?.focus(), 0);
  }, [cleanup]);

  const isIdle = state.status === "idle";
  const isStarting = state.status === "starting";
  const isWaiting = state.status === "waiting";
  const isActive = isStarting || isWaiting;
  const isDone = state.status === "approved" || state.status === "rejected" || state.status === "timeout";
  const raceWinner = state.status === "timeout" ? "sleep(timeout)" : "approvalHook(token)";
  const raceLoser = state.status === "timeout" ? "approvalHook(token)" : "sleep(timeout)";

  return (
    <div className="space-y-8">
      {state.error && (
        <div
          role="alert"
          className="bg-red-700/10 border border-red-700/40 text-red-700 px-4 py-3 rounded-lg text-sm"
        >
          {state.error}
        </div>
      )}

      {/* Step 1: Submit Order */}
      <StepCard step={1} title="Submit an Order" state={isIdle ? "active" : "done"}>
        {isIdle ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="orderId" className="block text-sm font-medium text-gray-1000 mb-1.5">
                Order ID
              </label>
              <input
                id="orderId"
                type="text"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="order_123"
                className="w-full bg-background-100 border border-gray-400 rounded-md px-3 py-2 text-sm font-mono text-gray-1000 placeholder:text-gray-500 focus:border-gray-300 focus:outline-none transition-colors disabled:opacity-50"
              />
            </div>
            <div>
              <label htmlFor="timeout" className="block text-sm font-medium text-gray-1000 mb-1.5">
                Timeout
              </label>
              <select
                id="timeout"
                value={state.timeout}
                onChange={(e) => setState((prev) => ({ ...prev, timeout: e.target.value }))}
                className="w-full bg-background-100 border border-gray-400 rounded-md px-3 py-2 text-sm font-mono text-gray-1000 focus:border-gray-300 focus:outline-none transition-colors disabled:opacity-50"
              >
                <option value="10s">10 seconds</option>
                <option value="30s">30 seconds</option>
                <option value="1m">1 minute</option>
                <option value="5m">5 minutes</option>
              </select>
            </div>
            <button
              ref={startButtonRef}
              onClick={handleStart}
              disabled={!orderId.trim()}
              className="w-full px-4 py-2 rounded-md bg-white text-black font-medium text-sm hover:bg-white/80 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Order for Approval
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-900">
            Order <span className="font-mono text-gray-1000">{state.orderId}</span> submitted for approval.
          </p>
        )}
      </StepCard>

      {/* Step 2: Workflow Suspends */}
      <StepCard
        step={2}
        title="Workflow Suspends"
        state={isIdle ? "pending" : isActive ? "active" : "done"}
      >
        {isStarting ? (
          <div className="flex items-center gap-3" role="status" aria-live="polite">
            <div className="relative w-5 h-5 flex-shrink-0" aria-hidden="true">
              <div className="absolute inset-0 rounded-full border-2 border-amber-700 border-t-transparent animate-spin" />
            </div>
            <p className="text-sm font-medium text-amber-700">Starting workflow...</p>
          </div>
        ) : isWaiting ? (
          <WorkflowStatusPanel
            elapsed={state.elapsed}
            timeoutMs={state.timeoutMs}
            orderId={state.orderId}
          />
        ) : isDone ? (
          <div className="space-y-1" role="status" aria-live="polite">
            <p className="text-sm text-gray-900">
              Workflow resumed because{" "}
              <span className="font-mono text-gray-1000">{raceWinner}</span> won{" "}
              <span className="font-mono text-gray-1000">Promise.race()</span>.
            </p>
            <p className="text-sm text-gray-900">
              <span className="font-mono text-gray-1000">{raceLoser}</span> lost and was ignored.
              Final status: <span className="font-mono text-gray-1000">{state.status}</span>.
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-900" role="status" aria-live="polite">
            The workflow will suspend here, using zero compute while it waits for a signal.
          </p>
        )}
      </StepCard>

      {/* Step 3: Approver Clicks the Link */}
      <StepCard step={3} title="Approver Clicks the Link" state={isIdle ? "pending" : isDone ? "active" : "default"}>
        {isWaiting ? (
          <div className="space-y-4">
            <MockApprovalEmail
              orderId={state.orderId}
              token={state.token!}
              approvedBy={approvedBy}
              onDecision={handleDecision}
            />
            <HookExplainer token={state.token!} />
          </div>
        ) : isDone ? (
          <ResultDisplay
            status={state.status as "approved" | "rejected" | "timeout"}
            orderId={state.orderId}
            comment={state.comment}
            approvedBy={state.approvedBy}
          />
        ) : (
          <p className="text-sm text-gray-900">
            An approval email will be sent with a link containing the hook token.
          </p>
        )}
      </StepCard>

      {(isDone || isActive) && (
        <button
          onClick={handleReset}
          className="w-full px-4 py-2 rounded-md border border-gray-400 text-gray-900 text-sm hover:border-gray-300 hover:text-gray-1000 cursor-pointer transition-colors"
        >
          Reset Demo
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step Card                                                          */
/* ------------------------------------------------------------------ */

type StepState = "active" | "done" | "default" | "pending";

function StepCard({ step, title, state, children }: { step: number; title: string; state: StepState; children: ReactNode }) {
  return (
    <div
      className={`relative border rounded-lg px-5 pb-5 pt-8 ${
        state === "pending"
          ? "border-gray-400/40 opacity-40"
          : state === "done"
            ? "border-gray-400/40"
            : "border-gray-400"
      }`}
    >
      <div className="absolute -top-3 left-4 flex items-center gap-2.5 bg-background-200 px-2">
        <span
          className={`rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-xs font-semibold ${
            state === "done"
              ? "bg-green-700 text-white"
              : state === "active"
                ? "bg-blue-700 text-white"
                : "bg-gray-900 text-background-100"
          }`}
          aria-hidden="true"
        >
          {state === "done" ? (
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            step
          )}
        </span>
        <span className="text-sm font-medium text-gray-1000">{title}</span>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function WorkflowStatusPanel({ elapsed, timeoutMs, orderId }: { elapsed: number; timeoutMs: number; orderId: string }) {
  const progress = Math.min((elapsed / timeoutMs) * 100, 100);
  const remaining = Math.max(0, Math.ceil((timeoutMs - elapsed) / 1000));

  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="relative w-5 h-5 flex-shrink-0" aria-hidden="true">
          <div className="absolute inset-0 rounded-full border-2 border-amber-700 border-t-transparent animate-spin" />
        </div>
        <p className="text-sm font-medium text-amber-700">
          Promise.race() pending: approvalHook(token) vs sleep(timeout).
        </p>
      </div>
      <p className="text-sm text-gray-900">
        Order <span className="font-mono">{orderId}</span> · {remaining}s until sleep(timeout) can win
      </p>
      <p className="text-sm text-gray-900">
        First branch to resolve wins and resumes the workflow. The other branch is ignored.
      </p>
      <div className="w-full bg-gray-400 rounded-full h-1.5 overflow-hidden">
        <div className="h-full bg-amber-700 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function MockApprovalEmail({
  orderId,
  token,
  approvedBy,
  onDecision,
}: {
  orderId: string;
  token: string;
  approvedBy: string;
  onDecision: (approved: boolean) => void;
}) {
  const baseUrl = "https://acme.com/api/approve";

  return (
    <div className="rounded-lg overflow-hidden border border-gray-400">
      <div className="bg-background-200 border-b border-gray-400 px-4 py-3 space-y-1">
        <div className="flex items-center gap-2 text-sm text-gray-900">
          <span className="font-medium text-gray-1000">From:</span> orders@acme.com
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-900">
          <span className="font-medium text-gray-1000">To:</span> {approvedBy}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-900">
          <span className="font-medium text-gray-1000">Subject:</span> Approval required for {orderId}
        </div>
      </div>
      <div className="bg-white px-5 py-5 space-y-3 text-sm">
        <p className="text-gray-1000">Hi {approvedBy.split("@")[0]},</p>
        <p className="text-gray-900">
          Order <strong className="text-gray-1000">{orderId}</strong> ($2,340.00) has been submitted and
          needs your approval before it can be fulfilled.
        </p>
        <p className="text-gray-900">
          Click here to approve:{" "}
          <button
            onClick={() => onDecision(true)}
            className="text-blue-600 underline underline-offset-2 hover:text-blue-500 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-sm break-all"
          >
            {baseUrl}?token={token}&decision=approve
          </button>
        </p>
        <p className="text-gray-900">
          Click here to reject:{" "}
          <button
            onClick={() => onDecision(false)}
            className="text-blue-600 underline underline-offset-2 hover:text-blue-500 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-sm break-all"
          >
            {baseUrl}?token={token}&decision=reject
          </button>
        </p>
        <p className="text-gray-900">
          Thanks,
          <br />
          The Acme Orders Team
        </p>
      </div>
    </div>
  );
}

function HookExplainer({ token }: { token: string }) {
  const baseUrl = "https://acme.com/api/approve";

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-900">
        Notice the hook token <span className="font-mono text-gray-1000">{token}</span> embedded in
        each URL. That&#39;s how the server knows which workflow to resume. Any system that can
        construct this token — a CLI script, a Slack bot, a cron job — can wake the workflow.
      </p>
      <pre className="overflow-x-auto rounded-md border border-gray-400 bg-background-100 px-3 py-2.5 text-[13px] leading-relaxed font-mono text-gray-1000">
        {`curl -X POST ${baseUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"token":"${token}","approved":true}'`}
      </pre>
    </div>
  );
}

function ResultDisplay({
  status,
  orderId,
  comment,
  approvedBy,
}: {
  status: "approved" | "rejected" | "timeout";
  orderId: string;
  comment?: string;
  approvedBy?: string;
}) {
  const config = {
    approved: {
      label: "Approved",
      bg: "bg-green-700/10",
      border: "border-green-700/40",
      text: "text-green-700",
      raceSummary: "Race winner: approvalHook(token). sleep(timeout) was ignored.",
      icon: (
        <svg className="w-6 h-6 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    rejected: {
      label: "Rejected",
      bg: "bg-red-700/10",
      border: "border-red-700/40",
      text: "text-red-700",
      raceSummary: "Race winner: approvalHook(token). sleep(timeout) was ignored.",
      icon: (
        <svg className="w-6 h-6 text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
    timeout: {
      label: "Timed Out",
      bg: "bg-amber-700/10",
      border: "border-amber-700/40",
      text: "text-amber-700",
      raceSummary: "Race winner: sleep(timeout). approvalHook(token) was ignored.",
      icon: (
        <svg className="w-6 h-6 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  };

  const c = config[status];

  return (
    <div className={`${c.bg} ${c.border} border rounded-lg p-4`}>
      <div className="flex items-start gap-3">
        {c.icon}
        <div className="min-w-0">
          <p className={`font-semibold ${c.text}`}>
            Order {orderId}: {c.label}
          </p>
          <p className="text-sm text-gray-900 mt-1">{c.raceSummary}</p>
          {status === "timeout" && (
            <p className="text-sm text-gray-900 mt-1">
              No approval arrived before the deadline, so the order was automatically cancelled.
            </p>
          )}
          {comment && <p className="text-sm text-gray-900 mt-1">&ldquo;{comment}&rdquo;</p>}
          {approvedBy && <p className="text-sm text-gray-900 mt-1">By {approvedBy}</p>}
        </div>
      </div>
    </div>
  );
}

function parseTimeoutToMs(timeout: string): number {
  const match = timeout.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) return 30000;
  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case "ms": return value;
    case "s": return value * 1000;
    case "m": return value * 60 * 1000;
    case "h": return value * 60 * 60 * 1000;
    case "d": return value * 24 * 60 * 60 * 1000;
    default: return 30000;
  }
}
