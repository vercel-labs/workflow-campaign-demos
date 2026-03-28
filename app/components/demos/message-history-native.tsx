// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  MessageHistoryCodeWorkbench,
  type HighlightTone,
  type GutterMarkKind,
} from "@/message-history/app/components/message-history-code-workbench";

// ── Types ───────────────────────────────────────────────────────────────

type Status = "idle" | "running" | "completed" | "failed";

type HighlightState =
  | "none"
  | "createEnvelope"
  | "normalizeTicket"
  | "classifySeverity"
  | "chooseRoute"
  | "dispatchTicket"
  | "finalizeSuccess"
  | "finalizeFailure";

type HistoryEvent =
  | { type: "step_started"; step: string; message: string }
  | { type: "step_succeeded"; step: string; message: string }
  | { type: "step_failed"; step: string; message: string; error: string }
  | { type: "decision"; step: string; message: string; detail: Record<string, unknown> }
  | { type: "done"; envelope: TicketEnvelope };

type HistoryEntry = {
  step: string;
  status: "started" | "succeeded" | "failed" | "decision";
  message: string;
  timestamp: string;
  attempt?: number;
  detail?: Record<string, unknown>;
};

type TicketEnvelope = {
  correlationId: string;
  subject: string;
  body: string;
  severity: string | null;
  route: string | null;
  dispatchedTo: string | null;
  history: HistoryEntry[];
  status: "processing" | "completed" | "failed";
};

type ApiError = {
  code: string;
  message: string;
};

type LogEntry = {
  id: string;
  timestamp: number;
  message: string;
  tone: "info" | "success" | "warn" | "error";
};

// ── Highlight maps ──────────────────────────────────────────────────────

const STEP_TONE: Record<string, HighlightTone> = {
  createEnvelope: "cyan",
  normalizeTicket: "cyan",
  classifySeverity: "amber",
  chooseRoute: "amber",
  dispatchTicket: "green",
  finalizeSuccess: "green",
  finalizeFailure: "red",
};

const HL_LABEL: Record<string, string> = {
  none: "Click Route Ticket to start the workflow",
  createEnvelope: "createEnvelope() → initializing ticket envelope with correlationId",
  normalizeTicket: "normalizeTicket() → cleaning and normalizing ticket text",
  classifySeverity: "classifySeverity() → analyzing keywords to determine severity",
  chooseRoute: "chooseRoute() → mapping severity to routing destination",
  dispatchTicket: "dispatchTicket() → delivering ticket to the assigned handler",
  finalizeSuccess: "finalizeSuccess() → sealing envelope with complete history",
  finalizeFailure: "finalizeFailure() → recording failure in history and sealing envelope",
};

const FAIL_STEPS = [
  { value: "", label: "None (happy path)" },
  { value: "normalizeTicket", label: "Normalize" },
  { value: "classifySeverity", label: "Classify" },
  { value: "chooseRoute", label: "Route" },
  { value: "dispatchTicket", label: "Dispatch" },
];

// ── SSE helpers ─────────────────────────────────────────────────────────

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

// ── Props ───────────────────────────────────────────────────────────────

interface Props {
  orchestratorCode: string;
  orchestratorHtmlLines: string[];
  orchestratorLineMap: Record<string, number[]>;
  stepCode: string;
  stepHtmlLines: string[];
  stepLineMap: Record<string, number[]>;
}

// ── Component ───────────────────────────────────────────────────────────

