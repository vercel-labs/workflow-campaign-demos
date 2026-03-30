"use client";

import Link from "next/link";
import { demos } from "@/lib/demos";
import { getDemoApis, getApiColorClasses } from "@/lib/api-taxonomy";
import { getTagLabel } from "@/lib/taxonomy";
import { useState } from "react";

/**
 * V1 — API-First Cards
 *
 * Replace the generic "pattern" badge with actual DevKit API pills.
 * Search filters on API names too. Category tags move to the bottom.
 */
export default function V1Page() {
  const [query, setQuery] = useState("");

  const filtered = demos.filter((d) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const apis = getDemoApis(d.slug).map((a) => a.label.toLowerCase());
    const haystack = [d.title, d.description, d.whenToUse, d.slug, ...d.tags, ...apis]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });

  return (
    <main className="min-h-screen px-6 pt-20 pb-20 mx-auto max-w-7xl">
      <Link href="/explore" className="text-sm text-gray-500 hover:text-gray-1000 font-mono">
        ← explorations
      </Link>
      <header className="mb-14 mt-6 text-center">
        <h1 className="text-5xl font-semibold tracking-tight text-gray-1000 sm:text-6xl">
          API Gallery
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-gray-900">
          {demos.length} workflow demos organized by the DevKit APIs they use.
          Search by API name, pattern, or scenario.
        </p>
      </header>

      <div className="flex justify-center mb-8">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by API (sleep, defineHook...) or scenario..."
          className="w-full max-w-xl rounded-lg border border-gray-300 bg-background-200 px-4 py-3 pl-4 text-base text-gray-1000 placeholder:text-gray-400 focus:border-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-700"
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
              className="group relative flex min-h-56 flex-col rounded-xl border border-gray-300 bg-background-200 p-5 transition-all duration-150 hover:border-gray-400 hover:bg-gray-100"
            >
              {/* API pills row */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                {apis.length > 0 ? (
                  apis.map((api) => {
                    const colors = getApiColorClasses(api);
                    return (
                      <span
                        key={api.id}
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-mono ${colors.badge}`}
                      >
                        {api.label}
                      </span>
                    );
                  })
                ) : (
                  <span className="rounded-full border border-gray-300 px-2 py-0.5 text-[11px] font-mono text-gray-500">
                    core only
                  </span>
                )}
              </div>

              <h3 className="text-base font-semibold leading-snug text-gray-1000 group-hover:text-blue-700 transition-colors">
                {demo.title}
              </h3>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-gray-900">
                {demo.description}
              </p>
              <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-gray-900">
                <span className="font-mono text-cyan-700">when to use</span>{" "}
                {demo.whenToUse}
              </p>

              <div className="mt-auto pt-4 flex flex-wrap gap-1.5">
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
          );
        })}
      </div>
    </main>
  );
}
