"use client";

import Link from "next/link";
import { demos } from "@/lib/demos";
import {
  workflowApis,
  getApiUsageCounts,
  getApiColorClasses,
  getDemoApis,
} from "@/lib/api-taxonomy";
import { getTagLabel } from "@/lib/taxonomy";
import { useState, useMemo } from "react";

/**
 * V2 — API Periodic Table
 *
 * Opens with a visual map of the 9 API primitives grouped by kind.
 * Each tile is clickable and shows a count of how many demos use it.
 * Clicking a tile filters the gallery below.
 */

const kindLabels: Record<string, string> = {
  directive: "Directives",
  stream: "Streaming",
  "flow-control": "Flow Control",
  error: "Error Handling",
  metadata: "Metadata",
};

const kindOrder = ["directive", "stream", "flow-control", "error", "metadata"];

export default function V2Page() {
  const [selectedApi, setSelectedApi] = useState<string | null>(null);
  const counts = useMemo(() => getApiUsageCounts(), []);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof workflowApis> = {};
    for (const api of workflowApis) {
      (groups[api.kind] ??= []).push(api);
    }
    return groups;
  }, []);

  const filtered = useMemo(() => {
    if (!selectedApi) return demos;
    return demos.filter((d) => {
      const demoApiIds = getDemoApis(d.slug).map((a) => a.id);
      // Universal APIs — every demo has them
      if (["use-workflow", "use-step", "getWritable"].includes(selectedApi))
        return true;
      return demoApiIds.includes(selectedApi);
    });
  }, [selectedApi]);

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
          API Explorer
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-gray-900">
          The complete Workflow DevKit surface area. Click any API to see demos
          that use it.
        </p>
      </header>

      {/* Periodic table */}
      <div className="mx-auto max-w-4xl mb-12">
        <div className="grid gap-6">
          {kindOrder.map((kind) => {
            const apis = grouped[kind];
            if (!apis) return null;
            return (
              <div key={kind}>
                <h2 className="text-xs font-mono uppercase tracking-wider text-gray-500 mb-3">
                  {kindLabels[kind]}
                </h2>
                <div className="flex flex-wrap gap-3">
                  {apis.map((api) => {
                    const colors = getApiColorClasses(api);
                    const count = counts.get(api.id) ?? 0;
                    const isSelected = selectedApi === api.id;
                    return (
                      <button
                        key={api.id}
                        onClick={() =>
                          setSelectedApi(isSelected ? null : api.id)
                        }
                        className={`relative flex flex-col items-start rounded-lg border p-4 min-w-[140px] transition-all ${
                          isSelected
                            ? `${colors.badge} ring-2 ring-current`
                            : "border-gray-300 bg-background-200 hover:border-gray-400"
                        }`}
                      >
                        <span className="text-sm font-mono font-medium text-gray-1000">
                          {api.label}
                        </span>
                        <span className="mt-1 text-[11px] text-gray-500 leading-tight">
                          {api.description.slice(0, 50)}
                          {api.description.length > 50 ? "…" : ""}
                        </span>
                        <span
                          className={`mt-2 text-[11px] font-mono ${
                            isSelected ? "" : "text-gray-500"
                          }`}
                        >
                          {count} demo{count !== 1 ? "s" : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filtered grid */}
      <div className="flex items-center justify-between pt-2 pb-4">
        <p className="text-sm text-gray-900 font-mono">
          {filtered.length} demo{filtered.length !== 1 ? "s" : ""}
          {selectedApi && (
            <span className="text-gray-400">
              {" "}
              ·{" "}
              {workflowApis.find((a) => a.id === selectedApi)?.label}
            </span>
          )}
        </p>
        {selectedApi && (
          <button
            onClick={() => setSelectedApi(null)}
            className="text-sm font-mono text-gray-900 hover:text-gray-1000"
          >
            Show all
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((demo) => (
          <Link
            key={demo.slug}
            href={`/demos/${demo.slug}`}
            className="group flex min-h-44 flex-col rounded-xl border border-gray-300 bg-background-200 p-5 transition-all hover:border-gray-400 hover:bg-gray-100"
          >
            <h3 className="text-base font-semibold text-gray-1000 group-hover:text-blue-700 transition-colors">
              {demo.title}
            </h3>
            <p className="mt-2 line-clamp-2 text-sm text-gray-900">
              {demo.description}
            </p>
            <div className="mt-auto pt-3 flex flex-wrap gap-1.5">
              {demo.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="inline-block rounded-full border border-gray-300 px-2.5 py-0.5 text-[11px] font-mono text-gray-500"
                >
                  {getTagLabel(tag)}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
