// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClaimCodeWorkbench } from "@/claim-check/components/claim-code-workbench";

type HighlightTone = "amber" | "cyan" | "green" | "red";
type GutterMarkKind = "success" | "fail";

type ClaimStatus = "idle" | "starting" | "waiting" | "processing" | "completed";

type ClaimCheckEvent =
  | { type: "start"; importId: string; hookToken: string }
  | { type: "waiting"; importId: string; hookToken: string }
  | { type: "upload_received"; importId: string; blobToken: string }
  | { type: "processing"; importId: string; blobToken: string }
  | { type: "completed"; importId: string; blobToken: string };

type LogEntry = {
  kind: string;
  message: string;
  atMs: number;
};

type ClaimWorkflowLineMap = {
  awaitToken: number[];
  process: number[];
  returnDone: number[];
};

type ClaimStepLineMap = {
  fetchBlob: number[];
};

type Props = {
  workflowCode: string;
  workflowHtmlLines: string[];
  workflowLineMap: ClaimWorkflowLineMap;

  stepCode: string;
  stepHtmlLines: string[];
  stepLineMap: ClaimStepLineMap;
};

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

export function ClaimCheckDemo({
  workflowCode,
  workflowHtmlLines,
  workflowLineMap,
  stepCode,
  stepHtmlLines,
  stepLineMap,
}: Props) {
  const [status, setStatus] = useState<ClaimStatus>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [hookToken, setHookToken] = useState<string | null>(null);
  const [blobToken, setBlobToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const startedAtRef = useRef(0);

  const cleanup = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const elapsed = useCallback(() => {
    return startedAtRef.current ? Date.now() - startedAtRef.current : 0;
  }, []);

  const addLog = useCallback(
    (kind: string, message: string) => {
      setLog((prev) => [...prev, { kind, message, atMs: elapsed() }]);
    },
    [elapsed]
  );

  const handleEvent = useCallback(
    (event: ClaimCheckEvent) => {
      switch (event.type) {
        case "start":
          setHookToken(event.hookToken);
          addLog("start", "Import started. Waiting for blob token.");
          break;
        case "waiting":
          setStatus("waiting");
          addLog("waiting", `Hook created: ${event.hookToken}`);
          break;
        case "upload_received":
          setBlobToken(event.blobToken);
          addLog("upload_received", `Blob token received: ${event.blobToken}`);
          break;
        case "processing":
          setStatus("processing");
          addLog("processing", "Processing blob by token…");
          break;
        case "completed":
          setStatus("completed");
          addLog("completed", "Import complete. Index updated.");
          break;
      }
    },
    [addLog]
  );

  const connectSse = useCallback(
    async (targetRunId: string, signal: AbortSignal) => {
      const res = await fetch(`/api/readable/${targetRunId}`, { signal });
      if (!res.ok || !res.body) throw new Error("Stream unavailable");

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
          const event = parseSseChunk(chunk);
          if (event) handleEvent(event as ClaimCheckEvent);
        }
      }

      if (buffer.trim()) {
        const event = parseSseChunk(buffer);
        if (event) handleEvent(event as ClaimCheckEvent);
      }
    },
    [handleEvent]
  );

  const handleStart = useCallback(async () => {
    setError(null);
    cleanup();

    const controller = new AbortController();
    abortRef.current = controller;
    startedAtRef.current = Date.now();

    setStatus("starting");
    setRunId(null);
    setImportId(null);
    setHookToken(null);
    setBlobToken(null);
    setLog([]);

    try {
      const res = await fetch("/api/claim-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error?.message ?? "Failed to start");
        setStatus("idle");
        return;
      }

      setRunId(payload.runId);
      setImportId(payload.importId);

      // Start listening to SSE stream (non-blocking)
      connectSse(payload.runId, controller.signal).catch((err) => {
        if (err instanceof Error && err.name === "AbortError") return;
        // SSE ended (expected on completion)
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to start import");
      setStatus("idle");
    }
  }, [cleanup, connectSse]);

  const handleUpload = useCallback(async () => {
    if (!importId) return;
    setError(null);

    try {
      const res = await fetch("/api/claim-check/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importId }),
        signal: abortRef.current?.signal,
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload?.error?.message ?? "Failed to upload");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to upload blob");
    }
  }, [importId]);

  const handleReset = useCallback(() => {
    cleanup();
    setStatus("idle");
    setRunId(null);
    setImportId(null);
    setHookToken(null);
    setBlobToken(null);
    setError(null);
    setLog([]);
    startedAtRef.current = 0;
  }, [cleanup]);

  const canUpload = status === "waiting";

  const explainer = useMemo(() => {
    if (status === "idle") return "Start an import, then upload a large blob. The workflow only receives a small token.";
    if (status === "starting") return "Starting workflow…";
    if (status === "waiting") return `Waiting for hook token: ${hookToken ?? "…"}`;
    if (status === "processing") return "Processing blob by token (no large payload in workflow state).";
    if (status === "completed") return "Done. Only the token flowed through the workflow.";
    return "Run active.";
  }, [status, hookToken]);

  const codeState = useMemo(() => {
    const wfMarks: Record<number, GutterMarkKind> = {};
    const stepMarks: Record<number, GutterMarkKind> = {};

    if (status === "idle" || status === "starting") {
      return {
        tone: "amber" as HighlightTone,
        workflowActiveLines: [] as number[],
        workflowGutterMarks: wfMarks,
        stepActiveLines: [] as number[],
        stepGutterMarks: stepMarks,
      };
    }

    if (status === "waiting") {
      return {
        tone: "amber" as HighlightTone,
        workflowActiveLines: workflowLineMap.awaitToken,
        workflowGutterMarks: wfMarks,
        stepActiveLines: [],
        stepGutterMarks: stepMarks,
      };
    }

    if (status === "processing") {
      return {
        tone: "amber" as HighlightTone,
        workflowActiveLines: workflowLineMap.process,
        workflowGutterMarks: wfMarks,
        stepActiveLines: stepLineMap.fetchBlob,
        stepGutterMarks: stepMarks,
      };
    }

    // completed
    wfMarks[workflowLineMap.process[0] ?? 1] = "success";
    stepMarks[stepLineMap.fetchBlob[0] ?? 1] = "success";

    return {
      tone: "green" as HighlightTone,
      workflowActiveLines: workflowLineMap.returnDone,
      workflowGutterMarks: wfMarks,
      stepActiveLines: [],
      stepGutterMarks: stepMarks,
    };
  }, [status, stepLineMap.fetchBlob, workflowLineMap.awaitToken, workflowLineMap.process, workflowLineMap.returnDone]);

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded-lg border border-red-700/40 bg-red-700/10 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-gray-400/70 bg-background-100 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleStart}
            disabled={status !== "idle" && status !== "completed"}
            className="min-h-10 rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start Import
          </button>

          {runId && (
            <>
              <button
                type="button"
                onClick={handleUpload}
                disabled={!canUpload}
                className="min-h-10 rounded-md border border-gray-400 bg-background-200 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:border-gray-300 hover:text-gray-1000 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Upload large file
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="min-h-10 rounded-md border border-gray-400 px-4 py-2 text-sm font-medium text-gray-900 transition-colors hover:border-gray-300 hover:text-gray-1000"
              >
                Reset
              </button>
            </>
          )}

          {runId && (
            <span className="ml-auto rounded-full bg-background-200 px-2.5 py-1 text-xs font-mono text-gray-900">
              run: {runId}
            </span>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-400/70 bg-background-100 p-3">
        <p className="mb-2 text-sm text-gray-900" role="status" aria-live="polite">
          {explainer}
        </p>

        <div className="lg:h-[200px]">
          <div className="grid grid-cols-1 gap-2 lg:h-full lg:grid-cols-2">
            <StateCards hookToken={hookToken} blobToken={blobToken} status={status} />
            <ExecutionLog events={log} />
          </div>
        </div>
      </div>

      <p className="text-center text-xs italic text-gray-900">
        Claim-check token → keep workflows small, store blobs elsewhere
      </p>

      <ClaimCodeWorkbench
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

function StateCards({ hookToken, blobToken, status }: { hookToken: string | null; blobToken: string | null; status: ClaimStatus }) {
  return (
    <div className="h-full min-h-0 overflow-y-auto rounded-lg border border-gray-400/60 bg-background-200 p-2">
      <div className="space-y-2">
        <div className="rounded-md border border-gray-400/50 bg-background-100 p-2">
          <p className="text-sm font-semibold text-gray-1000">Workflow state</p>
          <p className="mt-1 text-xs text-gray-900">
            Hook token:{" "}
            <span className="font-mono text-gray-1000">{hookToken ?? "—"}</span>
          </p>
          <p className="mt-1 text-xs text-gray-900">
            Blob token (pointer only):{" "}
            <span className="font-mono text-gray-1000">{blobToken ?? "—"}</span>
          </p>
        </div>

        <div className="rounded-md border border-gray-400/50 bg-background-100 p-2">
          <p className="text-sm font-semibold text-gray-1000">Blob store</p>
          <p className="mt-1 text-xs text-gray-900">
            Size:{" "}
            <span className="font-mono text-gray-1000">
              {blobToken ? "52,428,800 bytes" : "—"}
            </span>
          </p>
          <p className="mt-1 text-xs text-gray-900">
            Status:{" "}
            <span className="font-mono text-gray-1000">{status === "idle" ? "—" : status}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function ExecutionLog({ events }: { events: LogEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  const lastAtMs = events.length > 0 ? events[events.length - 1].atMs : 0;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-gray-400/60 bg-background-200 p-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-900">Execution log</h3>
        <p className="text-xs font-mono tabular-nums text-gray-900">{(lastAtMs / 1000).toFixed(2)}s</p>
      </div>

      <div ref={scrollRef} className="max-h-[130px] min-h-0 flex-1 overflow-y-auto rounded border border-gray-300/70 bg-background-100 p-1">
        {events.length === 0 && <p className="px-1 py-0.5 text-sm text-gray-900">No events yet.</p>}
        {events.map((event, idx) => (
          <div key={`${event.kind}-${event.atMs}-${idx}`} className="flex items-center gap-2 px-1 py-0.5 text-sm leading-5 text-gray-900">
            <span className="h-2 w-2 rounded-full bg-cyan-700" aria-hidden="true" />
            <span className="w-28 shrink-0 text-xs font-semibold uppercase text-cyan-700">{event.kind}</span>
            <p className="min-w-0 flex-1 truncate">{event.message}</p>
            <span className="shrink-0 font-mono tabular-nums text-gray-900">+{event.atMs}ms</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const demoProps = {
  workflowCode: "",
  workflowHtmlLines: [],
  workflowLineMap: {},
  stepCode: "",
  stepHtmlLines: [],
  stepLineMap: {},
} as unknown as Parameters<typeof ClaimCheckDemo>[0];

export default function ClaimCheckNativeDemo() {
  return <ClaimCheckDemo {...demoProps} />;
}
