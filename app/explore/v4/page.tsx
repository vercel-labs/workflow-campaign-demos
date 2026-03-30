"use client";

import Link from "next/link";
import { demos } from "@/lib/demos";
import type { DemoCatalogEntry } from "@/lib/demos";
import {
  workflowApis,
  getDemoApis,
  getApiColorClasses,
  getApiUsageCounts,
} from "@/lib/api-taxonomy";
import { getTagLabel } from "@/lib/taxonomy";
import { useState, useMemo } from "react";

/**
 * V4 — Dual Mode: Reference + Scenario
 *
 * Toggle between two views:
 * - "By API" groups demos under each API heading (reference docs mode)
 * - "By Scenario" uses free-text search (problem-solving mode)
 */

type Mode = "api" | "scenario";

function ReferenceView() {
  const counts = useMemo(() => getApiUsageCounts(), []);

  // Only show interesting APIs (not the universal ones)
  const interestingApis = workflowApis.filter(
    (a) => !["use-workflow", "use-step", "getWritable"].includes(a.id)
  );

  return (
    <div className="space-y-10">
      {interestingApis.map((api) => {
        const colors = getApiColorClasses(api);
        const matching = demos.filter((d) =>
          getDemoApis(d.slug).some((a) => a.id === api.id)
        );
        if (matching.length === 0) return null;

        return (
          <section key={api.id}>
            <div className="flex items-baseline gap-3 mb-4">
              <h2 className="text-lg font-mono font-semibold text-gray-1000">
                {api.label}()
              </h2>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-mono ${colors.badge}`}>
                {api.kind}
              </span>
              <span className="text-sm text-gray-500">
                {matching.length} demo{matching.length !== 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-sm text-gray-900 mb-4">{api.description}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {matching.map((demo) => (
                <Link
                  key={demo.slug}
                  href={`/demos/${demo.slug}`}
                  className="group rounded-lg border border-gray-300 bg-background-200 p-4 transition-all hover:border-gray-400 hover:bg-gray-100"
                >
                  <h3 className="text-sm font-semibold text-gray-1000 group-hover:text-blue-700 transition-colors">
                    {demo.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-gray-900 line-clamp-2">
                    {demo.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ScenarioView() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return demos;
    const q = query.toLowerCase();
    return demos.filter((d) => {
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
      return haystack.includes(q);
    });
  }, [query]);

  return (
    <div>
      <div className="flex justify-center mb-8">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Describe what you're building..."
          className="w-full max-w-xl rounded-lg border border-gray-300 bg-background-200 px-4 py-3 text-base text-gray-1000 placeholder:text-gray-400 focus:border-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-700"
        />
      </div>
      <p className="text-sm text-gray-900 font-mono mb-4">
        {filtered.length} demo{filtered.length !== 1 ? "s" : ""}
      </p>
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
              <p className="mt-3 line-clamp-2 text-xs text-gray-900">
                <span className="font-mono text-cyan-700">when to use</span>{" "}
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
  );
}

export default function V4Page() {
  const [mode, setMode] = useState<Mode>("api");

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
          Workflow DevKit
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-gray-900">
          {demos.length} demos showing every API in action.
        </p>

        {/* Mode toggle */}
        <div className="mt-8 inline-flex rounded-lg border border-gray-300 bg-background-200 p-1">
          <button
            onClick={() => setMode("api")}
            className={`rounded-md px-4 py-2 text-sm font-mono transition-colors ${
              mode === "api"
                ? "bg-gray-100 text-gray-1000"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Browse by API
          </button>
          <button
            onClick={() => setMode("scenario")}
            className={`rounded-md px-4 py-2 text-sm font-mono transition-colors ${
              mode === "scenario"
                ? "bg-gray-100 text-gray-1000"
                : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Search by Scenario
          </button>
        </div>
      </header>

      {mode === "api" ? <ReferenceView /> : <ScenarioView />}
    </main>
  );
}
