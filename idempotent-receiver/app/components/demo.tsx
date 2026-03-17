"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";

// ── Types ───────────────────────────────────────────────────────────────

type Status = "idle" | "running" | "completed" | "deduplicated";

type HighlightState =
  | "none"
  | "checking"
  | "duplicate"
  | "processing"
  | "processed"
  | "done";

type IdempotentEvent =
  | { type: "checking_key"; idempotencyKey: string }
  | { type: "duplicate_detected"; idempotencyKey: string; cachedResult: PaymentResult }
  | { type: "processing_payment"; idempotencyKey: string; amount: number }
  | { type: "payment_processed"; idempotencyKey: string; result: PaymentResult }
  | { type: "done"; status: "completed" | "deduplicated"; idempotencyKey: string };

type PaymentResult = {
  transactionId: string;
  amount: number;
  currency: string;
  status: "succeeded";
  processedAt: string;
};

type LogEntry = {
  id: string;
  timestamp: number;
  message: string;
  tone: "info" | "success" | "warn" | "error";
};

// ── Highlight maps ──────────────────────────────────────────────────────

const HL_COLOR: Record<string, string> = {
  none: "",
  checking: "border-blue-700 bg-blue-700/10",
  duplicate: "border-amber-700 bg-amber-700/10",
  processing: "border-cyan-700 bg-cyan-700/10",
  processed: "border-green-700 bg-green-700/10",
  done: "border-green-700 bg-green-700/10",
};

const HL_LABEL: Record<string, string> = {
  none: "Click Send Payment to start the workflow",
  checking: "checkIdempotencyKey() → looking up durable state for this key",
  duplicate: "Duplicate detected → returning cached result, no reprocessing",
  processing: "processPayment() → executing payment for the first time",
  processed: "Payment stored → future requests with this key will be deduplicated",
  done: "Workflow complete",
};

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
  stepHtmlLines: string[];
  stepLineMap: Record<string, number[]>;
}

// ── Component ───────────────────────────────────────────────────────────

