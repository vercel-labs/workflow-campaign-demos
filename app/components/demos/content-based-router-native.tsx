// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RouterCodeWorkbench } from "@/content-based-router/app/components/router-code-workbench";

type TicketType = "billing" | "technical" | "account" | "feedback";
type RunStatus = "routing" | "classifying" | "handling" | "done";
type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail" | "retry";

type RouterEvent =
  | { type: "ticket_received"; ticketId: string; subject: string }
  | { type: "classifying"; ticketId: string }
  | { type: "classified"; ticketId: string; ticketType: TicketType; confidence: number }
  | { type: "routing"; ticketId: string; destination: TicketType }
  | { type: "handler_processing"; ticketId: string; destination: TicketType; step: string }
  | { type: "handler_complete"; ticketId: string; destination: TicketType; resolution: string }
  | { type: "done"; ticketId: string; routedTo: TicketType; totalSteps: number };

type RouterAccumulator = {
  runId: string;
  ticketId: string;
  subject: string;
  status: RunStatus;
  classifiedAs: TicketType | null;
  confidence: number | null;
  handlerSteps: string[];
  resolution: string | null;
  totalSteps: number | null;
};

type RouterSnapshot = RouterAccumulator & {
  elapsedMs: number;
};

type StartResponse = {
  runId: string;
  ticketId: string;
  subject: string;
  priority: string;
  status: "routing";
};

export type WorkflowLineMap = {
  classify: number[];
  routeBilling: number[];
  routeTechnical: number[];
  routeAccount: number[];
  routeFeedback: number[];
  done: number[];
};

export type StepLineMap = {
  classifyTicket: number[];
  handleBilling: number[];
  handleTechnical: number[];
  handleAccount: number[];
  handleFeedback: number[];
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

const SAMPLE_TICKETS: Array<{ id: string; subject: string }> = [
  { id: "TKT-1001", subject: "Payment failed on my latest invoice" },
  { id: "TKT-1002", subject: "API timeout error in production deploy" },
  { id: "TKT-1003", subject: "Cannot login — password reset not working" },
  { id: "TKT-1004", subject: "Feature suggestion: add dark mode to dashboard" },
];

const TICKET_TYPE_COLORS: Record<TicketType, string> = {
  billing: "var(--color-amber-700)",
  technical: "var(--color-red-700)",
  account: "var(--color-blue-700)",
  feedback: "var(--color-green-700)",
};

const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  billing: "Billing",
  technical: "Technical",
  account: "Account",
  feedback: "Feedback",
};

function parseSseData(rawChunk: string): string {
  return rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
}

function parseRouterEvent(rawChunk: string): RouterEvent | null {
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

  if (type === "ticket_received" && typeof event.ticketId === "string" && typeof event.subject === "string") {
    return { type, ticketId: event.ticketId, subject: event.subject };
  }
  if (type === "classifying" && typeof event.ticketId === "string") {
    return { type, ticketId: event.ticketId };
  }
  if (type === "classified" && typeof event.ticketId === "string" && typeof event.ticketType === "string" && typeof event.confidence === "number") {
    return { type, ticketId: event.ticketId, ticketType: event.ticketType as TicketType, confidence: event.confidence };
  }
  if (type === "routing" && typeof event.ticketId === "string" && typeof event.destination === "string") {
    return { type, ticketId: event.ticketId, destination: event.destination as TicketType };
  }
  if (type === "handler_processing" && typeof event.ticketId === "string" && typeof event.destination === "string" && typeof event.step === "string") {
    return { type, ticketId: event.ticketId, destination: event.destination as TicketType, step: event.step };
  }
  if (type === "handler_complete" && typeof event.ticketId === "string" && typeof event.destination === "string" && typeof event.resolution === "string") {
    return { type, ticketId: event.ticketId, destination: event.destination as TicketType, resolution: event.resolution };
  }
  if (type === "done" && typeof event.ticketId === "string" && typeof event.routedTo === "string" && typeof event.totalSteps === "number") {
    return { type, ticketId: event.ticketId, routedTo: event.routedTo as TicketType, totalSteps: event.totalSteps };
  }

  return null;
}

function createAccumulator(start: StartResponse): RouterAccumulator {
  return {
    runId: start.runId,
    ticketId: start.ticketId,
    subject: start.subject,
    status: "routing",
    classifiedAs: null,
    confidence: null,
    handlerSteps: [],
    resolution: null,
    totalSteps: null,
  };
}

