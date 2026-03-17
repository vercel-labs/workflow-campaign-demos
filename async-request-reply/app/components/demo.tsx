"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";

// ── Types ───────────────────────────────────────────────────────────────

type Status = "idle" | "starting" | "submitted" | "waiting" | "completed";

type Outcome = "verified" | "rejected" | "timed_out" | null;

type HighlightState =
  | "none"
  | "submit"
  | "wait"
  | "callback"
  | "timeout"
  | "duplicate"
  | "done";

interface LogEntry {
  id: string;
  type: string;
  message: string;
  color: string;
  timestamp: number;
}

// ── Highlight mappings ──────────────────────────────────────────────────

const HL_COLOR: Record<string, string> = {
  submit: "border-blue-700 bg-blue-700/10",
  wait: "border-amber-700 bg-amber-700/10",
  callback: "border-green-700 bg-green-700/10",
  timeout: "border-red-700 bg-red-700/10",
  duplicate: "border-gray-500 bg-gray-500/10",
  done: "border-green-700 bg-green-700/10",
};

const HL_LABEL: Record<string, string> = {
  none: "Submit a document to start the workflow",
  submit: "createWebhook() \u2192 registers durable callback endpoint",
  wait: "Promise.race() \u2192 sleeping at zero compute until callback or timeout",
  callback: "Vendor callback received \u2192 workflow resumes",
  timeout: "Timeout fired first \u2192 workflow exits with timed_out",
  duplicate: "Duplicate callback \u2192 first-write-wins, duplicate ignored",
  done: "Workflow returned \u2014 document verification complete",
};

function parseApiError(data: Record<string, unknown>, fallback: string): string {
  if (
    typeof data.error === "object" &&
    data.error !== null &&
    "message" in data.error
  ) {
    return String((data.error as { message: unknown }).message);
  }
  if (typeof data.error === "string") return data.error;
  return fallback;
}

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
  orchestratorHtmlLines: string[];
  orchestratorLineMap: Record<string, number[]>;
  callbackHtmlLines: string[];
  callbackLineMap: Record<string, number[]>;
}

// ── Component ───────────────────────────────────────────────────────────

