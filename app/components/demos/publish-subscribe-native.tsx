// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PubSubCodeWorkbench } from "@/publish-subscribe/app/components/pubsub-code-workbench";

type Topic = "orders" | "inventory" | "shipping" | "analytics";
type RunStatus = "publishing" | "filtering" | "delivering" | "done";
type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail" | "retry";

type Subscriber = {
  id: string;
  name: string;
  topics: Topic[];
};

type SubscriberStatus = "idle" | "matched" | "skipped" | "delivering" | "delivered";

type PubSubEvent =
  | { type: "subscribers_registered"; subscribers: Subscriber[] }
  | { type: "message_published"; topic: Topic; payload: string }
  | { type: "filtering"; topic: Topic; total: number; matched: number }
  | { type: "delivering"; subscriberId: string; subscriberName: string; topic: Topic }
  | { type: "delivered"; subscriberId: string; subscriberName: string; topic: Topic }
  | { type: "subscriber_skipped"; subscriberId: string; subscriberName: string; topic: Topic }
  | { type: "done"; topic: Topic; delivered: number; skipped: number };

type PubSubAccumulator = {
  runId: string;
  topic: Topic;
  payload: string;
  status: RunStatus;
  subscribers: Record<string, { name: string; topics: Topic[]; status: SubscriberStatus }>;
  delivered: number;
  skipped: number;
};

type PubSubSnapshot = PubSubAccumulator & {
  elapsedMs: number;
};

type StartResponse = {
  runId: string;
  topic: Topic;
  payload: string;
  status: "publishing";
};

export type WorkflowLineMap = {
  register: number[];
  filter: number[];
  deliver: number[];
  summarize: number[];
};