function applyRouterEvent(current: RouterAccumulator, event: RouterEvent): RouterAccumulator {
  switch (event.type) {
    case "ticket_received":
      return current;
    case "classifying":
      return { ...current, status: "classifying" };
    case "classified":
      return { ...current, classifiedAs: event.ticketType, confidence: event.confidence };
    case "routing":
      return { ...current, status: "handling" };
    case "handler_processing":
      return { ...current, handlerSteps: [...current.handlerSteps, event.step] };
    case "handler_complete":
      return { ...current, resolution: event.resolution };
    case "done":
      return { ...current, status: "done", totalSteps: event.totalSteps };
  }
}

function toSnapshot(accumulator: RouterAccumulator, startedAtMs: number): RouterSnapshot {
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
  snapshot: RouterSnapshot | null,
  workflowLineMap: WorkflowLineMap,
  stepLineMap: StepLineMap
): HighlightState {
  if (!snapshot) return EMPTY_HIGHLIGHT_STATE;

  const workflowGutterMarks: Record<number, GutterMarkKind> = {};
  const stepGutterMarks: Record<number, GutterMarkKind> = {};

  if (snapshot.status === "classifying") {
    return {
      workflowActiveLines: workflowLineMap.classify,
      stepActiveLines: stepLineMap.classifyTicket,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (snapshot.status === "handling" && snapshot.classifiedAs) {
    const dest = snapshot.classifiedAs;
    const wfLines =
      dest === "billing" ? workflowLineMap.routeBilling :
      dest === "technical" ? workflowLineMap.routeTechnical :
      dest === "account" ? workflowLineMap.routeAccount :
      workflowLineMap.routeFeedback;
    const stepLines =
      dest === "billing" ? stepLineMap.handleBilling :
      dest === "technical" ? stepLineMap.handleTechnical :
      dest === "account" ? stepLineMap.handleAccount :
      stepLineMap.handleFeedback;

    for (const line of stepLineMap.classifyTicket.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }

    return {
      workflowActiveLines: wfLines,
      stepActiveLines: stepLines,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (snapshot.status === "done") {
    for (const line of workflowLineMap.done.slice(0, 1)) {
      workflowGutterMarks[line] = "success";
    }
    if (snapshot.classifiedAs) {
      const stepLines =
        snapshot.classifiedAs === "billing" ? stepLineMap.handleBilling :
        snapshot.classifiedAs === "technical" ? stepLineMap.handleTechnical :
        snapshot.classifiedAs === "account" ? stepLineMap.handleAccount :
        stepLineMap.handleFeedback;
      for (const line of stepLines.slice(0, 1)) {
        stepGutterMarks[line] = "success";
      }
      for (const line of stepLineMap.classifyTicket.slice(0, 1)) {
        stepGutterMarks[line] = "success";
      }
    }

    return {
      workflowActiveLines: [],
      stepActiveLines: [],
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  return EMPTY_HIGHLIGHT_STATE;
}

function highlightToneForSnapshot(snapshot: RouterSnapshot | null): HighlightTone {
  if (!snapshot) return "amber";
  if (snapshot.status === "classifying") return "cyan";
  if (snapshot.status === "handling") return "amber";
  return "green";
}

type LogTone = "default" | "green" | "amber" | "red" | "cyan";
type LogEntry = { text: string; tone: LogTone };

function formatElapsedMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function eventToLogEntry(event: RouterEvent, elapsedMs: number): LogEntry {
  const ts = formatElapsedMs(elapsedMs);

  switch (event.type) {
    case "ticket_received":
      return { text: `[${ts}] ticket ${event.ticketId} received: "${event.subject}"`, tone: "default" };
    case "classifying":
      return { text: `[${ts}] classifying ticket content...`, tone: "cyan" };
    case "classified":
      return { text: `[${ts}] classified as ${event.ticketType} (confidence: ${(event.confidence * 100).toFixed(0)}%)`, tone: "cyan" };
    case "routing":
      return { text: `[${ts}] routing to ${event.destination} handler`, tone: "amber" };
    case "handler_processing":
      return { text: `[${ts}] [${event.destination}] ${event.step}`, tone: "default" };
    case "handler_complete":
      return { text: `[${ts}] [${event.destination}] ${event.resolution}`, tone: "green" };
    case "done":
      return { text: `[${ts}] done — routed to ${event.routedTo}, ${event.totalSteps} steps`, tone: "green" };
  }
}

const IDLE_LOG: LogEntry[] = [
  { text: "Idle: select a ticket to start the content-based router.", tone: "default" },
  { text: "The router classifies ticket content and branches to the matching handler.", tone: "default" },
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
  classifiedAs: TicketType | null
): string {
  if (status === "idle") {
    return "Waiting to start. Select a sample ticket to run the workflow.";
  }
  if (status === "classifying") {
    return "Classifying: inspecting ticket content to determine the correct handler.";
  }
  if (status === "routing" || status === "handling") {
    if (classifiedAs) {
      return `Handling: routed to the ${classifiedAs} handler based on content classification.`;
    }
    return "Routing: determining the appropriate handler for this ticket.";
  }
  return "Completed: ticket classified and processed by the specialized handler.";
}

export function ContentBasedRouterDemo({
  workflowCode,
  workflowLinesHtml,
  stepCode,
  stepLinesHtml,
  workflowLineMap,
  stepLineMap,
}: DemoProps) {
  const [selectedTicket, setSelectedTicket] = useState(0);
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RouterSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<LogEntry[]>(IDLE_LOG);

  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const accumulatorRef = useRef<RouterAccumulator | null>(null);
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

        const applyEvent = (event: RouterEvent) => {
          if (signal.aborted || !startedAtRef.current || !accumulatorRef.current) return;
          const elapsedMs = Math.max(0, Date.now() - startedAtRef.current);
          const nextAccumulator = applyRouterEvent(accumulatorRef.current, event);
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
            const event = parseRouterEvent(chunk);
            if (event) applyEvent(event);
          }
        }

        if (!signal.aborted && buffer.trim()) {
          const event = parseRouterEvent(buffer.replaceAll("\r\n", "\n"));
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

    const ticket = SAMPLE_TICKETS[selectedTicket];

    try {
      const controller = ensureAbortController();
      const payload = await postJson<StartResponse>(
        "/api/content-based-router",
        { ticketId: ticket.id, subject: ticket.subject, priority: "medium" },
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
        { text: `[0.00s] ticket ${ticket.id} submitted for routing`, tone: "default" },
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

  const effectiveStatus: RunStatus | "idle" = snapshot?.status ?? (runId ? "routing" : "idle");
  const isRunning = runId !== null && snapshot?.status !== "done";

  const highlights = useMemo(
    () => buildHighlightState(snapshot, workflowLineMap, stepLineMap),
    [snapshot, workflowLineMap, stepLineMap]
  );
  const highlightTone = useMemo(
    () => highlightToneForSnapshot(snapshot),
    [snapshot]
  );

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
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
              Sample Tickets
            </p>
            <div className="space-y-1.5">
              {SAMPLE_TICKETS.map((ticket, index) => (
                <button
                  key={ticket.id}
                  type="button"
                  disabled={isRunning}
                  onClick={() => setSelectedTicket(index)}
                  className={`w-full cursor-pointer rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    selectedTicket === index
                      ? "border-blue-700/60 bg-blue-700/10 text-gray-1000"
                      : "border-gray-400/70 bg-background-100 text-gray-900 hover:border-gray-300 hover:text-gray-1000"
                  }`}
                >
                  <span className="font-mono text-xs text-gray-900">{ticket.id}</span>
                  <span className="ml-2">{ticket.subject}</span>
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                ref={startButtonRef}
                onClick={() => { void handleStart(); }}
                disabled={isRunning}
                className="cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Route Ticket
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
            {statusExplanation(effectiveStatus, snapshot?.classifiedAs ?? null)}
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
              <span className="text-gray-900">Classification</span>
              <span className="font-mono text-gray-1000">
                {snapshot?.classifiedAs
                  ? `${TICKET_TYPE_LABELS[snapshot.classifiedAs]} (${((snapshot.confidence ?? 0) * 100).toFixed(0)}%)`
                  : "pending"}
              </span>
            </div>
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">Handler Steps</span>
              <span className="font-mono text-gray-1000">
                {snapshot?.handlerSteps.length ?? 0}
                {snapshot?.totalSteps ? ` / ${snapshot.totalSteps}` : ""}
              </span>
            </div>
          </div>

          {snapshot?.resolution && (
            <div className="rounded-md border border-green-700/40 bg-green-700/10 px-3 py-2">
              <p className="text-xs text-green-700">{snapshot.resolution}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <RouterGraph classifiedAs={snapshot?.classifiedAs ?? null} status={effectiveStatus} />
        <HandlerStepsList
          steps={snapshot?.handlerSteps ?? []}
          destination={snapshot?.classifiedAs ?? null}
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
        Content-Based Router: inspect message payload and dispatch to the matching handler.
      </p>

      <RouterCodeWorkbench
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

function RouterGraph({
  classifiedAs,
  status,
}: {
  classifiedAs: TicketType | null;
  status: RunStatus | "idle";
}) {
  const handlers: Array<{ id: TicketType; x: number; y: number; short: string; label: string }> = [
    { id: "billing", x: 50, y: 44, short: "BL", label: "Billing" },
    { id: "technical", x: 270, y: 44, short: "TC", label: "Technical" },
    { id: "account", x: 50, y: 212, short: "AC", label: "Account" },
    { id: "feedback", x: 270, y: 212, short: "FB", label: "Feedback" },
  ];

  const centerColor =
    status === "done"
      ? "var(--color-green-700)"
      : status === "classifying"
        ? "var(--color-cyan-700)"
        : status === "handling"
          ? "var(--color-amber-700)"
          : "var(--color-blue-700)";

  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Content-Based Router Graph
      </p>

      <svg
        viewBox="0 0 320 256"
        role="img"
        aria-label="Content-based router graph showing ticket classification to four handlers"
        className="h-auto w-full"
      >
        <rect x={0} y={0} width={320} height={256} fill="var(--color-background-100)" rx={8} />

        {handlers.map((node) => {
          const isActive = classifiedAs === node.id;
          const color = isActive
            ? TICKET_TYPE_COLORS[node.id]
            : "var(--color-gray-500)";

          return (
            <g key={node.id}>
              <line
                x1={160}
                y1={128}
                x2={node.x}
                y2={node.y}
                stroke={color}
                strokeWidth={isActive ? 2.5 : 1.5}
                strokeDasharray={isActive && status === "handling" ? "6 4" : undefined}
                className={isActive && status === "handling" ? "animate-pulse" : undefined}
              />
              <circle
                cx={node.x}
                cy={node.y}
                r={18}
                fill="var(--color-background-200)"
                stroke={color}
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              <text
                x={node.x}
                y={node.y + 4}
                textAnchor="middle"
                className={`font-mono text-xs ${isActive ? "fill-gray-1000" : "fill-gray-500"}`}
              >
                {node.short}
              </text>
              <text
                x={node.x}
                y={node.y + 30}
                textAnchor="middle"
                className={`font-mono text-xs ${isActive ? "fill-gray-900" : "fill-gray-500"}`}
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
          stroke={centerColor}
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
              : status === "classifying"
                ? "fill-cyan-700"
                : status === "handling"
                  ? "fill-amber-700"
                  : "fill-blue-700"
          }`}
        >
          RTR
        </text>
      </svg>
    </div>
  );
}

function HandlerStepsList({
  steps,
  destination,
  status,
}: {
  steps: string[];
  destination: TicketType | null;
  status: RunStatus | "idle";
}) {
  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Handler Steps
        {destination && (
          <span
            className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: `color-mix(in srgb, ${TICKET_TYPE_COLORS[destination]} 20%, transparent)`,
              color: TICKET_TYPE_COLORS[destination],
            }}
          >
            {TICKET_TYPE_LABELS[destination]}
          </span>
        )}
      </p>
      <ul className="space-y-2">
        {steps.length === 0 ? (
          <li className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2 text-sm text-gray-900">
            {status === "idle" ? "No handler active" : "Waiting for handler steps..."}
          </li>
        ) : (
          steps.map((step, index) => (
            <li
              key={`${step}-${index}`}
              className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-300 text-[10px] font-mono text-gray-1000">
                  {index + 1}
                </span>
                <span className="text-sm text-gray-1000">{step}</span>
              </div>
            </li>
          ))
        )}
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
  if (status === "classifying") {
    return (
      <span className="rounded-full bg-cyan-700/20 px-2 py-0.5 text-xs font-medium text-cyan-700">
        classifying
      </span>
    );
  }
  if (status === "routing" || status === "handling") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        handling
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
} as unknown as Parameters<typeof ContentBasedRouterDemo>[0];

export default function ContentBasedRouterNativeDemo() {
  return <ContentBasedRouterDemo {...demoProps} />;
}
