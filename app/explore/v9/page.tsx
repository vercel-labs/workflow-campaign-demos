"use client";

import Link from "next/link";
import { demos } from "@/lib/demos";
import type { DemoCatalogEntry } from "@/lib/demos";
import { getDemoApis, getApiColorClasses } from "@/lib/api-taxonomy";
import { useState, useMemo, useCallback } from "react";

/**
 * V9 — Two-Axis Matrix Picker
 *
 * Instead of sequential questions, show two dimensions simultaneously:
 * - Y-axis: "What's happening?" (the verb/action)
 * - X-axis: "What's involved?" (the concern/constraint)
 *
 * Each cell in the matrix contains matching demos. Click a cell to see them.
 * This lets users find patterns from two angles at once.
 */

type Axis = {
  id: string;
  label: string;
  description: string;
  filter: (d: DemoCatalogEntry) => boolean;
};

const yAxis: Axis[] = [
  {
    id: "orchestrate",
    label: "Orchestrate",
    description: "Coordinate multiple steps or services",
    filter: (d) =>
      d.tags.some((t) => ["orchestration", "async"].includes(t)) ||
      ["fan-out", "scatter-gather", "map-reduce", "saga", "pipeline", "process-manager", "choreography"].includes(d.slug),
  },
  {
    id: "wait",
    label: "Wait & Resume",
    description: "Pause for signals, time, or humans",
    filter: (d) => {
      const apis = getDemoApis(d.slug).map((a) => a.id);
      return (
        apis.includes("sleep") ||
        apis.includes("defineHook") ||
        d.tags.includes("scheduling") ||
        d.tags.includes("human-in-the-loop")
      );
    },
  },
  {
    id: "protect",
    label: "Protect",
    description: "Handle errors, retries, and failures",
    filter: (d) =>
      d.tags.includes("resilience") ||
      getDemoApis(d.slug).some((a) => ["FatalError", "RetryableError"].includes(a.id)),
  },
  {
    id: "route",
    label: "Route & Transform",
    description: "Filter, split, translate, or direct data",
    filter: (d) =>
      d.tags.some((t) => ["messaging", "routing", "data-processing"].includes(t)),
  },
  {
    id: "observe",
    label: "Observe",
    description: "Log, trace, audit, or monitor",
    filter: (d) =>
      d.tags.includes("observability") ||
      ["wire-tap", "namespaced-streams", "message-history", "correlation-identifier"].includes(d.slug),
  },
];

const xAxis: Axis[] = [
  {
    id: "parallel",
    label: "Parallel work",
    description: "Multiple tasks at once",
    filter: (d) =>
      d.description.toLowerCase().includes("parallel") ||
      ["fan-out", "scatter-gather", "map-reduce", "aggregator", "recipient-list", "publish-subscribe", "hedge-request", "content-enricher"].includes(d.slug),
  },
  {
    id: "human",
    label: "Human input",
    description: "Approvals, reviews, cancels",
    filter: (d) => d.tags.includes("human-in-the-loop"),
  },
  {
    id: "external",
    label: "External systems",
    description: "APIs, webhooks, signals",
    filter: (d) =>
      d.tags.includes("integration") ||
      getDemoApis(d.slug).some((a) => a.id === "defineHook") ||
      ["webhook-basics", "async-request-reply", "request-reply", "claim-check"].includes(d.slug),
  },
  {
    id: "time",
    label: "Time-based",
    description: "Delays, schedules, polling",
    filter: (d) =>
      d.tags.includes("scheduling") ||
      getDemoApis(d.slug).some((a) => a.id === "sleep"),
  },
  {
    id: "errors",
    label: "Error handling",
    description: "Retries, failures, recovery",
    filter: (d) =>
      d.tags.includes("resilience") ||
      getDemoApis(d.slug).some((a) =>
        ["FatalError", "RetryableError", "getStepMetadata"].includes(a.id)
      ),
  },
];

