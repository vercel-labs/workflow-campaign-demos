"use client";

import Link from "next/link";
import { demos } from "@/lib/demos";
import type { DemoCatalogEntry } from "@/lib/demos";
import {
  workflowApis,
  getApiUsageCounts,
  getApiColorClasses,
  getDemoApis,
  getAllDemoApis,
} from "@/lib/api-taxonomy";
import { useState, useMemo, useCallback } from "react";

/**
 * Browse Gallery — full API-filterable gallery of all demos.
 *
 * Scenario quick-starts, multi-select API filter strip, search bar,
 * and cards with fingerprint dots + scenario text + API pills.
 */

const scenarios = [
  {
    label: "Wait for human approval",
    query: "approval",
    apis: ["defineHook"],
  },
  {
    label: "Retry on failure",
    query: "retry",
    apis: ["FatalError"],
  },
  {
    label: "Schedule a delayed task",
    query: "sleep",
    apis: ["sleep"],
  },
  {
    label: "Fan out to parallel workers",
    query: "fan-out scatter",
    apis: [],
  },
  {
    label: "Track step attempts",
    query: "",
    apis: ["getStepMetadata"],
  },
  {
    label: "Pause until a webhook fires",
    query: "",
    apis: ["defineHook"],
  },
];

const filterableApis = workflowApis.filter(
  (a) => !["use-workflow", "use-step", "getWritable"].includes(a.id)
);