export function AsyncRequestReplyDemo({
  orchestratorHtmlLines,
  orchestratorLineMap,
  callbackHtmlLines,
  callbackLineMap,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [correlationId, setCorrelationId] = useState<string | null>(null);
  const [webhookToken, setWebhookToken] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [highlight, setHighlight] = useState<HighlightState>("none");

  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [log]);

  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  // Compute active lines for each pane
  const activeOrchestratorLines = useMemo(() => {
    const set = new Set<number>();
    if (highlight === "none") return set;

    const key =
      highlight === "done" ? "callback" :
      highlight === "duplicate" ? "wait" :
      highlight;

    for (const n of orchestratorLineMap[key] ?? []) set.add(n);
    return set;
  }, [highlight, orchestratorLineMap]);

  const activeCallbackLines = useMemo(() => {
    const set = new Set<number>();
    if (highlight === "callback" || highlight === "done") {
      for (const n of callbackLineMap.resume ?? []) set.add(n);
      for (const n of callbackLineMap.delivered ?? []) set.add(n);
    }
    if (highlight === "duplicate") {
      for (const n of callbackLineMap.resume ?? []) set.add(n);
      for (const n of callbackLineMap.duplicate ?? []) set.add(n);
    }
    return set;
  }, [highlight, callbackLineMap]);

  const appendLog = useCallback(
    (type: string, message: string, color: string) => {
      setLog((prev) => [
        ...prev,
        { id: `${type}-${Date.now()}`, type, message, color, timestamp: Date.now() },
      ]);
    },
    []
  );

  // ── Connect SSE stream ─────────────────────────────────────────────
  const connectSse = useCallback(
    (id: string, signal: AbortSignal) => {
      (async () => {
        try {
          const res = await fetch(`/api/readable/${id}`, { signal });
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
              if (!event) continue;
              handleSseEvent(event);
            }
          }

          if (buffer.trim()) {
            const event = parseSseChunk(buffer) as Record<string, unknown> | null;
            if (event) handleSseEvent(event);
          }
        } catch {
          // AbortError or network error — ignore
        }
      })();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  function handleSseEvent(event: Record<string, unknown>) {
    switch (event.type) {
      case "submitted":
        setCorrelationId(event.correlationId as string);
        setWebhookToken(event.webhookToken as string);
        setStatus("submitted");
        setHighlight("submit");
        appendLog(
          "submitted",
          `Document submitted \u2192 correlation: ${event.correlationId}`,
          "text-blue-700"
        );
        break;
      case "waiting":
        setStatus("waiting");
        setHighlight("wait");
        appendLog(
          "waiting",
          `Waiting for vendor callback (timeout: ${(event.timeoutMs as number) / 1000}s)`,
          "text-amber-700"
        );
        break;
      case "heartbeat":
        appendLog(
          "heartbeat",
          `Heartbeat \u2014 ${Math.round((event.elapsed as number) / 1000)}s / ${(event.timeoutMs as number) / 1000}s`,
          "text-gray-900"
        );
        break;
      case "callback_received": {
        const payload = event.payload as Record<string, unknown>;
        setHighlight("callback");
        appendLog(
          "callback_received",
          `Callback received: ${payload.status}`,
          payload.status === "approved" ? "text-green-700" : "text-red-700"
        );
        break;
      }
      case "duplicate_callback_ignored":
        setHighlight("duplicate");
        appendLog(
          "duplicate",
          `Duplicate callback ignored for ${event.correlationId}`,
          "text-gray-500"
        );
        break;
      case "timed_out":
        setHighlight("timeout");
        appendLog("timed_out", "Vendor callback timed out", "text-red-700");
        break;
      case "finalized": {
        const o = event.outcome as string;
        appendLog(
          "finalized",
          `Finalized: ${o} \u2014 ${event.details}`,
          o === "verified" ? "text-green-700" : o === "rejected" ? "text-red-700" : "text-amber-700"
        );
        break;
      }
      case "done":
        setStatus("completed");
        setOutcome(event.outcome as Outcome);
        setHighlight("done");
        appendLog("done", "Workflow complete", "text-green-700");
        break;
    }
  }

  // ── Submit document ─────────────────────────────────────────────────
  const submitDocument = useCallback(async () => {
    setBusy(true);
    setError(null);
    setStatus("starting");
    try {
      const docId = `doc-${Math.random().toString(36).slice(2, 8)}`;
      const res = await fetch("/api/async-request-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: docId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(parseApiError(data, res.statusText));
      }
      const id = data.runId as string;
      setLog([]);
      setOutcome(null);

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      connectSse(id, ac.signal);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start");
      setStatus("idle");
    } finally {
      setBusy(false);
    }
  }, [connectSse]);

  // ── Simulate vendor callback ────────────────────────────────────────
  const sendCallback = useCallback(
    async (callbackStatus: "approved" | "rejected") => {
      if (!webhookToken) return;
      setBusy(true);
      setError(null);
      try {
        const body =
          callbackStatus === "approved"
            ? { status: "approved", details: "Identity verified, document authentic" }
            : { status: "rejected", reason: "Document expired or unreadable" };

        const res = await fetch(
          `/api/webhook/${encodeURIComponent(webhookToken)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        );
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

        if (res.status === 409) {
          // Duplicate — show it in the log
          appendLog(
            "duplicate_local",
            "Duplicate callback \u2014 already resolved",
            "text-gray-500"
          );
          setHighlight("duplicate");
        } else if (!res.ok) {
          throw new Error(parseApiError(data, res.statusText));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Callback failed");
      } finally {
        setBusy(false);
      }
    },
    [webhookToken, appendLog]
  );

  // ── Reset ───────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setCorrelationId(null);
    setWebhookToken(null);
    setOutcome(null);
    setLog([]);
    setError(null);
    setBusy(false);
    setHighlight("none");
  }, []);

  // ── Highlight color for current state ───────────────────────────────
  const hlColor = HL_COLOR[highlight] ?? "border-blue-700 bg-blue-700/10";

  // ── Idle state ────────────────────────────────────────────────────────
  if (status === "idle") {
    return (
      <div className="py-16 text-center">
        <p className="mb-6 text-sm text-gray-900">
          Simulates submitting a document for third-party verification. Watch
          the code highlight as the workflow waits for a vendor callback.
        </p>
        <button
          onClick={() => void submitDocument()}
          disabled={busy}
          className="px-6 py-2.5 rounded-md bg-white text-black font-medium text-sm hover:bg-white/80 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700/60"
        >
          {busy ? "Starting\u2026" : "Submit Document"}
        </button>
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    );
  }

  // ── Starting state ────────────────────────────────────────────────────
  if (status === "starting") {
    return (
      <div className="py-16 text-center">
        <p className="mb-4 text-sm text-amber-700 animate-pulse">
          Starting workflow{"\u2026"}
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    );
  }

  // ── Active / completed state ──────────────────────────────────────────
  const outcomeColor =
    outcome === "verified"
      ? "text-green-700"
      : outcome === "rejected"
        ? "text-red-700"
        : outcome === "timed_out"
          ? "text-amber-700"
          : "text-gray-900";

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="bg-red-700/10 border border-red-700/40 text-red-700 px-4 py-3 rounded-lg text-sm"
        >
          {error}
        </div>
      )}

      {/* ── Status bar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className={`h-2 w-2 rounded-full ${
              status === "waiting"
                ? "bg-amber-700 animate-pulse"
                : status === "completed"
                  ? outcome === "verified"
                    ? "bg-green-700"
                    : "bg-red-700"
                  : "bg-blue-700"
            }`}
          />
          <code className="text-sm font-mono text-gray-900">
            {correlationId ?? "doc:..."}
          </code>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-medium ${
              status === "waiting"
                ? "text-amber-700"
                : status === "completed"
                  ? outcomeColor
                  : "text-blue-700"
            }`}
          >
            {status === "submitted" && "Document submitted"}
            {status === "waiting" && "Waiting for vendor \u2014 zero compute"}
            {status === "completed" &&
              (outcome === "verified"
                ? "Verified"
                : outcome === "rejected"
                  ? "Rejected"
                  : "Timed out")}
          </span>
          <button
            onClick={reset}
            className={`px-3 py-1 rounded-md border text-xs cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 ${
              status === "completed"
                ? "border-green-700 text-green-700 bg-green-700/10 animate-pulse focus-visible:ring-green-700/60"
                : "border-gray-400 text-gray-900 hover:border-gray-300 hover:text-gray-1000 focus-visible:ring-blue-700/60"
            }`}
          >
            {status === "completed" ? "New Document" : "Reset"}
          </button>
        </div>
      </div>

      {/* ── Two-column: callback buttons + event log ────────────── */}
      <div className="grid md:grid-cols-[220px_1fr] gap-4">
        {/* Callback simulator */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-900 uppercase tracking-widest mb-1">
            Simulate Callback
          </div>
          <button
            onClick={() => void sendCallback("approved")}
            disabled={busy || status !== "waiting" || !webhookToken}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md border text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700/60 border-green-700/30 hover:border-green-700/60"
          >
            <span className="h-2 w-2 rounded-full bg-green-700" />
            <span className="text-gray-1000">Approve</span>
          </button>
          <button
            onClick={() => void sendCallback("rejected")}
            disabled={busy || status !== "waiting" || !webhookToken}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md border text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700/60 border-red-700/30 hover:border-red-700/60"
          >
            <span className="h-2 w-2 rounded-full bg-red-700" />
            <span className="text-gray-1000">Reject</span>
          </button>
          {status === "completed" && (
            <button
              onClick={() => void sendCallback("approved")}
              disabled={busy}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md border text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500/60 border-gray-500/30 hover:border-gray-500/60"
            >
              <span className="h-2 w-2 rounded-full bg-gray-500" />
              <span className="text-gray-900">Send Duplicate</span>
            </button>
          )}
          <p className="text-xs text-gray-900 mt-2 leading-relaxed">
            {status === "waiting"
              ? "Or wait 30s for the timeout path."
              : status === "completed"
                ? "Try sending a duplicate \u2014 it will be ignored."
                : "Waiting for workflow to initialize\u2026"}
          </p>
        </div>

        {/* Event log */}
        <div
          ref={logRef}
          className="h-[280px] overflow-y-auto rounded-md border border-gray-300 bg-background-100"
          role="log"
          aria-live="polite"
          aria-label="Workflow event log"
        >
          {log.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-900">
              Events will appear here as the workflow runs{"\u2026"}
            </p>
          ) : (
            <div className="divide-y divide-gray-300">
              {log.map((entry) => (
                <div
                  key={entry.id}
                  className="px-4 py-3 flex items-start gap-3"
                >
                  <span
                    className={`mt-1 text-xs font-mono font-medium ${entry.color} flex-shrink-0 w-[90px] truncate`}
                  >
                    {entry.type}
                  </span>
                  <span className="text-sm text-gray-1000 min-w-0 flex-1">
                    {entry.message}
                  </span>
                  <span className="text-xs text-gray-900 font-mono tabular-nums flex-shrink-0">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Highlight label ──────────────────────────────────────────── */}
      <div className="text-xs text-gray-900 italic text-center">
        {HL_LABEL[highlight]}
      </div>

      {/* ── Side-by-side code panes ──────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        <CodePane
          filename="asyncRequestReply()"
          label={`"use workflow"`}
          htmlLines={orchestratorHtmlLines}
          activeLines={activeOrchestratorLines}
          hlColor={hlColor}
        />
        <CodePane
          filename="vendor-callback handler"
          label="API route"
          htmlLines={callbackHtmlLines}
          activeLines={activeCallbackLines}
          hlColor={hlColor}
        />
      </div>
    </div>
  );
}

// ── Code pane sub-component ─────────────────────────────────────────────

function CodePane({
  filename,
  label,
  htmlLines,
  activeLines,
  hlColor,
}: {
  filename: string;
  label: string;
  htmlLines: string[];
  activeLines: Set<number>;
  hlColor: string;
}) {
  return (
    <div className="rounded-lg border border-gray-300 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-background-100 border-b border-gray-300">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5" aria-hidden="true">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-500/40" />
            <span className="w-2.5 h-2.5 rounded-full bg-gray-500/40" />
            <span className="w-2.5 h-2.5 rounded-full bg-gray-500/40" />
          </div>
          <span className="text-xs font-mono text-gray-900">{filename}</span>
        </div>
        <span className="text-xs text-gray-900 font-mono">{label}</span>
      </div>
      <pre className="overflow-x-auto overflow-y-auto max-h-[420px] bg-background-100 p-5 text-[13px] leading-5">
        <code className="font-mono">
          {htmlLines.map((lineHtml, i) => {
            const lineNum = i + 1;
            const isActive = activeLines.has(lineNum);
            return (
              <div
                key={i}
                className={`transition-colors duration-300 ${
                  isActive ? `-mx-5 px-5 border-l-2 ${hlColor}` : ""
                }`}
                dangerouslySetInnerHTML={{ __html: lineHtml || " " }}
              />
            );
          })}
        </code>
      </pre>
    </div>
  );
}