export function MessageHistoryDemo({
  orchestratorCode,
  orchestratorHtmlLines,
  orchestratorLineMap,
  stepCode,
  stepHtmlLines,
  stepLineMap,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [highlight, setHighlight] = useState<HighlightState>("none");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState(false);
  const [failAtStep, setFailAtStep] = useState("");
  const [envelope, setEnvelope] = useState<TicketEnvelope | null>(null);
  const [liveHistory, setLiveHistory] = useState<HistoryEntry[]>([]);
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [gutterMarksOrch, setGutterMarksOrch] = useState<Record<number, GutterMarkKind>>({});
  const [gutterMarksStep, setGutterMarksStep] = useState<Record<number, GutterMarkKind>>({});

  const logRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [log]);

  useEffect(() => {
    timelineRef.current?.scrollTo({
      top: timelineRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [liveHistory]);

  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  const addLog = useCallback(
    (message: string, tone: LogEntry["tone"] = "info") => {
      setLog((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          message,
          tone,
        },
      ]);
    },
    []
  );

  // ── Gutter mark helpers ──────────────────────────────────────────

  const addGutterMark = useCallback(
    (step: string, kind: GutterMarkKind) => {
      const orchLines = orchestratorLineMap[step];
      if (orchLines) {
        setGutterMarksOrch((prev) => {
          const next = { ...prev };
          for (const line of orchLines) next[line] = kind;
          return next;
        });
      }
      const stLines = stepLineMap[step];
      if (stLines) {
        setGutterMarksStep((prev) => {
          const next = { ...prev };
          // Mark the first line of the function
          if (stLines.length > 0) next[stLines[0]] = kind;
          return next;
        });
      }
    },
    [orchestratorLineMap, stepLineMap]
  );

  // ── Active lines for code highlighting ────────────────────────────

  const activeOrchestratorLines = useMemo(() => {
    if (highlight === "none") return [];
    return orchestratorLineMap[highlight] ?? [];
  }, [highlight, orchestratorLineMap]);

  const activeStepLines = useMemo(() => {
    if (highlight === "none") return [];
    return stepLineMap[highlight] ?? [];
  }, [highlight, stepLineMap]);

  const tone: HighlightTone = STEP_TONE[highlight] ?? "cyan";

  // ── Connect SSE stream ─────────────────────────────────────────────

  const connectSse = useCallback(
    (runId: string, signal: AbortSignal) => {
      (async () => {
        try {
          const res = await fetch(`/api/readable/${runId}`, { signal });
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
              const event = parseSseChunk(chunk) as HistoryEvent | null;
              if (!event) continue;

              if (event.type === "step_started") {
                setHighlight(event.step as HighlightState);
                addLog(`[${event.step}] ${event.message}`, "info");
                setLiveHistory((prev) => [
                  ...prev,
                  {
                    step: event.step,
                    status: "started",
                    message: event.message,
                    timestamp: new Date().toISOString(),
                  },
                ]);
              } else if (event.type === "step_succeeded") {
                addLog(`[${event.step}] ${event.message}`, "success");
                addGutterMark(event.step, "success");
                setLiveHistory((prev) => [
                  ...prev,
                  {
                    step: event.step,
                    status: "succeeded",
                    message: event.message,
                    timestamp: new Date().toISOString(),
                  },
                ]);
              } else if (event.type === "step_failed") {
                addLog(`[${event.step}] FAILED: ${event.message}`, "error");
                addGutterMark(event.step, "fail");
                setHighlight("finalizeFailure");
                setLiveHistory((prev) => [
                  ...prev,
                  {
                    step: event.step,
                    status: "failed",
                    message: event.message,
                    timestamp: new Date().toISOString(),
                  },
                ]);
              } else if (event.type === "decision") {
                addLog(
                  `[${event.step}] Decision: ${event.message}`,
                  "warn"
                );
                setLiveHistory((prev) => [
                  ...prev,
                  {
                    step: event.step,
                    status: "decision",
                    message: event.message,
                    timestamp: new Date().toISOString(),
                    detail: event.detail,
                  },
                ]);
              } else if (event.type === "done") {
                setEnvelope(event.envelope);
                if (event.envelope.status === "completed") {
                  setStatus("completed");
                  setHighlight("finalizeSuccess");
                  addGutterMark("finalizeSuccess", "success");
                  addLog(
                    `Workflow complete: ${event.envelope.history.length} history entries recorded`,
                    "success"
                  );
                } else {
                  setStatus("failed");
                  setHighlight("finalizeFailure");
                  addGutterMark("finalizeFailure", "fail");
                  addLog(
                    `Workflow failed: ${event.envelope.history.length} history entries recorded`,
                    "error"
                  );
                }
              }
            }
          }

          if (buffer.trim()) {
            const event = parseSseChunk(buffer) as HistoryEvent | null;
            if (event?.type === "done") {
              setEnvelope(event.envelope);
              setStatus(event.envelope.status === "completed" ? "completed" : "failed");
            }
          }
        } catch {
          // AbortError or network error — ignore
        }
      })();
    },
    [addLog, addGutterMark]
  );

  // ── Route ticket ──────────────────────────────────────────────────

  const routeTicket = useCallback(async () => {
    setBusy(true);
    setApiError(null);
    setStatus("running");
    setHighlight("none");
    setEnvelope(null);
    setLiveHistory([]);
    setCorrelationId(null);
    setGutterMarksOrch({});
    setGutterMarksStep({});

    try {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      addLog("Submitting support ticket for routing", "info");

      const res = await fetch("/api/message-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: "Dashboard crash on login",
          body: "The dashboard crashes with an error when users try to log in. Multiple reports from enterprise customers.",
          failAtStep: failAtStep || null,
        }),
        signal: ac.signal,
      });

      const data = await res.json();
      if (!res.ok) {
        const err: ApiError = data.error && typeof data.error === "object"
          ? { code: data.error.code ?? "UNKNOWN", message: data.error.message ?? "Request failed" }
          : { code: "REQUEST_FAILED", message: typeof data.error === "string" ? data.error : `Request failed: ${res.status}` };
        setApiError(err);
        throw new Error(err.message);
      }

      setCorrelationId(data.correlationId);
      addLog(`Run started: ${data.correlationId}`, "info");
      connectSse(data.runId, ac.signal);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      const detail = err instanceof Error ? err.message : "Unknown error";
      if (!apiError) {
        setApiError({ code: "CLIENT_ERROR", message: detail });
      }
      setStatus("idle");
      addLog(`Error: ${detail}`, "error");
    } finally {
      setBusy(false);
    }
  }, [failAtStep, addLog, connectSse, apiError]);

  // ── Reset ─────────────────────────────────────────────────────────

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setHighlight("none");
    setLog([]);
    setApiError(null);
    setBusy(false);
    setEnvelope(null);
    setLiveHistory([]);
    setCorrelationId(null);
    setGutterMarksOrch({});
    setGutterMarksStep({});
  }, []);

  return (
    <div className="space-y-4">
      {apiError && (
        <div
          role="alert"
          className="bg-red-700/10 border border-red-700/40 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start gap-3"
        >
          <span className="font-mono text-xs bg-red-700/20 rounded px-1.5 py-0.5 shrink-0">
            {apiError.code}
          </span>
          <span>{apiError.message}</span>
        </div>
      )}

      {/* ── Controls ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void routeTicket()}
            disabled={busy}
            className="px-4 py-2 rounded-md bg-white text-black font-medium text-sm hover:bg-white/80 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "Routing..." : "Route Ticket"}
          </button>

          <select
            value={failAtStep}
            onChange={(e) => setFailAtStep(e.target.value)}
            disabled={busy}
            className="px-3 py-2 rounded-md border border-gray-400 bg-background-100 text-gray-1000 text-sm cursor-pointer disabled:opacity-50"
          >
            {FAIL_STEPS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Fail at: {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          {correlationId && (
            <span className="text-xs font-mono text-gray-900 bg-background-100 border border-gray-300 rounded px-2 py-1">
              {correlationId}
            </span>
          )}
          <StatusBadge status={status} />
          <button
            type="button"
            onClick={reset}
            disabled={status === "idle"}
            className="px-3 py-1 rounded-md border border-gray-400 text-gray-900 text-xs cursor-pointer hover:border-gray-300 hover:text-gray-1000 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Reset
          </button>
        </div>
      </div>

      {/* ── Live history timeline + Event log side by side ──────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Live timeline */}
        <div className="rounded-md border border-gray-300 bg-background-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-300">
            <span className="text-xs font-mono text-gray-900">
              History Timeline
            </span>
            <span className="text-xs font-mono text-gray-900">
              {liveHistory.length} {liveHistory.length === 1 ? "entry" : "entries"}
            </span>
          </div>
          <div
            ref={timelineRef}
            className="h-[200px] overflow-y-auto"
          >
            {liveHistory.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-900">
                History entries appear here as steps execute.
              </p>
            ) : (
              <div className="px-4 py-2 space-y-1.5">
                {liveHistory.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs font-mono">
                    <div className="flex flex-col items-center mt-1 shrink-0">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          entry.status === "succeeded"
                            ? "bg-green-700"
                            : entry.status === "failed"
                              ? "bg-red-700"
                              : entry.status === "decision"
                                ? "bg-amber-700"
                                : "bg-blue-700"
                        }`}
                      />
                      {i < liveHistory.length - 1 && (
                        <div className="w-px h-3 bg-gray-400 mt-0.5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className={`shrink-0 ${
                          entry.status === "succeeded"
                            ? "text-green-700"
                            : entry.status === "failed"
                              ? "text-red-700"
                              : entry.status === "decision"
                                ? "text-amber-700"
                                : "text-blue-700"
                        }`}>
                          {entry.step}
                        </span>
                        <span className="text-gray-900 text-[10px] uppercase">
                          {entry.status}
                        </span>
                      </div>
                      <p className="text-gray-1000 truncate">{entry.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Event log */}
        <div className="rounded-md border border-gray-300 bg-background-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-300">
            <span className="text-xs font-mono text-gray-900">
              Execution Log
            </span>
            <span className="text-xs font-mono text-gray-900">
              {log.length} {log.length === 1 ? "event" : "events"}
            </span>
          </div>
          <div
            ref={logRef}
            className="h-[200px] overflow-y-auto"
            role="log"
            aria-live="polite"
            aria-label="Message history event log"
          >
            {log.length === 0 ? (
              <p className="py-12 text-center text-sm text-gray-900">
                Click Route Ticket to process a support ticket through the
                message history pipeline.
              </p>
            ) : (
              <div className="divide-y divide-gray-300">
                {log.map((entry) => (
                  <div key={entry.id} className="px-4 py-2 flex items-start gap-3">
                    <span
                      className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${
                        entry.tone === "success"
                          ? "bg-green-700"
                          : entry.tone === "warn"
                            ? "bg-amber-700"
                            : entry.tone === "error"
                              ? "bg-red-700"
                              : "bg-blue-700"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-mono text-gray-1000">
                          {entry.message}
                        </span>
                        <span className="text-xs text-gray-900 font-mono tabular-nums flex-shrink-0">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Final envelope viewer ────────────────────────────────────── */}
      {envelope && (
        <div className="rounded-md border border-gray-300 bg-background-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-300">
            <span className="text-xs font-mono text-gray-900">
              Final Envelope — {envelope.history.length} history entries
            </span>
            <span className="text-xs font-mono text-gray-900">
              {envelope.correlationId}
            </span>
          </div>
          <div className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-gray-900">Severity</span>
              <p className="font-mono text-gray-1000">{envelope.severity ?? "—"}</p>
            </div>
            <div>
              <span className="text-gray-900">Route</span>
              <p className="font-mono text-gray-1000">{envelope.route ?? "—"}</p>
            </div>
            <div>
              <span className="text-gray-900">Dispatched To</span>
              <p className="font-mono text-gray-1000">{envelope.dispatchedTo ?? "—"}</p>
            </div>
            <div>
              <span className="text-gray-900">Status</span>
              <p className={`font-mono ${envelope.status === "completed" ? "text-green-700" : "text-red-700"}`}>
                {envelope.status}
              </p>
            </div>
          </div>
          <div className="border-t border-gray-300 px-4 py-3">
            <p className="text-xs text-gray-900 mb-2">Complete History Array</p>
            <div className="space-y-1">
              {envelope.history.map((entry, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-mono">
                  <span
                    className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                      entry.status === "succeeded"
                        ? "bg-green-700"
                        : entry.status === "failed"
                          ? "bg-red-700"
                          : entry.status === "decision"
                            ? "bg-amber-700"
                            : "bg-blue-700"
                    }`}
                  />
                  <span className="text-gray-900">{entry.step}</span>
                  <span className="text-gray-1000 truncate">{entry.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Highlight label ──────────────────────────────────────────── */}
      <div className="text-xs text-gray-900 italic text-center">
        {HL_LABEL[highlight]}
      </div>

      {/* ── Code workbench ─────────────────────────────────────────── */}
      <MessageHistoryCodeWorkbench
        leftPane={{
          filename: "supportTicketRouting()",
          label: `"use workflow"`,
          code: orchestratorCode,
          htmlLines: orchestratorHtmlLines,
          activeLines: activeOrchestratorLines,
          gutterMarks: gutterMarksOrch,
          tone,
        }}
        rightPane={{
          filename: "steps",
          label: `"use step"`,
          code: stepCode,
          htmlLines: stepHtmlLines,
          activeLines: activeStepLines,
          gutterMarks: gutterMarksStep,
          tone,
        }}
      />
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Status }) {
  if (status === "completed") {
    return (
      <span className="rounded-full bg-green-700/20 px-2 py-0.5 text-xs font-medium text-green-700">
        completed
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className="rounded-full bg-red-700/20 px-2 py-0.5 text-xs font-medium text-red-700">
        failed
      </span>
    );
  }

  if (status === "running") {
    return (
      <span className="rounded-full bg-blue-700/20 px-2 py-0.5 text-xs font-medium text-blue-700">
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
  orchestratorCode: "",
  orchestratorHtmlLines: [],
  orchestratorLineMap: {},
  stepCode: "",
  stepHtmlLines: [],
  stepLineMap: {},
} as unknown as Parameters<typeof MessageHistoryDemo>[0];

export default function MessageHistoryNativeDemo() {
  return <MessageHistoryDemo {...demoProps} />;
}