export default function GalleryPage() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const counts = useMemo(() => getApiUsageCounts(), []);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const applyScenario = useCallback(
    (scenario: (typeof scenarios)[number]) => {
      setQuery(scenario.query);
      setSelected(new Set(scenario.apis));
    },
    []
  );

  const clearAll = useCallback(() => {
    setSelected(new Set());
    setQuery("");
  }, []);

  const filtered = useMemo(() => {
    let results: DemoCatalogEntry[] = [...demos];

    if (selected.size > 0) {
      results = results.filter((d) => {
        const demoApiIds = new Set(getDemoApis(d.slug).map((a) => a.id));
        return [...selected].every((id) => demoApiIds.has(id));
      });
    }

    if (query.trim()) {
      const terms = query.toLowerCase().trim().split(/\s+/);
      results = results.filter((d) => {
        const apis = getDemoApis(d.slug).map((a) => a.label.toLowerCase());
        const haystack = [
          d.title,
          d.description,
          d.whenToUse,
          d.slug,
          ...d.tags,
          ...apis,
        ]
          .join(" ")
          .toLowerCase();
        return terms.some((t) => haystack.includes(t));
      });
    }

    return results;
  }, [selected, query]);

  const hasFilters = selected.size > 0 || query.trim().length > 0;

  const comboLabel = useMemo(() => {
    if (selected.size === 0) return null;
    const names = [...selected]
      .map((id) => workflowApis.find((a) => a.id === id)?.label)
      .filter(Boolean);
    return names.join(" + ");
  }, [selected]);

  return (
    <main
      id="main-content"
      className="min-h-screen px-6 pt-20 pb-20 mx-auto max-w-7xl"
    >
      <Link
        href="/"
        className="text-sm text-gray-400 hover:text-gray-1000 font-mono transition-colors"
      >
        ← API Finder
      </Link>

      <header className="mb-10 mt-6 text-center">
        <h1 className="text-5xl font-semibold tracking-tight text-gray-1000 sm:text-6xl">
          Browse Gallery
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-gray-1000/70">
          All {demos.length} Workflow DevKit demos. Filter by API, search by
          scenario, or browse everything.
        </p>
      </header>

      {/* Scenario quick-starts */}
      <section className="mb-8">
        <h2 className="text-xs font-mono uppercase tracking-wider text-gray-400 mb-3 text-center">
          What are you building?
        </h2>
        <div className="flex flex-wrap justify-center gap-2">
          {scenarios.map((s) => (
            <button
              key={s.label}
              onClick={() => applyScenario(s)}
              className="rounded-full border border-gray-300 bg-background-200 px-4 py-2 text-sm text-gray-1000 transition-all hover:border-blue-700 hover:text-blue-700 hover:bg-blue-700/5"
            >
              {s.label}
            </button>
          ))}
        </div>
      </section>

      {/* API filter strip */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        {filterableApis.map((api) => {
          const active = selected.has(api.id);
          const colors = getApiColorClasses(api);
          const count = counts.get(api.id) ?? 0;
          return (
            <button
              key={api.id}
              onClick={() => toggle(api.id)}
              title={api.description}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-mono transition-all ${
                active
                  ? `${colors.badge} ring-1 ring-current`
                  : "border-gray-300 text-gray-1000/80 hover:border-gray-400 hover:text-gray-1000"
              }`}
            >
              {api.label}
              <span className="ml-1.5 text-[11px] opacity-50">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search bar */}
      <div className="flex justify-center mb-6">
        <div className="relative w-full max-w-xl">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
            />
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, scenario, or API..."
            className="w-full rounded-lg border border-gray-300 bg-background-200 px-4 py-3 pl-10 text-base text-gray-1000 placeholder:text-gray-400 focus:border-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-700"
          />
        </div>
      </div>

      {/* Result header */}
      <div className="flex items-center justify-between pb-4">
        <div>
          {comboLabel && (
            <p className="text-sm font-mono text-blue-700 mb-1">
              Filtering: {comboLabel}
            </p>
          )}
          <p className="text-sm text-gray-1000/60 font-mono tabular-nums">
            {filtered.length} demo{filtered.length !== 1 ? "s" : ""}
            {hasFilters && <span className="text-gray-400"> · filtered</span>}
          </p>
        </div>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="text-sm font-mono text-gray-400 hover:text-gray-1000 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Card grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((demo) => {
          const allApis = getAllDemoApis(demo.slug);
          const interestingApis = getDemoApis(demo.slug);
          return (
            <Link
              key={demo.slug}
              href={`/demos/${demo.slug}`}
              className="group relative flex min-h-56 flex-col rounded-xl border border-gray-300 bg-background-200 p-5 transition-all duration-150 hover:border-gray-400 hover:bg-gray-100"
            >
              {/* Fingerprint dots */}
              <div className="mb-3 flex items-center gap-1.5">
                {allApis.map((api, i) => {
                  const colors = getApiColorClasses(api);
                  return (
                    <div
                      key={`${api.id}-${i}`}
                      className={`h-2 w-2 rounded-full ${colors.dot}`}
                      title={api.label}
                    />
                  );
                })}
              </div>

              <h3 className="text-base font-semibold leading-snug text-gray-1000 transition-colors group-hover:text-blue-700">
                {demo.title}
              </h3>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-gray-1000/70">
                {demo.description}
              </p>

              <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-gray-1000/50">
                <span className="font-mono text-cyan-700">scenario</span>{" "}
                {demo.whenToUse}
              </p>

              {/* API pills + arrow */}
              <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                <div className="flex flex-wrap gap-1.5">
                  {interestingApis.map((api) => {
                    const colors = getApiColorClasses(api);
                    const isMatched = selected.has(api.id);
                    return (
                      <span
                        key={api.id}
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-mono ${
                          isMatched
                            ? `${colors.badge} ring-1 ring-current`
                            : colors.badge
                        }`}
                      >
                        {api.label}
                      </span>
                    );
                  })}
                  {interestingApis.length === 0 && (
                    <span className="text-[11px] font-mono text-gray-400">
                      core only
                    </span>
                  )}
                </div>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="shrink-0 text-gray-400 opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="py-20 text-center">
          <p className="text-sm text-gray-400">No demos match your filters.</p>
          <button
            onClick={clearAll}
            className="mt-2 text-sm font-mono text-blue-700 hover:underline"
          >
            Clear all filters
          </button>
        </div>
      )}
    </main>
  );
}
