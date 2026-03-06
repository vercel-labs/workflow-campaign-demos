"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ContentEnricherCodeWorkbench } from "@/components/content-enricher-code-workbench";

type EnrichmentSource = "crm" | "social" | "clearbit" | "github";
const ENRICHMENT_SOURCES: EnrichmentSource[] = ["crm", "social", "clearbit", "github"];

type EnrichmentEvent =
  | { type: "base_lookup" }
  | { type: "base_done"; name: string; domain: string }
  | { type: "source_start"; source: EnrichmentSource }
  | { type: "source_done"; source: EnrichmentSource; data: unknown }
  | { type: "source_failed"; source: EnrichmentSource; error: string }
  | { type: "merging" }
  | { type: "done"; profile: EnrichedLeadProfile };

type EnrichedLeadProfile = {
  email: string;
  name: string;
  domain: string;
  company: string | null;
  title: string | null;
  followers: number | null;
  location: string | null;
  githubUsername: string | null;
  githubStars: number | null;
  clearbitScore: number | null;
  segment: string | null;
};

type SourceStatus = "pending" | "running" | "success" | "failed";

type SourceState = {
  status: SourceStatus;
  data: unknown;
  error: string | null;
};

type RunPhase = "idle" | "base_lookup" | "fan_out" | "merging" | "done";

type Accumulator = {
  runId: string;
  phase: RunPhase;
  baseName: string | null;
  baseDomain: string | null;
  sources: Record<EnrichmentSource, SourceState>;
  mergedProfile: EnrichedLeadProfile | null;
};

type WorkflowLineMap = {
  baseLookup: number[];
  fanOut: number[];
  merge: number[];
};

type StepLineMap = {
  fetchSteps: Record<EnrichmentSource, number[]>;
  merge: number[];
};

type Props = {
  workflowCode: string;
  workflowHtmlLines: string[];
  workflowLineMap: WorkflowLineMap;
  stepCode: string;
  stepHtmlLines: string[];
  stepLineMap: StepLineMap;
};

const DEFAULT_EMAIL = "alex.rivera@acme.io";

const SOURCE_META: Record<EnrichmentSource, { label: string; subtitle: string }> = {
  crm: { label: "CRM", subtitle: "account ownership and segment" },
  social: { label: "Social", subtitle: "audience and profile signals" },
  clearbit: { label: "Clearbit", subtitle: "firmographic enrichment" },
  github: { label: "GitHub", subtitle: "engineering activity" },
};

function createInitialSources(): Record<EnrichmentSource, SourceState> {
  return {
    crm: { status: "pending", data: null, error: null },
    social: { status: "pending", data: null, error: null },
    clearbit: { status: "pending", data: null, error: null },
    github: { status: "pending", data: null, error: null },
  };
}

function createAccumulator(runId: string): Accumulator {
  return {
    runId,
    phase: "idle",
    baseName: null,
    baseDomain: null,
    sources: createInitialSources(),
    mergedProfile: null,
  };
}

function isEnrichmentSource(value: string): value is EnrichmentSource {
  return value === "crm" || value === "social" || value === "clearbit" || value === "github";
}

function applyEvent(current: Accumulator, event: EnrichmentEvent): Accumulator {
  if (event.type === "base_lookup") {
    return { ...current, phase: "base_lookup" };
  }

  if (event.type === "base_done") {
    return { ...current, phase: "fan_out", baseName: event.name, baseDomain: event.domain };
  }

  if (event.type === "source_start" && isEnrichmentSource(event.source)) {
    return {
      ...current,
      phase: "fan_out",
      sources: {
        ...current.sources,
        [event.source]: { status: "running", data: null, error: null },
      },
    };
  }

  if (event.type === "source_done" && isEnrichmentSource(event.source)) {
    return {
      ...current,
      sources: {
        ...current.sources,
        [event.source]: { status: "success", data: event.data, error: null },
      },
    };
  }

  if (event.type === "source_failed" && isEnrichmentSource(event.source)) {
    return {
      ...current,
      sources: {
        ...current.sources,
        [event.source]: { status: "failed", data: null, error: event.error },
      },
    };
  }

  if (event.type === "merging") {
    return { ...current, phase: "merging" };
  }

  if (event.type === "done") {
    return { ...current, phase: "done", mergedProfile: event.profile };
  }

  return current;
}