export function IdempotentReceiverDemo({
  orchestratorHtmlLines,
  orchestratorLineMap,
  stepHtmlLines,
  stepLineMap,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [highlight, setHighlight] = useState<HighlightState>("none");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentKeys, setSentKeys] = useState<Set<string>>(new Set());
  const [lastKey, setLastKey] = useState<string | null>(null);

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

  // ── Active lines for code highlighting ────────────────────────────
  const activeOrchestratorLines = useMemo(() => {
    const set = new Set<number>();
    if (highlight === "none") return set;

    if (highlight === "checking") {
      for (const n of orchestratorLineMap.checkKey ?? []) set.add(n);
    } else if (highlight === "duplicate") {
      for (const n of orchestratorLineMap.duplicateBranch ?? []) set.add(n);
    } else if (highlight === "processing" || highlight === "processed") {
      for (const n of orchestratorLineMap.processBranch ?? []) set.add(n);
    } else if (highlight === "done") {
      for (const n of orchestratorLineMap.returnResult ?? []) set.add(n);
    }

    return set;
  }, [highlight, orchestratorLineMap]);

  const activeStepLines = useMemo(() => {
    const set = new Set<number>();
    if (highlight === "none" || highlight === "done") return set;

    if (highlight === "checking") {
      for (const n of stepLineMap.checkKey ?? []) set.add(n);
    } else if (highlight === "duplicate") {
      for (const n of stepLineMap.emitDuplicate ?? []) set.add(n);
    } else if (highlight === "processing") {
      for (const n of stepLineMap.processPayment ?? []) set.add(n);
    } else if (highlight === "processed") {
      for (const n of stepLineMap.storeResult ?? []) set.add(n);
    }

    return set;
  }, [highlight, stepLineMap]);

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
              const event = parseSseChunk(chunk) as IdempotentEvent | null;
              if (!event) continue;

              if (event.type === "checking_key") {
                setHighlight("checking");
                addLog(
                  `Checking idempotency key: ${event.idempotencyKey}`,
                  "info"
                );
              } else if (event.type === "duplicate_detected") {
                setHighlight("duplicate");
                addLog(
                  `DUPLICATE: key "${event.idempotencyKey}" already processed → returning cached txn ${event.cachedResult.transactionId}`,
                  "warn"
                );
              } else if (event.type === "processing_payment") {
                setHighlight("processing");
                addLog(
                  `Processing payment: $${(event.amount / 100).toFixed(2)} with key "${event.idempotencyKey}"`,
                  "info"
                );
              } else if (event.type === "payment_processed") {
                setHighlight("processed");
                addLog(
                  `Payment succeeded: txn ${event.result.transactionId} → stored for deduplication`,
                  "success"
                );
              } else if (event.type === "done") {
                if (event.status === "deduplicated") {
                  setStatus("deduplicated");
                  setHighlight("done");
                  addLog("Workflow complete: request was deduplicated", "warn");
                } else {
                  setStatus("completed");
                  setHighlight("done");
                  addLog("Workflow complete: payment processed", "success");
                }
              }
            }
          }

          if (buffer.trim()) {
            const event = parseSseChunk(buffer) as IdempotentEvent | null;
            if (event?.type === "done") {
              setStatus(
                event.status === "deduplicated" ? "deduplicated" : "completed"
              );
              setHighlight("done");
            }
          }
        } catch {
          // AbortError or network error — ignore
        }
      })();
    },
    [addLog]
  );

  // ── Send payment ──────────────────────────────────────────────────
  const sendPayment = useCallback(
    async (isDuplicate: boolean) => {
      setBusy(true);
      setError(null);
      setStatus("running");
      setHighlight("none");

      const key = isDuplicate && lastKey ? lastKey : `idem_${Date.now()}`;

      try {
        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;

        addLog(
          isDuplicate
            ? `Sending DUPLICATE request with key "${key}"`
            : `Sending payment with new key "${key}"`,
          isDuplicate ? "warn" : "info"
        );

        const res = await fetch("/api/idempotent-receiver", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idempotencyKey: key,
            amount: 4999,
            currency: "USD",
            description: "Pro subscription",
          }),
          signal: ac.signal,
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? `Request failed: ${res.status}`);
        }

        if (!isDuplicate) {
          setLastKey(key);
          setSentKeys((prev) => new Set(prev).add(key));
        }

        connectSse(data.runId, ac.signal);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        const detail = err instanceof Error ? err.message : "Unknown error";
        setError(detail);
        setStatus("idle");
        addLog(`Error: ${detail}`, "error");
      } finally {
        setBusy(false);
      }
    },
    [lastKey, addLog, connectSse]
  );

  // ── Reset ─────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setHighlight("none");
    setLog([]);
    setError(null);
    setBusy(false);
    setLastKey(null);
    setSentKeys(new Set());
  }, []);

  const hlColor = HL_COLOR[highlight] ?? "";
  const canSendDuplicate = lastKey !== null && !busy;

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

      {/* ── Controls ───────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void sendPayment(false)}
            disabled={busy}
            className="px-4 py-2 rounded-md bg-white text-black font-medium text-sm hover:bg-white/80 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "Processing…" : "Send Payment"}
          </button>

          <button
            type="button"
            onClick={() => void sendPayment(true)}
            disabled={!canSendDuplicate}
            className="px-4 py-2 rounded-md border border-amber-700/40 text-amber-700 font-medium text-sm hover:bg-amber-700/10 cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Send Duplicate
          </button>
        </div>

        <div className="flex items-center gap-3">
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

      {/* ── Key indicator ──────────────────────────────────────────── */}
      {lastKey && (
        <div className="rounded-md border border-gray-400/70 bg-background-100 px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-gray-900">Last Idempotency-Key</span>
          <code className="text-xs font-mono text-gray-1000">{lastKey}</code>
        </div>
      )}

      {/* ── Sent keys summary ──────────────────────────────────────── */}
      {sentKeys.size > 0 && (
        <div className="rounded-md border border-gray-400/70 bg-background-100 px-3 py-2 flex items-center justify-between">
          <span className="text-xs text-gray-900">Unique keys processed</span>
          <span className="text-xs font-mono text-gray-1000">{sentKeys.size}</span>
        </div>
      )}

      {/* ── Event log ──────────────────────────────────────────────── */}
      <div
        ref={logRef}
        className="h-[220px] overflow-y-auto rounded-md border border-gray-300 bg-background-100"
        role="log"
        aria-live="polite"
        aria-label="Idempotency event log"
      >
        {log.length === 0 ? (
          <p className="py-16 text-center text-sm text-gray-900">
            Click Send Payment to process a request, then Send Duplicate to see
            deduplication in action.
          </p>
        ) : (
          <div className="divide-y divide-gray-300">
            {log.map((entry) => (
              <div
                key={entry.id}
                className="px-4 py-2.5 flex items-start gap-3"
              >
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

      {/* ── Highlight label ──────────────────────────────────────────── */}
      <div className="text-xs text-gray-900 italic text-center">
        {HL_LABEL[highlight]}
      </div>

      {/* ── Side-by-side code panes ──────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        <CodePane
          filename="idempotentReceiver()"
          label={`"use workflow"`}
          htmlLines={orchestratorHtmlLines}
          activeLines={activeOrchestratorLines}
          hlColor={hlColor}
        />
        <CodePane
          filename="checkIdempotencyKey() / processPayment()"
          label={`"use step"`}
          htmlLines={stepHtmlLines}
          activeLines={activeStepLines}
          hlColor={hlColor}
        />
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Status }) {
  if (status === "completed") {
    return (
      <span className="rounded-full bg-green-700/20 px-2 py-0.5 text-xs font-medium text-green-700">
        processed
      </span>
    );
  }

  if (status === "deduplicated") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        deduplicated
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