export type StepLineMap = {
  registerSubscribers: number[];
  filterSubscribers: number[];
  deliverToSubscribers: number[];
  summarizeDelivery: number[];
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

const TOPIC_OPTIONS: Array<{ id: Topic; label: string; color: string }> = [
  { id: "orders", label: "Orders", color: "var(--color-amber-700)" },
  { id: "inventory", label: "Inventory", color: "var(--color-blue-700)" },
  { id: "shipping", label: "Shipping", color: "var(--color-green-700)" },
  { id: "analytics", label: "Analytics", color: "var(--color-cyan-700)" },
];

const SAMPLE_PAYLOADS: Record<Topic, string> = {
  orders: "New order #ORD-9182 placed — 3 items, $147.50",
  inventory: "SKU-4401 stock dropped below reorder threshold (qty: 12)",
  shipping: "Package #PKG-3310 dispatched via FedEx Express",
  analytics: "Daily active users crossed 10k milestone",
};

function parseSseData(rawChunk: string): string {
  return rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
}

export function parsePubSubEvent(rawChunk: string): PubSubEvent | null {
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

  if (type === "subscribers_registered" && Array.isArray(event.subscribers)) {
    return { type, subscribers: event.subscribers as Subscriber[] };
  }
  if (type === "message_published" && typeof event.topic === "string" && typeof event.payload === "string") {
    return { type, topic: event.topic as Topic, payload: event.payload };
  }
  if (type === "filtering" && typeof event.topic === "string" && typeof event.total === "number" && typeof event.matched === "number") {
    return { type, topic: event.topic as Topic, total: event.total, matched: event.matched };
  }
  if (type === "delivering" && typeof event.subscriberId === "string" && typeof event.subscriberName === "string" && typeof event.topic === "string") {
    return { type, subscriberId: event.subscriberId, subscriberName: event.subscriberName, topic: event.topic as Topic };
  }
  if (type === "delivered" && typeof event.subscriberId === "string" && typeof event.subscriberName === "string" && typeof event.topic === "string") {
    return { type, subscriberId: event.subscriberId, subscriberName: event.subscriberName, topic: event.topic as Topic };
  }
  if (type === "subscriber_skipped" && typeof event.subscriberId === "string" && typeof event.subscriberName === "string" && typeof event.topic === "string") {
    return { type, subscriberId: event.subscriberId, subscriberName: event.subscriberName, topic: event.topic as Topic };
  }
  if (type === "done" && typeof event.topic === "string" && typeof event.delivered === "number" && typeof event.skipped === "number") {
    return { type, topic: event.topic as Topic, delivered: event.delivered, skipped: event.skipped };
  }

  return null;
}

export function createAccumulator(start: StartResponse): PubSubAccumulator {
  return {
    runId: start.runId,
    topic: start.topic,
    payload: start.payload,
    status: "publishing",
    subscribers: {},
    delivered: 0,
    skipped: 0,
  };
}

export function applyPubSubEvent(current: PubSubAccumulator, event: PubSubEvent): PubSubAccumulator {
  switch (event.type) {
    case "subscribers_registered": {
      const subscribers: PubSubAccumulator["subscribers"] = {};
      for (const sub of event.subscribers) {
        subscribers[sub.id] = { name: sub.name, topics: sub.topics, status: "idle" };
      }
      return { ...current, subscribers };
    }
    case "message_published":
      return { ...current, status: "filtering" };
    case "filtering":
      return current;
    case "subscriber_skipped": {
      const sub = current.subscribers[event.subscriberId];
      if (!sub) return current;
      return {
        ...current,
        subscribers: {
          ...current.subscribers,
          [event.subscriberId]: { ...sub, status: "skipped" },
        },
        skipped: current.skipped + 1,
      };
    }
    case "delivering": {
      const sub = current.subscribers[event.subscriberId];
      if (!sub) return current;
      return {
        ...current,
        status: "delivering",
        subscribers: {
          ...current.subscribers,
          [event.subscriberId]: { ...sub, status: "delivering" },
        },
      };
    }
    case "delivered": {
      const sub = current.subscribers[event.subscriberId];
      if (!sub) return current;
      return {
        ...current,
        subscribers: {
          ...current.subscribers,
          [event.subscriberId]: { ...sub, status: "delivered" },
        },
        delivered: current.delivered + 1,
      };
    }
    case "done":
      return { ...current, status: "done" };
  }
}

function toSnapshot(accumulator: PubSubAccumulator, startedAtMs: number): PubSubSnapshot {
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
  snapshot: PubSubSnapshot | null,
  workflowLineMap: WorkflowLineMap,
  stepLineMap: StepLineMap
): HighlightState {
  if (!snapshot) return EMPTY_HIGHLIGHT_STATE;

  const workflowGutterMarks: Record<number, GutterMarkKind> = {};
  const stepGutterMarks: Record<number, GutterMarkKind> = {};

  if (snapshot.status === "publishing") {
    return {
      workflowActiveLines: workflowLineMap.register,
      stepActiveLines: stepLineMap.registerSubscribers,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (snapshot.status === "filtering") {
    for (const line of workflowLineMap.register.slice(0, 1)) {
      workflowGutterMarks[line] = "success";
    }
    for (const line of stepLineMap.registerSubscribers.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }
    return {
      workflowActiveLines: workflowLineMap.filter,
      stepActiveLines: stepLineMap.filterSubscribers,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (snapshot.status === "delivering") {
    for (const line of workflowLineMap.register.slice(0, 1)) {
      workflowGutterMarks[line] = "success";
    }
    for (const line of workflowLineMap.filter.slice(0, 1)) {
      workflowGutterMarks[line] = "success";
    }
    for (const line of stepLineMap.registerSubscribers.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }
    for (const line of stepLineMap.filterSubscribers.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }
    return {
      workflowActiveLines: workflowLineMap.deliver,
      stepActiveLines: stepLineMap.deliverToSubscribers,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  // done
  for (const line of workflowLineMap.summarize.slice(0, 1)) {
    workflowGutterMarks[line] = "success";
  }
  for (const line of workflowLineMap.register.slice(0, 1)) {
    workflowGutterMarks[line] = "success";
  }
  for (const line of workflowLineMap.filter.slice(0, 1)) {
    workflowGutterMarks[line] = "success";
  }
  for (const line of workflowLineMap.deliver.slice(0, 1)) {
    workflowGutterMarks[line] = "success";
  }
  for (const line of stepLineMap.registerSubscribers.slice(0, 1)) {
    stepGutterMarks[line] = "success";
  }
  for (const line of stepLineMap.filterSubscribers.slice(0, 1)) {
    stepGutterMarks[line] = "success";
  }
  for (const line of stepLineMap.deliverToSubscribers.slice(0, 1)) {
    stepGutterMarks[line] = "success";
  }
  for (const line of stepLineMap.summarizeDelivery.slice(0, 1)) {
    stepGutterMarks[line] = "success";
  }

  return {
    workflowActiveLines: [],
    stepActiveLines: [],
    workflowGutterMarks,
    stepGutterMarks,
  };
}

function highlightToneForSnapshot(snapshot: PubSubSnapshot | null): HighlightTone {
  if (!snapshot) return "amber";
  if (snapshot.status === "filtering") return "cyan";
  if (snapshot.status === "delivering") return "amber";
  return "green";
}

type LogTone = "default" | "green" | "amber" | "red" | "cyan";
type LogEntry = { text: string; tone: LogTone };

function formatElapsedMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function eventToLogEntry(event: PubSubEvent, elapsedMs: number): LogEntry {
  const ts = formatElapsedMs(elapsedMs);

  switch (event.type) {
    case "subscribers_registered":
      return { text: `[${ts}] ${event.subscribers.length} subscribers registered`, tone: "default" };
    case "message_published":
      return { text: `[${ts}] published to topic "${event.topic}": ${event.payload}`, tone: "amber" };
    case "filtering":
      return { text: `[${ts}] filtering: ${event.matched}/${event.total} subscribers match topic`, tone: "cyan" };
    case "subscriber_skipped":
      return { text: `[${ts}] skipped ${event.subscriberName} (not subscribed to ${event.topic})`, tone: "default" };
    case "delivering":
      return { text: `[${ts}] delivering to ${event.subscriberName}...`, tone: "amber" };
    case "delivered":
      return { text: `[${ts}] delivered to ${event.subscriberName}`, tone: "green" };
    case "done":
      return { text: `[${ts}] done — delivered=${event.delivered}, skipped=${event.skipped}`, tone: "green" };
  }
}

const IDLE_LOG: LogEntry[] = [
  { text: "Idle: select a topic and click Publish to start.", tone: "default" },
  { text: "Only subscribers matching the topic will receive the message.", tone: "default" },
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
  status: RunStatus | "idle"
): string {
  if (status === "idle") {
    return "Waiting to start. Select a topic and click Publish to run the workflow.";
  }
  if (status === "publishing") {
    return "Registering subscribers from the topic registry.";
  }
  if (status === "filtering") {
    return "Filtering: matching subscribers against the published topic.";
  }
  if (status === "delivering") {
    return "Delivering: sending the message to each matched subscriber sequentially.";
  }
  return "Completed: message delivered to all matching subscribers.";
}

function subscriberStatusColor(status: SubscriberStatus): string {
  if (status === "delivered") return "var(--color-green-700)";
  if (status === "delivering") return "var(--color-amber-700)";
  if (status === "skipped") return "var(--color-gray-500)";
  if (status === "matched") return "var(--color-cyan-700)";
  return "var(--color-gray-500)";
}

export function PublishSubscribeDemo({
  workflowCode,
  workflowLinesHtml,
  stepCode,
  stepLinesHtml,
  workflowLineMap,
  stepLineMap,
}: DemoProps) {
  const [selectedTopic, setSelectedTopic] = useState<Topic>("orders");
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<PubSubSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<LogEntry[]>(IDLE_LOG);

  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const accumulatorRef = useRef<PubSubAccumulator | null>(null);
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

        const applyEvent = (event: PubSubEvent) => {
          if (signal.aborted || !startedAtRef.current || !accumulatorRef.current) return;
          const elapsedMs = Math.max(0, Date.now() - startedAtRef.current);
          const nextAccumulator = applyPubSubEvent(accumulatorRef.current, event);
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
            const event = parsePubSubEvent(chunk);
            if (event) applyEvent(event);
          }
        }

        if (!signal.aborted && buffer.trim()) {
          const event = parsePubSubEvent(buffer.replaceAll("\r\n", "\n"));
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

    try {
      const controller = ensureAbortController();
      const messagePayload = SAMPLE_PAYLOADS[selectedTopic];
      const payload = await postJson<StartResponse>(
        "/api/publish-subscribe",
        { topic: selectedTopic, payload: messagePayload },
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
        { text: `[0.00s] publishing to topic "${selectedTopic}"`, tone: "default" },
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

  const effectiveStatus: RunStatus | "idle" = snapshot?.status ?? (runId ? "publishing" : "idle");
  const isRunning = runId !== null && snapshot?.status !== "done";

  const highlights = useMemo(
    () => buildHighlightState(snapshot, workflowLineMap, stepLineMap),
    [snapshot, workflowLineMap, stepLineMap]
  );
  const highlightTone = useMemo(
    () => highlightToneForSnapshot(snapshot),
    [snapshot]
  );

  const subscriberEntries = useMemo(() => {
    if (!snapshot) return [];
    return Object.entries(snapshot.subscribers).map(([id, sub]) => ({
      id,
      ...sub,
    }));
  }, [snapshot]);

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
              Publish Topic
            </p>
            <div className="flex flex-wrap gap-2">
              {TOPIC_OPTIONS.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  disabled={isRunning}
                  onClick={() => setSelectedTopic(topic.id)}
                  className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    selectedTopic === topic.id
                      ? "border-blue-700/60 bg-blue-700/10 text-gray-1000"
                      : "border-gray-400/70 bg-background-100 text-gray-900 hover:border-gray-300 hover:text-gray-1000"
                  }`}
                >
                  {topic.label}
                </button>
              ))}
            </div>

            <p className="mt-2 text-xs text-gray-900 font-mono">
              {SAMPLE_PAYLOADS[selectedTopic]}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                ref={startButtonRef}
                onClick={() => { void handleStart(); }}
                disabled={isRunning}
                className="cursor-pointer rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Publish Message
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
            {statusExplanation(effectiveStatus)}
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
              <span className="text-gray-900">Topic</span>
              <span className="font-mono text-gray-1000">
                {snapshot?.topic ?? selectedTopic}
              </span>
            </div>
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">Delivered / Skipped</span>
              <span className="font-mono text-gray-1000">
                {snapshot?.delivered ?? 0} / {snapshot?.skipped ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <PubSubGraph
          subscribers={subscriberEntries}
          topic={snapshot?.topic ?? selectedTopic}
          status={effectiveStatus}
        />
        <SubscriberList subscribers={subscriberEntries} status={effectiveStatus} />
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
        Publish-Subscribe: topic-based filtering ensures only matching subscribers receive each message.
      </p>

      <PubSubCodeWorkbench
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

function PubSubGraph({
  subscribers,
  topic,
  status,
}: {
  subscribers: Array<{ id: string; name: string; topics: Topic[]; status: SubscriberStatus }>;
  topic: Topic;
  status: RunStatus | "idle";
}) {
  // Position subscribers in a circle around the center
  const positions = [
    { x: 55, y: 50 },
    { x: 265, y: 50 },
    { x: 55, y: 210 },
    { x: 265, y: 210 },
    { x: 160, y: 230 },
  ];

  const shortNames = ["OS", "WH", "EM", "AP", "BL"];
  const displaySubs = subscribers.length > 0
    ? subscribers
    : [
        { id: "sub-1", name: "Order Service", topics: ["orders" as Topic, "inventory" as Topic], status: "idle" as SubscriberStatus },
        { id: "sub-2", name: "Warehouse API", topics: ["inventory" as Topic, "shipping" as Topic], status: "idle" as SubscriberStatus },
        { id: "sub-3", name: "Email Notifier", topics: ["orders" as Topic, "shipping" as Topic], status: "idle" as SubscriberStatus },
        { id: "sub-4", name: "Analytics Pipeline", topics: ["orders" as Topic, "inventory" as Topic, "shipping" as Topic, "analytics" as Topic], status: "idle" as SubscriberStatus },
        { id: "sub-5", name: "Billing Service", topics: ["orders" as Topic], status: "idle" as SubscriberStatus },
      ];

  const centerColor =
    status === "done"
      ? "var(--color-green-700)"
      : status === "filtering"
        ? "var(--color-cyan-700)"
        : status === "delivering" || status === "publishing"
          ? "var(--color-amber-700)"
          : "var(--color-blue-700)";

  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Pub/Sub Topic Graph
      </p>

      <svg
        viewBox="0 0 320 256"
        role="img"
        aria-label="Publish-subscribe graph showing topic routing to subscribers"
        className="h-auto w-full"
      >
        <rect x={0} y={0} width={320} height={256} fill="var(--color-background-100)" rx={8} />

        {displaySubs.map((sub, index) => {
          const pos = positions[index] ?? { x: 160, y: 128 };
          const color = subscriberStatusColor(sub.status);
          const isActive = sub.status === "delivering";
          const matchesTopic = sub.topics.includes(topic);

          return (
            <g key={sub.id}>
              <line
                x1={160}
                y1={128}
                x2={pos.x}
                y2={pos.y}
                stroke={matchesTopic ? color : "var(--color-gray-500)"}
                strokeWidth={matchesTopic ? 2.5 : 1}
                strokeDasharray={isActive ? "6 4" : sub.status === "skipped" ? "3 5" : undefined}
                strokeOpacity={matchesTopic ? 1 : 0.3}
                className={isActive ? "animate-pulse" : undefined}
              />
              <circle
                cx={pos.x}
                cy={pos.y}
                r={18}
                fill="var(--color-background-200)"
                stroke={matchesTopic ? color : "var(--color-gray-500)"}
                strokeWidth={matchesTopic ? 2.5 : 1}
                strokeOpacity={matchesTopic ? 1 : 0.3}
              />
              <text
                x={pos.x}
                y={pos.y + 4}
                textAnchor="middle"
                className={`font-mono text-xs ${matchesTopic ? "fill-gray-1000" : "fill-gray-500"}`}
              >
                {shortNames[index]}
              </text>
              <text
                x={pos.x}
                y={pos.y + 30}
                textAnchor="middle"
                className={`font-mono text-[10px] ${matchesTopic ? "fill-gray-900" : "fill-gray-500"}`}
              >
                {sub.name.split(" ")[0]}
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
          y={124}
          textAnchor="middle"
          className={`font-mono text-[10px] font-semibold transition-colors duration-500 ${
            status === "done"
              ? "fill-green-700"
              : status === "filtering"
                ? "fill-cyan-700"
                : status === "delivering" || status === "publishing"
                  ? "fill-amber-700"
                  : "fill-blue-700"
          }`}
        >
          PUB
        </text>
        <text
          x={160}
          y={136}
          textAnchor="middle"
          className="font-mono text-[9px] fill-gray-900"
        >
          {topic}
        </text>
      </svg>
    </div>
  );
}

function SubscriberList({
  subscribers,
  status,
}: {
  subscribers: Array<{ id: string; name: string; topics: Topic[]; status: SubscriberStatus }>;
  status: RunStatus | "idle";
}) {
  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Subscriber Status
      </p>
      <ul className="space-y-2">
        {subscribers.length === 0 ? (
          <li className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2 text-sm text-gray-900">
            {status === "idle" ? "Subscribers will appear after publishing" : "Loading subscribers..."}
          </li>
        ) : (
          subscribers.map((sub) => (
            <li
              key={sub.id}
              className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-sm text-gray-1000">{sub.name}</span>
                  <span className="ml-2 text-xs text-gray-900">
                    [{sub.topics.join(", ")}]
                  </span>
                </div>
                <SubscriberStatusBadge status={sub.status} />
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
  if (status === "filtering") {
    return (
      <span className="rounded-full bg-cyan-700/20 px-2 py-0.5 text-xs font-medium text-cyan-700">
        filtering
      </span>
    );
  }
  if (status === "delivering") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        delivering
      </span>
    );
  }
  if (status === "publishing") {
    return (
      <span className="rounded-full bg-blue-700/20 px-2 py-0.5 text-xs font-medium text-blue-700">
        publishing
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-900">
      idle
    </span>
  );
}

function SubscriberStatusBadge({ status }: { status: SubscriberStatus }) {
  if (status === "delivered") {
    return (
      <span className="rounded-full bg-green-700/20 px-2 py-0.5 text-xs font-medium text-green-700">
        delivered
      </span>
    );
  }
  if (status === "delivering") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        delivering
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-500">
        skipped
      </span>
    );
  }
  if (status === "matched") {
    return (
      <span className="rounded-full bg-cyan-700/20 px-2 py-0.5 text-xs font-medium text-cyan-700">
        matched
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
} as unknown as Parameters<typeof PublishSubscribeDemo>[0];

export default function PublishSubscribeNativeDemo() {
  return <PublishSubscribeDemo {...demoProps} />;
}
