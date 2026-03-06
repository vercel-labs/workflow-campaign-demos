"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";

// ── Types ───────────────────────────────────────────────────────────────

type PaymentEventType =
  | "payment.created"
  | "payment.requires_action"
  | "payment.succeeded"
  | "payment.failed"
  | "refund.created"
  | "order.completed";

interface FeedEntry {
  id: string;
  type: PaymentEventType;
  amount?: number;
  response: string;
  timestamp: number;
}

type Status = "idle" | "starting" | "listening" | "settled";

type HighlightState =
  | "none"
  | "connect"
  | "payment.created"
  | "payment.requires_action"
  | "payment.succeeded"
  | "payment.failed"
  | "refund.created"
  | "order.completed"
  | "done";

// Phase drives which buttons are enabled
type Phase =
  | "init"              // only payment.created
  | "created"           // requires_action, succeeded, failed
  | "action_required"   // succeeded, failed
  | "failed"            // payment.created (retry)
  | "succeeded"         // refund.created + Complete Order
  ;

const PHASE_EVENTS: Record<Phase, Set<PaymentEventType>> = {
  init: new Set(["payment.created"]),
  created: new Set(["payment.requires_action", "payment.succeeded", "payment.failed"]),
  action_required: new Set(["payment.succeeded", "payment.failed"]),
  failed: new Set(["payment.created"]),
  succeeded: new Set(["refund.created"]),
};

const EVENT_TO_PHASE: Record<PaymentEventType, Phase> = {
  "payment.created": "created",
  "payment.requires_action": "action_required",
  "payment.succeeded": "succeeded",
  "payment.failed": "failed",
  "refund.created": "succeeded",
  "order.completed": "succeeded",
};

// ── Event config ────────────────────────────────────────────────────────

const EVENTS: {
  type: PaymentEventType;
  label: string;
  dot: string;
  border: string;
  focusRing: string;
}[] = [
  {
    type: "payment.created",
    label: "Payment Created",
    dot: "bg-blue-700",
    border: "border-blue-700/30 hover:border-blue-700/60",
    focusRing: "focus-visible:ring-blue-700/60",
  },
  {
    type: "payment.requires_action",
    label: "Requires Action",
    dot: "bg-purple-700",
    border: "border-purple-700/30 hover:border-purple-700/60",
    focusRing: "focus-visible:ring-purple-700/60",
  },
  {
    type: "payment.succeeded",
    label: "Payment Succeeded",
    dot: "bg-green-700",
    border: "border-green-700/30 hover:border-green-700/60",
    focusRing: "focus-visible:ring-green-700/60",
  },
  {
    type: "payment.failed",
    label: "Payment Failed",
    dot: "bg-red-700",
    border: "border-red-700/30 hover:border-red-700/60",
    focusRing: "focus-visible:ring-red-700/60",
  },
  {
    type: "refund.created",
    label: "Refund Created",
    dot: "bg-amber-700",
    border: "border-amber-700/30 hover:border-amber-700/60",
    focusRing: "focus-visible:ring-amber-700/60",
  },
];

const DOT_COLOR: Record<string, string> = {
  ...Object.fromEntries(EVENTS.map((ev) => [ev.type, ev.dot])),
  "order.completed": "bg-green-700",
};

const TEXT_COLOR: Record<string, string> = {
  ...Object.fromEntries(EVENTS.map((ev) => [ev.type, ev.dot.replace("bg-", "text-")])),
  "order.completed": "text-green-700",
};

const HL_COLOR: Record<string, string> = {
  connect: "border-blue-700 bg-blue-700/10",
  "payment.created": "border-blue-700 bg-blue-700/10",
  "payment.requires_action": "border-purple-700 bg-purple-700/10",
  "payment.succeeded": "border-green-700 bg-green-700/10",
  "payment.failed": "border-red-700 bg-red-700/10",
  "refund.created": "border-amber-700 bg-amber-700/10",
  "order.completed": "border-green-700 bg-green-700/10",
  done: "border-green-700 bg-green-700/10",
};

const HL_LABEL: Record<string, string> = {
  none: "Click an event to trace the code path",
  connect: "createWebhook() \u2192 registers a durable endpoint",
  "payment.created": "payment.created \u2192 charge received",
  "payment.requires_action": "payment.requires_action \u2192 awaiting 3DS / customer auth",
  "payment.succeeded": "payment.succeeded \u2192 captured \u2014 listening for refund at zero compute",
  "payment.failed": "payment.failed \u2192 flagged for review",
  "refund.created": "refund.created \u2192 refunded, order settled",
  "order.completed": "order.completed \u2192 order finalized, workflow exits",
  done: "Workflow returned \u2014 order settled",
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
  stepHtmlLines: string[];
  stepLineMap: Record<string, number[]>;
}

// ── Component ───────────────────────────────────────────────────────────

