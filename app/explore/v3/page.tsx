"use client";

import Link from "next/link";
import { demos } from "@/lib/demos";
import {
  workflowApis,
  getApiColorClasses,
  getDemoApis,
  getApiUsageCounts,
} from "@/lib/api-taxonomy";
import { useState, useMemo } from "react";

/**
 * V3 — Combination Discovery
 *
 * Multi-select API pills. The gallery shows demos matching ALL selected APIs.
 * Reveals how APIs compose: sleep + defineHook → wakeable patterns, etc.
 */

// Only show the interesting (non-universal) APIs for filtering
const filterableApis = workflowApis.filter(
  (a) => !["use-workflow", "use-step", "getWritable"].includes(a.id)
);

export default function V3Page() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const counts = useMemo(() => getApiUsageCounts(), []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    if (selected.size === 0) return demos;
    return demos.filter((d) => {
      const demoApiIds = new Set(getDemoApis(d.slug).map((a) => a.id));
      return [...selected].every((id) => demoApiIds.has(id));
    });
  }, [selected]);

  // Compute a "recipe" label for the current combination
  const comboLabel = useMemo(() => {
    if (selected.size === 0) return null;
    if (selected.size === 1) {
      const api = workflowApis.find((a) => a.id === [...selected][0]);
      return api ? `Demos using ${api.label}` : null;
    }
    const names = [...selected]
      .map((id) => workflowApis.find((a) => a.id === id)?.label)
      .filter(Boolean);
    return `Demos combining ${names.join(" + ")}`;
  }, [selected]);

  return (
    <main className="min-h-screen px-6 pt-20 pb-20 mx-auto max-w-7xl">
      <Link
        href="/explore"
        className="text-sm text-gray-500 hover:text-gray-1000 font-mono"
      >
        ← explorations
      </Link>
      <header className="mb-10 mt-6 text-center">
        <h1 className="text-5xl font-semibold tracking-tight text-gray-1000 sm:text-6xl">
          API Combinations
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-gray-900">
          Select multiple APIs to discover which demos combine them. See how
          primitives compose into real patterns.
        </p>
      </header>

      {/* Multi-select API bar */}
      <div className="flex flex-wrap justify-center gap-2 mb-4">
        {filterableApis.map((api) => {
          const active = selected.has(api.id);
          const colors = getApiColorClasses(api);
          const count = counts.get(api.id) ?? 0;
          return (
            <button
              key={api.id}
              onClick={() => toggle(api.id)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-mono transition-all ${
                active
                  ? `${colors.badge} ring-1 ring-current`
                  : "border-gray-300 text-gray-900 hover:border-gray-400"
              }`}
            >
              {api.label}
              <span className="ml-1.5 text-[10px] opacity-60">{count}</span>
            </button>
          );
        })}
      </div>

      {selected.size > 0 && (
        <div className="text-center mb-6">
          <button
            onClick={() => setSelected(new Set())}
            className="text-sm font-mono text-gray-500 hover:text-gray-1000"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Combo result header */}
      <div className="flex items-center justify-between pt-2 pb-4">
        <div>
          {comboLabel && (
            <p className="text-sm font-mono text-blue-700">{comboLabel}</p>
          )}
          <p className="text-sm text-gray-900 font-mono">
            {filtered.length} demo{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((demo) => {
          const apis = getDemoApis(demo.slug);
          return (
            <Link
              key={demo.slug}
              href={`/demos/${demo.slug}`}
              className="group flex min-h-48 flex-col rounded-xl border border-gray-300 bg-background-200 p-5 transition-all hover:border-gray-400 hover:bg-gray-100"
            >
              <h3 className="text-base font-semibold text-gray-1000 group-hover:text-blue-700 transition-colors">
                {demo.title}
              </h3>
              <p className="mt-2 line-clamp-2 text-sm text-gray-900">
                {demo.description}
              </p>

              {/* Show which selected APIs this demo uses (highlighted) */}
              <div className="mt-auto pt-3 flex flex-wrap gap-1.5">
                {apis.map((api) => {
                  const colors = getApiColorClasses(api);
                  const isMatched = selected.has(api.id);
                  return (
                    <span
                      key={api.id}
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-mono ${
                        isMatched
                          ? colors.badge
                          : "border-gray-300 text-gray-500"
                      }`}
                    >
                      {api.label}
                    </span>
                  );
                })}
                {apis.length === 0 && (
                  <span className="text-[11px] font-mono text-gray-500">
                    core only
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
