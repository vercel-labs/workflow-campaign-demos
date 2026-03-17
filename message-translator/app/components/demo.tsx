"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TranslatorCodeWorkbench } from "./translator-code-workbench";

type SourceFormat = "xml" | "csv" | "legacy-json";
type RunStatus = "translating" | "detecting" | "mapping" | "validating" | "delivering" | "done";
type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail" | "retry";

type TranslatorEvent =
  | { type: "message_received"; messageId: string; sourceFormat: SourceFormat }
  | { type: "detecting_format"; messageId: string }
  | { type: "format_detected"; messageId: string; sourceFormat: SourceFormat; confidence: number }
  | { type: "translating"; messageId: string; sourceFormat: SourceFormat; step: string }
  | { type: "field_mapped"; messageId: string; sourceField: string; canonicalField: string; value: string }
  | { type: "validating"; messageId: string }
  | { type: "validation_passed"; messageId: string; fieldCount: number }
  | { type: "delivering"; messageId: string; destination: string }
  | { type: "done"; messageId: string; sourceFormat: SourceFormat; fieldsTranslated: number };

type TranslatorAccumulator = {
  runId: string;
  messageId: string;
  sourceFormat: SourceFormat;
  status: RunStatus;
  detectedFormat: SourceFormat | null;
  confidence: number | null;
  fieldMappings: Array<{ sourceField: string; canonicalField: string; value: string }>;
  fieldCount: number | null;
  destination: string | null;
  fieldsTranslated: number | null;
};

type TranslatorSnapshot = TranslatorAccumulator & {
  elapsedMs: number;
};

type StartResponse = {
  runId: string;
  messageId: string;
  sourceFormat: SourceFormat;
  status: "translating";
};

export type WorkflowLineMap = {
  detect: number[];
  translate: number[];
  validate: number[];
  deliver: number[];
  done: number[];
};