export function PaymentWebhookDemo({
  orchestratorHtmlLines,
  orchestratorLineMap,
  stepHtmlLines,
  stepLineMap,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [webhookToken, setWebhookToken] = useState<string | null>(null);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [highlight, setHighlight] = useState<HighlightState>("none");
  const [orderAmount] = useState(() => Math.floor(Math.random() * 49900 + 100));
  const [phase, setPhase] = useState<Phase>("init");

  const feedRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    feedRef.current?.scrollTo({
      top: feedRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [feed]);

  // Clean up SSE on unmount
  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  const enabledEvents = PHASE_EVENTS[phase];

  // Compute active lines for each pane
  const activeOrchestratorLines = useMemo(() => {
    const set = new Set<number>();
    if (highlight === "none") return set;

    if (highlight === "connect") {
      for (const n of orchestratorLineMap.connect ?? []) set.add(n);
      return set;
    }

    if (highlight === "done") {
      for (const n of orchestratorLineMap.returnResult ?? []) set.add(n);
      return set;
    }

    // Event types: loop lines in orchestrator
    for (const n of orchestratorLineMap.loop ?? []) set.add(n);

    // Only refund.created triggers the break
    if (highlight === "refund.created" || highlight === "order.completed") {
      for (const n of orchestratorLineMap.breakLine ?? []) set.add(n);
    }

    return set;
  }, [highlight, orchestratorLineMap]);

  const activeStepLines = useMemo(() => {
    const set = new Set<number>();
    if (
      highlight === "none" ||
      highlight === "connect" ||
      highlight === "done"
    )
      return set;

    for (const n of stepLineMap.parse ?? []) set.add(n);
    for (const n of stepLineMap[highlight] ?? []) set.add(n);

    return set;
  }, [highlight, stepLineMap]);

  // ── Connect SSE stream ─────────────────────────────────────────────
  const connectSse = useCallback((id: string, signal: AbortSignal) => {
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

            if (event.type === "webhook_ready") {
              setWebhookToken(event.token as string);
              setStatus("listening");
              setHighlight("connect");
            } else if (event.type === "done") {
              setStatus("settled");
              setHighlight("done");
            }
          }
        }

        if (buffer.trim()) {
          const event = parseSseChunk(buffer) as Record<string, unknown> | null;
          if (event?.type === "done") {
            setStatus("settled");
            setHighlight("done");
          }
        }
      } catch {
        // AbortError or network error — ignore
      }
    })();
  }, []);

  // ── Place order ────────────────────────────────────────────────────
  const placeOrder = useCallback(async () => {
    setBusy(true);
    setError(null);
    setStatus("starting");
    try {
      const res = await fetch("/api/webhook-basics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: "ord-42" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(parseApiError(data, res.statusText));
      }
      const id = data.runId as string;
      setRunId(id);
      setFeed([]);
      setPhase("init");

      // Connect SSE to receive webhook_ready + done events
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

  // ── Send event ──────────────────────────────────────────────────────
  const sendEvent = useCallback(
    async (type: PaymentEventType) => {
      if (!webhookToken) return;
      setBusy(true);
      setError(null);
      try {
        const amount = orderAmount;

        const res = await fetch(`/api/webhook/${encodeURIComponent(webhookToken)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, amount }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(parseApiError(data as Record<string, unknown>, res.statusText));
        }

        const action = (data as Record<string, unknown>).action as string | undefined;

        setFeed((prev) => [
          ...prev,
          {
            id: `${type}-${Date.now()}`,
            type,
            amount,
            response: action ?? "Acknowledged",
            timestamp: Date.now(),
          },
        ]);

        setHighlight(type);

        // Advance the phase
        const nextPhase = EVENT_TO_PHASE[type];
        if (nextPhase) setPhase(nextPhase);

        // refund.created is a terminal event — SSE will emit "done"
        if (type === "refund.created") {
          setTimeout(() => setHighlight("done"), 600);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Request failed");
      } finally {
        setBusy(false);
      }
    },
    [webhookToken, orderAmount]
  );

  // ── Complete order (happy path, no refund) ─────────────────────────
  const completeOrder = useCallback(async () => {
    if (!webhookToken) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/webhook/${encodeURIComponent(webhookToken)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "order.completed" }),
      });
      if (!res.ok) {
        throw new Error("Failed to complete order");
      }
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const action = data.action as string | undefined;

      setFeed((prev) => [
        ...prev,
        {
          id: `order.completed-${Date.now()}`,
          type: "order.completed" as PaymentEventType,
          response: action ?? "Order completed",
          timestamp: Date.now(),
        },
      ]);

      setHighlight("order.completed");
      setTimeout(() => setHighlight("done"), 600);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete order");
    } finally {
      setBusy(false);
    }
  }, [webhookToken]);

  // ── Reset ───────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus("idle");
    setRunId(null);
    setWebhookToken(null);
    setFeed([]);
    setError(null);
    setBusy(false);
    setHighlight("none");
    setPhase("init");
  }, []);

  // ── Highlight color for current state ───────────────────────────────
  const hlColor = HL_COLOR[highlight] ?? "border-blue-700 bg-blue-700/10";

  // ── Idle state ────────────────────────────────────────────────────────
  if (status === "idle") {
    return (
      <div className="py-16 text-center">
        <p className="mb-6 text-sm text-gray-900">
          Simulates an order{"\u2019"}s payment lifecycle. Watch the code
          highlight in sync as each event is processed.
        </p>
        <button
          onClick={() => void placeOrder()}
          disabled={busy}
          className="px-6 py-2.5 rounded-md bg-white text-black font-medium text-sm hover:bg-white/80 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700/60"
        >
          {busy ? "Starting\u2026" : "Place Order"}
        </button>
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    );
  }

  // ── Starting state (waiting for webhook_ready) ────────────────────────
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

  // ── Active / settled state ──────────────────────────────────────────
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
              status === "listening"
                ? "bg-green-700 animate-pulse"
                : "bg-gray-500"
            }`}
          />
          <code className="text-sm font-mono text-gray-900">
            {webhookToken ?? "order:ord-42"}
          </code>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-medium ${
              status === "listening" ? "text-green-700" : "text-gray-900"
            }`}
          >
            {status === "listening"
              ? phase === "succeeded"
                ? "Paid \u2014 listening for refund"
                : "Listening \u2014 zero compute"
              : "Order settled"}
          </span>
          <button
            onClick={reset}
            className={`px-3 py-1 rounded-md border text-xs cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 ${
              status === "settled"
                ? "border-green-700 text-green-700 bg-green-700/10 animate-pulse focus-visible:ring-green-700/60"
                : "border-gray-400 text-gray-900 hover:border-gray-300 hover:text-gray-1000 focus-visible:ring-blue-700/60"
            }`}
          >
            {status === "settled" ? "New Order" : "Reset"}
          </button>
        </div>
      </div>

      {/* ── Two-column: simulator + feed ───────────────────────────── */}
      <div className="grid md:grid-cols-[220px_1fr] gap-4">
        {/* Event simulator */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-gray-900 uppercase tracking-widest mb-1">
            Simulate Event
          </div>
          {EVENTS.map((ev) => (
            <button
              key={ev.type}
              onClick={() => void sendEvent(ev.type)}
              disabled={busy || status !== "listening" || !enabledEvents.has(ev.type)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md border text-sm transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 ${ev.focusRing} ${ev.border}`}
            >
              <span className={`h-2 w-2 rounded-full ${ev.dot}`} />
              <span className="text-gray-1000">{ev.label}</span>
            </button>
          ))}
          {/* Complete Order — happy path exit after payment succeeded */}
          {phase === "succeeded" && status === "listening" && (
            <button
              onClick={() => void completeOrder()}
              disabled={busy}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md border text-sm transition-colors cursor-pointer border-green-700/30 hover:border-green-700/60 bg-green-700/5 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700/60"
            >
              <span className="h-2 w-2 rounded-full bg-green-700" />
              <span className="text-green-700 font-medium">Complete Order</span>
            </button>
          )}
        </div>

        {/* Event feed */}
        <div
          ref={feedRef}
          className="h-[280px] overflow-y-auto rounded-md border border-gray-300 bg-background-100"
          role="log"
          aria-live="polite"
          aria-label="Payment event feed"
        >
          {feed.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-900">
              Click an event to send it to the webhook{"\u2026"}
            </p>
          ) : (
            <div className="divide-y divide-gray-300">
              {feed.map((entry) => (
                <div
                  key={entry.id}
                  className="px-4 py-3 flex items-start gap-3"
                >
                  <span
                    className={`mt-1.5 h-2 w-2 rounded-full flex-shrink-0 ${
                      DOT_COLOR[entry.type] ?? "bg-gray-500"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={`text-sm font-medium font-mono ${
                          TEXT_COLOR[entry.type] ?? "text-gray-900"
                        }`}
                      >
                        {entry.type}
                      </span>
                      <span className="text-xs text-gray-900 font-mono tabular-nums flex-shrink-0">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {entry.amount != null && (
                        <span className="text-xs text-gray-1000 font-mono tabular-nums">
                          ${(entry.amount / 100).toFixed(2)}
                        </span>
                      )}
                      <span className="text-xs text-gray-900">
                        {"\u2192"} {entry.response}
                      </span>
                    </div>
                  </div>
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
        {/* Orchestrator pane */}
        <CodePane
          filename="paymentWebhook()"
          label={`"use workflow"`}
          htmlLines={orchestratorHtmlLines}
          activeLines={activeOrchestratorLines}
          hlColor={hlColor}
        />

        {/* Step pane */}
        <CodePane
          filename="processPaymentEvent()"
          label={`"use step"`}
          htmlLines={stepHtmlLines}
          activeLines={activeStepLines}
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