function parseSseData(rawChunk: string): string {
  return rawChunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");
}

function parseEnrichmentEvent(rawChunk: string): EnrichmentEvent | null {
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

  if (type === "base_lookup") return { type };
  if (type === "base_done" && typeof event.name === "string" && typeof event.domain === "string") {
    return { type, name: event.name, domain: event.domain };
  }
  if (type === "source_start" && typeof event.source === "string") {
    return { type, source: event.source as EnrichmentSource };
  }
  if (type === "source_done" && typeof event.source === "string") {
    return { type, source: event.source as EnrichmentSource, data: event.data };
  }
  if (type === "source_failed" && typeof event.source === "string" && typeof event.error === "string") {
    return { type, source: event.source as EnrichmentSource, error: event.error };
  }
  if (type === "merging") return { type };
  if (type === "done" && event.profile && typeof event.profile === "object") {
    return { type, profile: event.profile as EnrichedLeadProfile };
  }

  return null;
}

export function ContentEnricherDemo({
  workflowCode,
  workflowHtmlLines,
  workflowLineMap,
  stepCode,
  stepHtmlLines,
  stepLineMap,
}: Props) {
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [failSource, setFailSource] = useState<"none" | EnrichmentSource>("none");
  const [runId, setRunId] = useState<string | null>(null);
  const [accumulator, setAccumulator] = useState<Accumulator | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const accumulatorRef = useRef<Accumulator | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  const connectToReadable = useCallback(async (targetRunId: string, signal: AbortSignal) => {
    try {
      const response = await fetch(`/api/readable/${encodeURIComponent(targetRunId)}`, {
        cache: "no-store",
        signal,
      });

      if (signal.aborted) return;

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? `Readable stream request failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const handleEvent = (event: EnrichmentEvent) => {
        if (signal.aborted || !accumulatorRef.current) return;

        const next = applyEvent(accumulatorRef.current, event);
        accumulatorRef.current = next;
        setAccumulator({ ...next });
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
          const event = parseEnrichmentEvent(chunk);
          if (event) handleEvent(event);
        }
      }

      if (!signal.aborted && buffer.trim()) {
        const event = parseEnrichmentEvent(buffer.replaceAll("\r\n", "\n"));
        if (event) handleEvent(event);
      }
    } catch (cause: unknown) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      if (signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "Readable stream failed");
    }
  }, []);

  const handleStart = useCallback(async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;

    // Inject fail flag via plus-addressing
    let enrichEmail = normalizedEmail;
    if (failSource !== "none") {
      const [localPart = "lead", domain = "example.com"] = normalizedEmail.split("@");
      const basePart = localPart.split("+")[0];
      enrichEmail = `${basePart}+fail-${failSource}@${domain}`;
    }

    setIsStarting(true);
    setError(null);
    abortRef.current?.abort();
    abortRef.current = null;

    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;

    try {
      const response = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: enrichEmail }),
        signal,
      });

      const payload = (await response.json().catch(() => ({}))) as
        | { runId: string; error?: string }
        | { error?: string };

      if (signal.aborted) return;

      if (!response.ok) {
        throw new Error((payload as { error?: string }).error ?? `Start request failed (${response.status})`);
      }

      const startPayload = payload as { runId: string };
      const acc = createAccumulator(startPayload.runId);
      accumulatorRef.current = acc;
      setRunId(startPayload.runId);
      setAccumulator(acc);

      void connectToReadable(startPayload.runId, signal);
    } catch (startError) {
      if (signal.aborted || (startError instanceof Error && startError.name === "AbortError")) return;
      setError(startError instanceof Error ? startError.message : "Failed to start enrichment run");
    } finally {
      setIsStarting(false);
    }
  }, [connectToReadable, email, failSource]);

  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    accumulatorRef.current = null;

    setRunId(null);
    setAccumulator(null);
    setError(null);
    setIsStarting(false);
    setFailSource("none");
  }, []);

  const phase = accumulator?.phase ?? "idle";
  const isRunInProgress = (phase !== "idle" && phase !== "done") || isStarting;

  const statusText = useMemo(() => {
    if (!accumulator || phase === "idle") {
      return "Idle: start a real enrichment run to fan out four APIs in parallel.";
    }
    if (phase === "base_lookup") {
      return "lookupBaseContact() is running...";
    }
    if (phase === "fan_out") {
      return "Promise.allSettled() fan-out in progress. Each source resolves independently.";
    }
    if (phase === "merging") {
      return "mergeEnrichmentProfile() is assembling the best profile with null fallbacks.";
    }
    return "All sources settled. mergeEnrichmentProfile() assembled the best profile with null fallbacks.";
  }, [accumulator, phase]);

  const codeState = useMemo(() => {
    const stepGutterMarks: Record<number, "success" | "fail"> = {};

    if (accumulator) {
      for (const source of ENRICHMENT_SOURCES) {
        const status = accumulator.sources[source].status;
        const line = stepLineMap.fetchSteps[source][0];
        if (!line) continue;
        if (status === "success") stepGutterMarks[line] = "success";
        if (status === "failed") stepGutterMarks[line] = "fail";
      }
    }

    if (!accumulator || phase === "idle") {
      return {
        tone: "amber" as const,
        workflowActiveLines: [] as number[],
        stepActiveLines: [] as number[],
        stepGutterMarks,
      };
    }

    if (phase === "done" || phase === "merging") {
      return {
        tone: "green" as const,
        workflowActiveLines: workflowLineMap.merge,
        stepActiveLines: stepLineMap.merge,
        stepGutterMarks,
      };
    }

    if (phase === "base_lookup") {
      return {
        tone: "amber" as const,
        workflowActiveLines: workflowLineMap.baseLookup,
        stepActiveLines: [] as number[],
        stepGutterMarks,
      };
    }

    return {
      tone: "amber" as const,
      workflowActiveLines: workflowLineMap.fanOut,
      stepActiveLines: ENRICHMENT_SOURCES.flatMap((source) => stepLineMap.fetchSteps[source]),
      stepGutterMarks,
    };
  }, [accumulator, phase, stepLineMap.fetchSteps, stepLineMap.merge, workflowLineMap.baseLookup, workflowLineMap.fanOut, workflowLineMap.merge]);

  const baseReady = phase !== "idle" && phase !== "base_lookup";
  const fallbackDomain = email.includes("@") ? email.split("@")[1] : "-";

  return (
    <div className="space-y-4">
      {error ? (
        <div role="alert" className="rounded-lg border border-red-700/40 bg-red-700/10 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-lg border border-gray-400/70 bg-background-100 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-w-[220px] flex-1 items-center gap-2">
            <span className="text-xs font-medium text-gray-900">Lead Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isRunInProgress}
              className="h-9 w-full rounded-md border border-gray-400 bg-background-200 px-2.5 text-xs text-gray-1000 placeholder:text-gray-900 focus:border-gray-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="alex.rivera@acme.io"
            />
          </label>

          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={isRunInProgress || email.trim().length === 0}
            className="min-h-9 rounded-md bg-white px-3 py-2 text-xs font-medium text-black transition-colors hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isStarting ? "Starting..." : "Start Enrichment"}
          </button>

          <label className="flex items-center gap-2">
            <span className="text-xs text-gray-900">Force fail</span>
            <select
              value={failSource}
              onChange={(event) => setFailSource(event.target.value as "none" | EnrichmentSource)}
              disabled={isRunInProgress}
              className="h-9 rounded-md border border-gray-400 bg-background-200 px-2.5 text-xs text-gray-1000 focus:border-gray-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="none">None</option>
              <option value="crm">CRM</option>
              <option value="social">Social</option>
              <option value="clearbit">Clearbit</option>
              <option value="github">GitHub</option>
            </select>
          </label>

          <button
            type="button"
            onClick={handleReset}
            disabled={!runId && !accumulator && !error}
            className="min-h-9 rounded-md border border-gray-400 px-3 py-2 text-xs font-medium text-gray-900 transition-colors hover:border-gray-300 hover:text-gray-1000 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset
          </button>

          {runId ? (
            <span className="ml-auto rounded-full bg-background-200 px-2.5 py-1 text-xs font-mono text-gray-900">
              run: {runId}
            </span>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-gray-400/70 bg-background-100 p-4 max-h-[250px] overflow-y-auto">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-1000">Base Lead</h3>
          <StatusBadge
            status={
              phase === "idle"
                ? "pending"
                : phase === "base_lookup"
                  ? "running"
                  : "success"
            }
            pendingLabel="waiting"
            runningLabel="looking up"
            successLabel="ready"
          />
        </div>

        <div className="grid gap-2 text-xs sm:grid-cols-3">
          <Field label="Email" value={email.trim().toLowerCase()} mono />
          <Field label="Name" value={accumulator?.baseName ?? "pending"} />
          <Field label="Domain" value={accumulator?.baseDomain ?? fallbackDomain} mono />
        </div>

        <p className="mt-3 text-xs text-gray-900" role="status" aria-live="polite">
          {statusText}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {ENRICHMENT_SOURCES.map((source) => {
          const sourceState = accumulator?.sources[source] ?? {
            status: "pending" as SourceStatus,
            data: null,
            error: null,
          };

          return (
            <div
              key={source}
              className="rounded-lg border border-gray-400/70 bg-background-100 p-4 max-h-[250px] overflow-y-auto"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-1000">{SOURCE_META[source].label}</h3>
                  <p className="text-xs text-gray-900">{SOURCE_META[source].subtitle}</p>
                </div>
                <StatusBadge
                  status={sourceState.status}
                  pendingLabel="pending"
                  runningLabel="running"
                  successLabel="resolved"
                />
              </div>

              <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-gray-500/40">
                <div
                  className={[
                    "h-full rounded-full transition-all duration-300",
                    sourceState.status === "failed"
                      ? "bg-red-700"
                      : sourceState.status === "success"
                        ? "bg-green-700"
                        : sourceState.status === "running"
                          ? "bg-amber-700"
                          : "bg-gray-500/40",
                  ].join(" ")}
                  style={{
                    width:
                      sourceState.status === "success" || sourceState.status === "failed"
                        ? "100%"
                        : sourceState.status === "running"
                          ? "60%"
                          : "0%",
                  }}
                />
              </div>

              {sourceState.status === "failed" ? (
                <p className="text-xs text-red-700">{sourceState.error ?? `${SOURCE_META[source].label} failed`}</p>
              ) : sourceState.data ? (
                <SourceDataRows source={source} data={sourceState.data} />
              ) : (
                <p className="text-xs text-gray-900">
                  {sourceState.status === "running"
                    ? "Fetching source data in parallel..."
                    : "Waiting for fan-out."}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-gray-400/70 bg-background-100 p-4 max-h-[250px] overflow-y-auto">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-1000">Enriched Profile</h3>
          <StatusBadge
            status={
              phase === "done"
                ? "success"
                : phase === "merging"
                  ? "running"
                  : "pending"
            }
            pendingLabel="pending"
            runningLabel="assembling"
            successLabel="merged"
          />
        </div>

        {accumulator?.mergedProfile ? (
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <Field label="Company" value={accumulator.mergedProfile.company ?? "null"} />
            <Field label="Title" value={accumulator.mergedProfile.title ?? "null"} />
            <Field
              label="Followers"
              value={accumulator.mergedProfile.followers === null ? "null" : String(accumulator.mergedProfile.followers)}
              mono
            />
            <Field label="Location" value={accumulator.mergedProfile.location ?? "null"} />
            <Field label="GitHub" value={accumulator.mergedProfile.githubUsername ?? "null"} mono />
            <Field
              label="GitHub Stars"
              value={accumulator.mergedProfile.githubStars === null ? "null" : String(accumulator.mergedProfile.githubStars)}
              mono
            />
            <Field
              label="Clearbit Score"
              value={accumulator.mergedProfile.clearbitScore === null ? "null" : String(accumulator.mergedProfile.clearbitScore)}
              mono
            />
            <Field label="Segment" value={accumulator.mergedProfile.segment ?? "null"} />
          </div>
        ) : (
          <p className="text-xs text-gray-900">
            mergeEnrichmentProfile() runs after all sources settle. Failed sources map to null fields.
          </p>
        )}
      </div>

      <ContentEnricherCodeWorkbench
        workflowCode={workflowCode}
        workflowHtmlLines={workflowHtmlLines}
        workflowActiveLines={codeState.workflowActiveLines}
        stepCode={stepCode}
        stepHtmlLines={stepHtmlLines}
        stepActiveLines={codeState.stepActiveLines}
        stepGutterMarks={codeState.stepGutterMarks}
        tone={codeState.tone}
      />
    </div>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-gray-400/60 bg-background-200 px-2.5 py-2">
      <p className="text-xs uppercase tracking-wide text-gray-900">{label}</p>
      <p className={["text-xs text-gray-1000", mono ? "font-mono" : ""].join(" ")}>{value}</p>
    </div>
  );
}

function StatusBadge({
  status,
  pendingLabel,
  runningLabel,
  successLabel,
}: {
  status: "pending" | "running" | "success" | "failed";
  pendingLabel: string;
  runningLabel: string;
  successLabel: string;
}) {
  if (status === "success") {
    return (
      <span className="rounded-full border border-green-700/40 bg-green-700/20 px-2 py-0.5 text-xs font-medium text-green-700">
        {successLabel}
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span className="rounded-full border border-red-700/40 bg-red-700/10 px-2 py-0.5 text-xs font-medium text-red-700">
        failed
      </span>
    );
  }

  if (status === "running") {
    return (
      <span className="rounded-full border border-amber-700/40 bg-amber-700/20 px-2 py-0.5 text-xs font-medium text-amber-700 animate-pulse">
        {runningLabel}
      </span>
    );
  }

  return (
    <span className="rounded-full border border-gray-400/70 bg-background-200 px-2 py-0.5 text-xs font-medium text-gray-900">
      {pendingLabel}
    </span>
  );
}

function SourceDataRows({
  source,
  data,
}: {
  source: EnrichmentSource;
  data: unknown;
}) {
  if (source === "crm") {
    const crm = data as { company: string; title: string; segment: string };
    return (
      <div className="grid gap-2 text-xs sm:grid-cols-2">
        <Field label="Company" value={crm.company} />
        <Field label="Title" value={crm.title} />
        <Field label="Segment" value={crm.segment} />
      </div>
    );
  }

  if (source === "social") {
    const social = data as { followers: number; location: string; profileUrl: string };
    return (
      <div className="grid gap-2 text-xs sm:grid-cols-2">
        <Field label="Followers" value={String(social.followers)} mono />
        <Field label="Location" value={social.location} />
        <Field label="Profile" value={social.profileUrl} mono />
      </div>
    );
  }

  if (source === "clearbit") {
    const clearbit = data as { company: string; employees: number; score: number };
    return (
      <div className="grid gap-2 text-xs sm:grid-cols-2">
        <Field label="Company" value={clearbit.company} />
        <Field label="Employees" value={String(clearbit.employees)} mono />
        <Field label="Score" value={String(clearbit.score)} mono />
      </div>
    );
  }

  const github = data as { username: string; publicRepos: number; stars: number };
  return (
    <div className="grid gap-2 text-xs sm:grid-cols-2">
      <Field label="Username" value={github.username} mono />
      <Field label="Repos" value={String(github.publicRepos)} mono />
      <Field label="Stars" value={String(github.stars)} mono />
    </div>
  );
}