export type StepLineMap = {
  detectSourceFormat: number[];
  translateFields: number[];
  validateOutput: number[];
  deliverMessage: number[];
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

const SAMPLE_MESSAGES: Array<{ id: string; format: SourceFormat; label: string; preview: string }> = [
  { id: "MSG-001", format: "xml", label: "XML Order (System A)", preview: "<order><id>ORD-5501</id><cust>ACME Corp</cust>..." },
  { id: "MSG-002", format: "csv", label: "CSV Order (System B)", preview: "order_id,customer_name,total_amount,..." },
  { id: "MSG-003", format: "legacy-json", label: "Legacy JSON (System C)", preview: '{"oid":"ORD-5503","c_name":"Initech LLC",...}' },
];

const FORMAT_COLORS: Record<SourceFormat, string> = {
  xml: "var(--color-violet-700)",
  csv: "var(--color-amber-700)",
  "legacy-json": "var(--color-cyan-700)",
};

const FORMAT_LABELS: Record<SourceFormat, string> = {
  xml: "XML",
  csv: "CSV",
  "legacy-json": "Legacy JSON",
};

function parseSseData(rawChunk: string): string {
  return rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
}

function parseTranslatorEvent(rawChunk: string): TranslatorEvent | null {
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

  if (type === "message_received" && typeof event.messageId === "string" && typeof event.sourceFormat === "string") {
    return { type, messageId: event.messageId, sourceFormat: event.sourceFormat as SourceFormat };
  }
  if (type === "detecting_format" && typeof event.messageId === "string") {
    return { type, messageId: event.messageId };
  }
  if (type === "format_detected" && typeof event.messageId === "string" && typeof event.sourceFormat === "string" && typeof event.confidence === "number") {
    return { type, messageId: event.messageId, sourceFormat: event.sourceFormat as SourceFormat, confidence: event.confidence };
  }
  if (type === "translating" && typeof event.messageId === "string" && typeof event.sourceFormat === "string" && typeof event.step === "string") {
    return { type, messageId: event.messageId, sourceFormat: event.sourceFormat as SourceFormat, step: event.step };
  }
  if (type === "field_mapped" && typeof event.messageId === "string" && typeof event.sourceField === "string" && typeof event.canonicalField === "string" && typeof event.value === "string") {
    return { type, messageId: event.messageId, sourceField: event.sourceField, canonicalField: event.canonicalField, value: event.value };
  }
  if (type === "validating" && typeof event.messageId === "string") {
    return { type, messageId: event.messageId };
  }
  if (type === "validation_passed" && typeof event.messageId === "string" && typeof event.fieldCount === "number") {
    return { type, messageId: event.messageId, fieldCount: event.fieldCount };
  }
  if (type === "delivering" && typeof event.messageId === "string" && typeof event.destination === "string") {
    return { type, messageId: event.messageId, destination: event.destination };
  }
  if (type === "done" && typeof event.messageId === "string" && typeof event.sourceFormat === "string" && typeof event.fieldsTranslated === "number") {
    return { type, messageId: event.messageId, sourceFormat: event.sourceFormat as SourceFormat, fieldsTranslated: event.fieldsTranslated };
  }

  return null;
}

function createAccumulator(start: StartResponse): TranslatorAccumulator {
  return {
    runId: start.runId,
    messageId: start.messageId,
    sourceFormat: start.sourceFormat,
    status: "translating",
    detectedFormat: null,
    confidence: null,
    fieldMappings: [],
    fieldCount: null,
    destination: null,
    fieldsTranslated: null,
  };
}

function applyTranslatorEvent(current: TranslatorAccumulator, event: TranslatorEvent): TranslatorAccumulator {
  switch (event.type) {
    case "message_received":
      return current;
    case "detecting_format":
      return { ...current, status: "detecting" };
    case "format_detected":
      return { ...current, detectedFormat: event.sourceFormat, confidence: event.confidence };
    case "translating":
      return { ...current, status: "mapping" };
    case "field_mapped":
      return {
        ...current,
        fieldMappings: [...current.fieldMappings, {
          sourceField: event.sourceField,
          canonicalField: event.canonicalField,
          value: event.value,
        }],
      };
    case "validating":
      return { ...current, status: "validating" };
    case "validation_passed":
      return { ...current, fieldCount: event.fieldCount };
    case "delivering":
      return { ...current, status: "delivering", destination: event.destination };
    case "done":
      return { ...current, status: "done", fieldsTranslated: event.fieldsTranslated };
  }
}

function toSnapshot(accumulator: TranslatorAccumulator, startedAtMs: number): TranslatorSnapshot {
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
  snapshot: TranslatorSnapshot | null,
  workflowLineMap: WorkflowLineMap,
  stepLineMap: StepLineMap
): HighlightState {
  if (!snapshot) return EMPTY_HIGHLIGHT_STATE;

  const workflowGutterMarks: Record<number, GutterMarkKind> = {};
  const stepGutterMarks: Record<number, GutterMarkKind> = {};

  if (snapshot.status === "detecting") {
    return {
      workflowActiveLines: workflowLineMap.detect,
      stepActiveLines: stepLineMap.detectSourceFormat,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (snapshot.status === "mapping") {
    for (const line of stepLineMap.detectSourceFormat.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }
    return {
      workflowActiveLines: workflowLineMap.translate,
      stepActiveLines: stepLineMap.translateFields,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (snapshot.status === "validating") {
    for (const line of stepLineMap.detectSourceFormat.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }
    for (const line of stepLineMap.translateFields.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }
    return {
      workflowActiveLines: workflowLineMap.validate,
      stepActiveLines: stepLineMap.validateOutput,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (snapshot.status === "delivering") {
    for (const line of stepLineMap.detectSourceFormat.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }
    for (const line of stepLineMap.translateFields.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }
    for (const line of stepLineMap.validateOutput.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }
    return {
      workflowActiveLines: workflowLineMap.deliver,
      stepActiveLines: stepLineMap.deliverMessage,
      workflowGutterMarks,
      stepGutterMarks,
    };
  }

  if (snapshot.status === "done") {
    for (const line of workflowLineMap.done.slice(0, 1)) {
      workflowGutterMarks[line] = "success";
    }
    for (const line of stepLineMap.detectSourceFormat.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }
    for (const line of stepLineMap.translateFields.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }
    for (const line of stepLineMap.validateOutput.slice(0, 1)) {
      stepGutterMarks[line] = "success";
    }
    for (const line of stepLineMap.deliverMessage.slice(0, 1)) {
      stepGutterMarks[line] = "success";
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

function highlightToneForSnapshot(snapshot: TranslatorSnapshot | null): HighlightTone {
  if (!snapshot) return "amber";
  if (snapshot.status === "detecting") return "cyan";
  if (snapshot.status === "mapping") return "amber";
  if (snapshot.status === "validating") return "cyan";
  if (snapshot.status === "delivering") return "amber";
  return "green";
}

type LogTone = "default" | "green" | "amber" | "red" | "cyan";
type LogEntry = { text: string; tone: LogTone };

function formatElapsedMs(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}

function eventToLogEntry(event: TranslatorEvent, elapsedMs: number): LogEntry {
  const ts = formatElapsedMs(elapsedMs);

  switch (event.type) {
    case "message_received":
      return { text: `[${ts}] message ${event.messageId} received (${event.sourceFormat})`, tone: "default" };
    case "detecting_format":
      return { text: `[${ts}] detecting source format...`, tone: "cyan" };
    case "format_detected":
      return { text: `[${ts}] format detected: ${event.sourceFormat} (${(event.confidence * 100).toFixed(0)}% confidence)`, tone: "cyan" };
    case "translating":
      return { text: `[${ts}] translating ${event.sourceFormat}: ${event.step}`, tone: "amber" };
    case "field_mapped":
      return { text: `[${ts}] ${event.sourceField} -> ${event.canonicalField} = "${event.value}"`, tone: "default" };
    case "validating":
      return { text: `[${ts}] validating canonical output...`, tone: "cyan" };
    case "validation_passed":
      return { text: `[${ts}] validation passed (${event.fieldCount} fields)`, tone: "green" };
    case "delivering":
      return { text: `[${ts}] delivering to ${event.destination}`, tone: "amber" };
    case "done":
      return { text: `[${ts}] done — ${event.fieldsTranslated} fields translated from ${event.sourceFormat}`, tone: "green" };
  }
}

const IDLE_LOG: LogEntry[] = [
  { text: "Idle: select a source message to start the translator.", tone: "default" },
  { text: "The translator detects the format, maps fields to canonical schema, validates, and delivers.", tone: "default" },
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
  detectedFormat: SourceFormat | null
): string {
  if (status === "idle") return "Waiting to start. Select a sample message to run the workflow.";
  if (status === "detecting") return "Detecting: inspecting the raw message to identify its source format.";
  if (status === "mapping") return `Translating: mapping ${detectedFormat ?? "source"} fields to canonical schema.`;
  if (status === "validating") return "Validating: checking the canonical output against the target schema.";
  if (status === "delivering") return "Delivering: sending canonical message to the target system.";
  return "Completed: message translated and delivered successfully.";
}

export function MessageTranslatorDemo({
  workflowCode,
  workflowLinesHtml,
  stepCode,
  stepLinesHtml,
  workflowLineMap,
  stepLineMap,
}: DemoProps) {
  const [selectedMessage, setSelectedMessage] = useState(0);
  const [runId, setRunId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<TranslatorSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eventLog, setEventLog] = useState<LogEntry[]>(IDLE_LOG);

  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const accumulatorRef = useRef<TranslatorAccumulator | null>(null);
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

        const applyEvent = (event: TranslatorEvent) => {
          if (signal.aborted || !startedAtRef.current || !accumulatorRef.current) return;
          const elapsedMs = Math.max(0, Date.now() - startedAtRef.current);
          const nextAccumulator = applyTranslatorEvent(accumulatorRef.current, event);
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
            const event = parseTranslatorEvent(chunk);
            if (event) applyEvent(event);
          }
        }

        if (!signal.aborted && buffer.trim()) {
          const event = parseTranslatorEvent(buffer.replaceAll("\r\n", "\n"));
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

    const message = SAMPLE_MESSAGES[selectedMessage];

    try {
      const controller = ensureAbortController();
      const payload = await postJson<StartResponse>(
        "/api/message-translator",
        { messageId: message.id, sourceFormat: message.format },
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
        { text: `[0.00s] message ${message.id} submitted for translation`, tone: "default" },
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

  const effectiveStatus: RunStatus | "idle" = snapshot?.status ?? (runId ? "translating" : "idle");
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
              Source Messages
            </p>
            <div className="space-y-1.5">
              {SAMPLE_MESSAGES.map((msg, index) => (
                <button
                  key={msg.id}
                  type="button"
                  disabled={isRunning}
                  onClick={() => setSelectedMessage(index)}
                  className={`w-full cursor-pointer rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    selectedMessage === index
                      ? "border-blue-700/60 bg-blue-700/10 text-gray-1000"
                      : "border-gray-400/70 bg-background-100 text-gray-900 hover:border-gray-300 hover:text-gray-1000"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${FORMAT_COLORS[msg.format]} 20%, transparent)`,
                        color: FORMAT_COLORS[msg.format],
                      }}
                    >
                      {FORMAT_LABELS[msg.format]}
                    </span>
                    <span>{msg.label}</span>
                  </div>
                  <p className="mt-1 font-mono text-xs text-gray-900 truncate">{msg.preview}</p>
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
                Translate Message
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
            {statusExplanation(effectiveStatus, snapshot?.detectedFormat ?? null)}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-gray-400 bg-background-100 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-900">
              Translation Phase
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
              <span className="text-gray-900">Detected Format</span>
              <span className="font-mono text-gray-1000">
                {snapshot?.detectedFormat
                  ? `${FORMAT_LABELS[snapshot.detectedFormat]} (${((snapshot.confidence ?? 0) * 100).toFixed(0)}%)`
                  : "pending"}
              </span>
            </div>
          </div>

          <div className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-gray-900">Fields Mapped</span>
              <span className="font-mono text-gray-1000">
                {snapshot?.fieldMappings.length ?? 0}
                {snapshot?.fieldsTranslated ? ` / ${snapshot.fieldsTranslated}` : ""}
              </span>
            </div>
          </div>

          {snapshot?.destination && (
            <div className="rounded-md border border-green-700/40 bg-green-700/10 px-3 py-2">
              <p className="text-xs text-green-700">Delivered to {snapshot.destination}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TranslationGraph detectedFormat={snapshot?.detectedFormat ?? null} status={effectiveStatus} />
        <FieldMappingsList
          mappings={snapshot?.fieldMappings ?? []}
          detectedFormat={snapshot?.detectedFormat ?? null}
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
        Message Translator: convert between incompatible message formats using durable workflow steps.
      </p>

      <TranslatorCodeWorkbench
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

function TranslationGraph({
  detectedFormat,
  status,
}: {
  detectedFormat: SourceFormat | null;
  status: RunStatus | "idle";
}) {
  const sources: Array<{ id: SourceFormat; x: number; y: number; short: string; label: string }> = [
    { id: "xml", x: 50, y: 64, short: "XML", label: "System A" },
    { id: "csv", x: 50, y: 128, short: "CSV", label: "System B" },
    { id: "legacy-json", x: 50, y: 192, short: "JSON", label: "System C" },
  ];

  const centerColor =
    status === "done"
      ? "var(--color-green-700)"
      : status === "detecting"
        ? "var(--color-cyan-700)"
        : status === "mapping" || status === "delivering"
          ? "var(--color-amber-700)"
          : "var(--color-blue-700)";

  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Translation Flow
      </p>

      <svg
        viewBox="0 0 320 256"
        role="img"
        aria-label="Message translation flow from source formats through translator to canonical output"
        className="h-auto w-full"
      >
        <rect x={0} y={0} width={320} height={256} fill="var(--color-background-100)" rx={8} />

        {sources.map((node) => {
          const isActive = detectedFormat === node.id;
          const color = isActive ? FORMAT_COLORS[node.id] : "var(--color-gray-500)";

          return (
            <g key={node.id}>
              <line
                x1={68}
                y1={node.y}
                x2={134}
                y2={128}
                stroke={color}
                strokeWidth={isActive ? 2.5 : 1.5}
                strokeDasharray={isActive && (status === "detecting" || status === "mapping") ? "6 4" : undefined}
                className={isActive && (status === "detecting" || status === "mapping") ? "animate-pulse" : undefined}
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
                className={`font-mono text-[10px] ${isActive ? "fill-gray-1000" : "fill-gray-500"}`}
              >
                {node.short}
              </text>
              <text
                x={node.x}
                y={node.y + 30}
                textAnchor="middle"
                className={`font-mono text-[9px] ${isActive ? "fill-gray-900" : "fill-gray-500"}`}
              >
                {node.label}
              </text>
            </g>
          );
        })}

        {/* Translator node (center) */}
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
              : status === "detecting"
                ? "fill-cyan-700"
                : status === "mapping" || status === "delivering"
                  ? "fill-amber-700"
                  : "fill-blue-700"
          }`}
        >
          TXL
        </text>

        {/* Output arrow to canonical */}
        <line
          x1={186}
          y1={128}
          x2={242}
          y2={128}
          stroke={status === "delivering" || status === "done" ? "var(--color-green-700)" : "var(--color-gray-500)"}
          strokeWidth={status === "delivering" || status === "done" ? 2.5 : 1.5}
          strokeDasharray={status === "delivering" ? "6 4" : undefined}
          className={status === "delivering" ? "animate-pulse" : undefined}
        />

        {/* Canonical output node */}
        <circle
          cx={260}
          cy={128}
          r={18}
          fill="var(--color-background-200)"
          stroke={status === "delivering" || status === "done" ? "var(--color-green-700)" : "var(--color-gray-500)"}
          strokeWidth={status === "delivering" || status === "done" ? 2.5 : 1.5}
        />
        <text
          x={260}
          y={132}
          textAnchor="middle"
          className={`font-mono text-[10px] ${status === "delivering" || status === "done" ? "fill-gray-1000" : "fill-gray-500"}`}
        >
          API
        </text>
        <text
          x={260}
          y={155}
          textAnchor="middle"
          className={`font-mono text-[9px] ${status === "delivering" || status === "done" ? "fill-gray-900" : "fill-gray-500"}`}
        >
          Canonical
        </text>
      </svg>
    </div>
  );
}

function FieldMappingsList({
  mappings,
  detectedFormat,
  status,
}: {
  mappings: Array<{ sourceField: string; canonicalField: string; value: string }>;
  detectedFormat: SourceFormat | null;
  status: RunStatus | "idle";
}) {
  return (
    <div className="rounded-md border border-gray-400 bg-background-100 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-900">
        Field Mappings
        {detectedFormat && (
          <span
            className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: `color-mix(in srgb, ${FORMAT_COLORS[detectedFormat]} 20%, transparent)`,
              color: FORMAT_COLORS[detectedFormat],
            }}
          >
            {FORMAT_LABELS[detectedFormat]}
          </span>
        )}
      </p>
      <ul className="space-y-2">
        {mappings.length === 0 ? (
          <li className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2 text-sm text-gray-900">
            {status === "idle" ? "No translation active" : "Waiting for field mappings..."}
          </li>
        ) : (
          mappings.map((mapping, index) => (
            <li
              key={`${mapping.sourceField}-${index}`}
              className="rounded-md border border-gray-400/70 bg-background-200 px-3 py-2"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="font-mono text-xs text-gray-900">{mapping.sourceField}</span>
                <span className="text-gray-500">-&gt;</span>
                <span className="font-mono text-xs text-gray-1000">{mapping.canonicalField}</span>
                <span className="ml-auto font-mono text-xs text-green-700">"{mapping.value}"</span>
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
  if (status === "detecting") {
    return (
      <span className="rounded-full bg-cyan-700/20 px-2 py-0.5 text-xs font-medium text-cyan-700">
        detecting
      </span>
    );
  }
  if (status === "mapping") {
    return (
      <span className="rounded-full bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700">
        translating
      </span>
    );
  }
  if (status === "validating") {
    return (
      <span className="rounded-full bg-cyan-700/20 px-2 py-0.5 text-xs font-medium text-cyan-700">
        validating
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
  return (
    <span className="rounded-full bg-gray-500/10 px-2 py-0.5 text-xs font-medium text-gray-900">
      idle
    </span>
  );
}