export default function V9Page() {
  const [selectedCell, setSelectedCell] = useState<{
    y: number;
    x: number;
  } | null>(null);

  // Precompute the matrix
  const matrix = useMemo(() => {
    return yAxis.map((row) =>
      xAxis.map((col) => {
        const matches = demos.filter(
          (d) => row.filter(d) && col.filter(d)
        );
        return matches;
      })
    );
  }, []);

  const selectedDemos = useMemo(() => {
    if (!selectedCell) return null;
    return matrix[selectedCell.y][selectedCell.x];
  }, [selectedCell, matrix]);

  const selectedLabels = useMemo(() => {
    if (!selectedCell) return null;
    return {
      row: yAxis[selectedCell.y],
      col: xAxis[selectedCell.x],
    };
  }, [selectedCell]);

  const clearSelection = useCallback(() => setSelectedCell(null), []);

  return (
    <main className="min-h-screen px-6 pt-20 pb-20 mx-auto max-w-7xl">
      <Link
        href="/explore"
        className="text-sm text-gray-400 hover:text-gray-1000 font-mono transition-colors"
      >
        ← explorations
      </Link>

      <header className="mb-12 mt-6 text-center">
        <h1 className="text-5xl font-semibold tracking-tight text-gray-1000 sm:text-6xl">
          Pattern Matrix
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-gray-1000/70">
          Find patterns at the intersection of what you&apos;re doing and
          what&apos;s involved. Click any cell to see matching demos.
        </p>
      </header>

      {/* Matrix grid */}
      <div className="overflow-x-auto mb-10">
        <div className="min-w-[700px]">
          {/* Column headers */}
          <div className="grid grid-cols-[160px_repeat(5,1fr)] gap-1 mb-1">
            <div /> {/* empty corner */}
            {xAxis.map((col) => (
              <div
                key={col.id}
                className="px-2 py-3 text-center"
              >
                <p className="text-xs font-mono font-medium text-gray-1000">
                  {col.label}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {col.description}
                </p>
              </div>
            ))}
          </div>

          {/* Rows */}
          {yAxis.map((row, yi) => (
            <div
              key={row.id}
              className="grid grid-cols-[160px_repeat(5,1fr)] gap-1 mb-1"
            >
              {/* Row header */}
              <div className="flex flex-col justify-center px-3 py-3 rounded-l-lg">
                <p className="text-xs font-mono font-medium text-gray-1000">
                  {row.label}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {row.description}
                </p>
              </div>

              {/* Cells */}
              {xAxis.map((col, xi) => {
                const count = matrix[yi][xi].length;
                const isSelected =
                  selectedCell?.y === yi && selectedCell?.x === xi;
                const isEmpty = count === 0;
                return (
                  <button
                    key={col.id}
                    onClick={() =>
                      isEmpty
                        ? null
                        : setSelectedCell(
                            isSelected ? null : { y: yi, x: xi }
                          )
                    }
                    disabled={isEmpty}
                    className={`rounded-lg border px-3 py-4 text-center transition-all ${
                      isEmpty
                        ? "border-gray-300/30 bg-background-100/50 cursor-default"
                        : isSelected
                          ? "border-blue-700 bg-blue-700/15 ring-1 ring-blue-700"
                          : "border-gray-300 bg-background-200 hover:border-gray-400 hover:bg-gray-100 cursor-pointer"
                    }`}
                  >
                    <span
                      className={`text-lg font-mono font-semibold tabular-nums ${
                        isEmpty
                          ? "text-gray-400/30"
                          : isSelected
                            ? "text-blue-700"
                            : "text-gray-1000"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Selected cell results */}
      {selectedDemos && selectedLabels && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-1000">
                {selectedLabels.row.label} × {selectedLabels.col.label}
              </h2>
              <p className="text-sm text-gray-1000/60">
                {selectedDemos.length} demo
                {selectedDemos.length !== 1 ? "s" : ""} at this intersection
              </p>
            </div>
            <button
              onClick={clearSelection}
              className="text-sm font-mono text-gray-400 hover:text-gray-1000 transition-colors"
            >
              Clear
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {selectedDemos.map((demo) => {
              const apis = getDemoApis(demo.slug);
              return (
                <Link
                  key={demo.slug}
                  href={`/demos/${demo.slug}`}
                  className="group flex flex-col rounded-xl border border-gray-300 bg-background-200 p-5 transition-all hover:border-gray-400 hover:bg-gray-100"
                >
                  <h3 className="text-base font-semibold text-gray-1000 group-hover:text-blue-700 transition-colors">
                    {demo.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-gray-1000/70 line-clamp-2">
                    {demo.description}
                  </p>
                  <p className="mt-2 text-xs text-gray-1000/50 line-clamp-2">
                    <span className="font-mono text-cyan-700">scenario</span>{" "}
                    {demo.whenToUse}
                  </p>
                  <div className="mt-auto pt-3 flex flex-wrap gap-1.5">
                    {apis.map((api) => {
                      const colors = getApiColorClasses(api);
                      return (
                        <span
                          key={api.id}
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-mono ${colors.badge}`}
                        >
                          {api.label}
                        </span>
                      );
                    })}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!selectedDemos && (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-400">
            Click any cell in the matrix above to see matching demos.
          </p>
        </div>
      )}
    </main>
  );
}
