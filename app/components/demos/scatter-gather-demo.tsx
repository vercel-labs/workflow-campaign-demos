"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ProviderId = "fedex" | "ups" | "dhl" | "usps";

type ProviderEvent =
  | { type: "provider_querying"; provider: string }
  | { type: "provider_quoted"; provider: string; price: number; days: number }
  | { type: "provider_failed"; provider: string; error: string }
  | { type: "gathering" }
  | { type: "done"; winner: { provider: string; price: number; days: number } | null };

type ProviderState = {
  id: ProviderId;
  label: string;
  status: "pending" | "querying" | "quoted" | "failed";
  price: number | null;
  days: number | null;
  error: string;
};

const PROVIDERS: ProviderState[] = [
  { id: "fedex", label: "FedEx", status: "pending", price: null, days: null, error: "" },
  { id: "ups", label: "UPS", status: "pending", price: null, days: null, error: "" },
  { id: "dhl", label: "DHL", status: "pending", price: null, days: null, error: "" },
  { id: "usps", label: "USPS", status: "pending", price: null, days: null, error: "" },
];

function parseEvent(chunk: string): ProviderEvent | null {
  const payload = chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .join("\n");

  if (!payload) return null;
  try {
    return JSON.parse(payload) as ProviderEvent;
  } catch {
    return null;
  }
}

function badgeClass(status: ProviderState["status"]) {
  if (status === "quoted") return "bg-green-700/15 text-green-700";
  if (status === "failed") return "bg-red-700/15 text-red-700";
  if (status === "querying") return "bg-amber-700/15 text-amber-700";
  return "bg-gray-500/10 text-gray-700";
}

export function ScatterGatherDemo() {
  const [packageId, setPackageId] = useState("PKG-7742");
  const [selectedFailures, setSelectedFailures] = useState<ProviderId[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "scatter" | "gathering" | "done">("idle");
  const [winner, setWinner] = useState<{ provider: string; price: number; days: number } | null>(null);
  const [providers, setProviders] = useState<ProviderState[]>(PROVIDERS);
  const [events, setEvents] = useState<string[]>(["Start a run to fan out quote requests in parallel."]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const quotedCount = useMemo(
    () => providers.filter((provider) => provider.status === "quoted").length,
    [providers],
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  async function connectToStream(nextRunId: string, signal: AbortSignal) {
    const response = await fetch(`/api/readable/${nextRunId}`, { signal });
    if (!response.ok || !response.body) {
      throw new Error("Readable stream unavailable");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.replaceAll("\r\n", "\n").split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const event = parseEvent(chunk);
        if (!event) continue;

        if (event.type === "provider_querying") {
          setProviders((current) =>
            current.map((provider) =>
              provider.id === event.provider
                ? { ...provider, status: "querying" }
                : provider,
            ),
          );
        }

        if (event.type === "provider_quoted") {
          setProviders((current) =>
            current.map((provider) =>
              provider.id === event.provider
                ? {
                    ...provider,
                    status: "quoted",
                    price: event.price,
                    days: event.days,
                  }
                : provider,
            ),
          );
          setEvents((current) => [
            ...current,
            `${event.provider} quoted $${event.price.toFixed(2)} for ${event.days} days`,
          ]);
        }

        if (event.type === "provider_failed") {
          setProviders((current) =>
            current.map((provider) =>
              provider.id === event.provider
                ? { ...provider, status: "failed", error: event.error }
                : provider,
            ),
          );
          setEvents((current) => [...current, `${event.provider} failed: ${event.error}`]);
        }

        if (event.type === "gathering") {
          setStatus("gathering");
          setEvents((current) => [...current, "Gathering winning quote"]);
        }

        if (event.type === "done") {
          setStatus("done");
          setWinner(event.winner);
        }
      }
    }
  }

  async function startRun() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setError(null);
    setRunId(null);
    setStatus("scatter");
    setWinner(null);
    setProviders(PROVIDERS);
    setEvents(["Dispatching quote requests to all carriers."]);

    try {
      const response = await fetch("/api/scatter-gather", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId, failProviders: selectedFailures }),
        signal: abortRef.current.signal,
      });

      const payload = (await response.json()) as
        | { ok: true; runId: string }
        | { error?: { message?: string } };

      if (!response.ok || !("runId" in payload)) {
        throw new Error(
          ("error" in payload ? payload.error?.message : undefined) ??
            "Failed to start scatter-gather",
        );
      }

      setRunId(payload.runId);
      await connectToStream(payload.runId, abortRef.current.signal);
    } catch (runError) {
      if (runError instanceof Error && runError.name === "AbortError") return;
      setStatus("idle");
      setError(runError instanceof Error ? runError.message : "Unknown error");
    }
  }

  function toggleProvider(providerId: ProviderId) {
    setSelectedFailures((current) =>
      current.includes(providerId)
        ? current.filter((entry) => entry !== providerId)
        : [...current, providerId],
    );
  }

  return (
    <section className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">Scatter-Gather</p>
          <h2 className="text-xl font-semibold text-gray-950">Parallel carrier quote collection</h2>
        </div>
        <button
          className="rounded-md bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          onClick={startRun}
          disabled={status === "scatter" || status === "gathering"}
        >
          {status === "scatter" || status === "gathering" ? "Running..." : "Start Run"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1.2fr]">
        <label className="text-sm text-gray-700">
          Package ID
          <input
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
            value={packageId}
            onChange={(event) => setPackageId(event.target.value)}
            disabled={status === "scatter" || status === "gathering"}
          />
        </label>
        <div>
          <p className="text-sm text-gray-700">Simulate provider failures</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                className={`rounded-full border px-3 py-1 text-sm ${
                  selectedFailures.includes(provider.id)
                    ? "border-red-300 bg-red-50 text-red-700"
                    : "border-gray-300 bg-white text-gray-700"
                }`}
                onClick={() => toggleProvider(provider.id)}
                disabled={status === "scatter" || status === "gathering"}
              >
                {provider.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {providers.map((provider) => (
          <article key={provider.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-gray-900">{provider.label}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs ${badgeClass(provider.status)}`}>
                {provider.status}
              </span>
            </div>
            <p className="mt-3 text-sm text-gray-700">
              {provider.price !== null
                ? `$${provider.price.toFixed(2)} • ${provider.days} days`
                : provider.error || "Awaiting quote"}
            </p>
          </article>
        ))}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-900">Execution Log</p>
          <div className="mt-3 space-y-2 text-sm text-gray-700">
            {events.map((event, index) => (
              <p key={`${event}-${index}`}>{event}</p>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-900">Summary</p>
          <dl className="mt-3 space-y-2 text-sm text-gray-700">
            <div className="flex justify-between gap-4">
              <dt>Status</dt>
              <dd>{status}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Quoted providers</dt>
              <dd>{quotedCount}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Winner</dt>
              <dd>
                {winner ? `${winner.provider} • $${winner.price.toFixed(2)}` : "Pending"}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-gray-500">{runId ? `run ${runId}` : "idle"}</p>
          {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        </div>
      </div>
    </section>
  );
}
