"use client";

import Link from "next/link";
import { demos } from "@/lib/demos";
import { getAllDemoApis, getApiColorClasses, getDemoApis } from "@/lib/api-taxonomy";
import { GALLERY_TITLE } from "@/lib/page-titles";
import { getTagLabel } from "@/lib/taxonomy";
import { useState, useMemo } from "react";

/**
 * V5 — Visual Fingerprint Cards
 *
 * Each card has a compact "signature" row — a sequence of small colored dots
 * representing the APIs used. Creates an implicit complexity gradient:
 * simple demos have 3 dots, complex ones have 5-7.
 */

type SortMode = "alpha" | "complexity";

export default function V5Page() {
  const [sort, setSort] = useState<SortMode>("complexity");

  const sorted = useMemo(() => {
    const list = [...demos];
    if (sort === "complexity") {
      list.sort(
        (a, b) =>
          getAllDemoApis(b.slug).length - getAllDemoApis(a.slug).length
      );
    }
    return list;
  }, [sort]);

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
          {GALLERY_TITLE}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-gray-900">
          Each card shows its API fingerprint — a visual signature of the DevKit
          primitives it uses.
        </p>
      </header>

      {/* Sort toggle */}
      <div className="flex justify-center gap-4 mb-8">
        <button
          onClick={() => setSort("complexity")}
          className={`text-sm font-mono transition-colors ${
            sort === "complexity"
              ? "text-gray-1000 underline underline-offset-4"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          By complexity
        </button>
        <button
          onClick={() => setSort("alpha")}
          className={`text-sm font-mono transition-colors ${
            sort === "alpha"
              ? "text-gray-1000 underline underline-offset-4"
              : "text-gray-500 hover:text-gray-900"
          }`}
        >
          A–Z
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((demo) => {
          const allApis = getAllDemoApis(demo.slug);
          const interestingApis = getDemoApis(demo.slug);
          return (
            <Link
              key={demo.slug}
              href={`/demos/${demo.slug}`}
              className="group relative flex min-h-52 flex-col rounded-xl border border-gray-300 bg-background-200 p-5 transition-all hover:border-gray-400 hover:bg-gray-100"
            >
              {/* Fingerprint bar — dots + labels */}
              <div className="mb-3 flex items-center gap-1">
                {allApis.map((api) => {
                  const colors = getApiColorClasses(api);
                  return (
                    <div
                      key={api.id}
                      className={`h-2 w-2 rounded-full ${colors.dot}`}
                      title={api.label}
                    />
                  );
                })}
                <span className="ml-2 text-[10px] font-mono text-gray-500">
                  {allApis.length} API{allApis.length !== 1 ? "s" : ""}
                </span>
              </div>

              <h3 className="text-base font-semibold text-gray-1000 group-hover:text-blue-700 transition-colors">
                {demo.title}
              </h3>
              <p className="mt-2 line-clamp-2 text-sm text-gray-900">
                {demo.description}
              </p>

              {/* Expanded API labels */}
              <div className="mt-auto pt-3 flex flex-wrap gap-1">
                {interestingApis.map((api) => {
                  const colors = getApiColorClasses(api);
                  return (
                    <span
                      key={api.id}
                      className={`rounded-full border px-1.5 py-0.5 text-[10px] font-mono ${colors.badge}`}
                    >
                      {api.label}
                    </span>
                  );
                })}
                {interestingApis.length === 0 && (
                  <span className="text-[10px] font-mono text-gray-500">
                    core primitives only
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
