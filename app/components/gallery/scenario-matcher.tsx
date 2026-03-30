"use client";

import { useState, useMemo, useCallback } from "react";
import { demos } from "@/lib/demos";
import type { DemoCatalogEntry } from "@/lib/demos";
import { SearchPanel } from "./search-panel";
import { FilterBar } from "./filter-bar";
import { DemoGrid } from "./demo-grid";

/**
 * Client component that owns search + filter state and renders the
 * filtered demo grid. All filtering is client-side over the static catalog.
 */
export function ScenarioMatcher() {
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  const toggleTag = useCallback((tagId: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  }, []);

  const filtered = useMemo(() => {
    let results: DemoCatalogEntry[] = demos;

    // Tag filter: demo must have ALL active tags (intersection)
    if (activeTags.size > 0) {
      results = results.filter((d) =>
        [...activeTags].every((tag) => d.tags.includes(tag))
      );
    }

    // Free-text search: match against title, description, whenToUse, slug, tags
    if (query.trim()) {
      const q = query.toLowerCase().trim();
      results = results.filter((d) => {
        const haystack = [
          d.title,
          d.description,
          d.whenToUse,
          d.slug,
          ...d.tags,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    return results;
  }, [query, activeTags]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-4">
        <SearchPanel value={query} onChange={setQuery} />
        <FilterBar activeTags={activeTags} onToggle={toggleTag} />
      </div>
      <div className="flex items-center justify-between pt-2 pb-3">
        <p className="text-xs text-gray-500 font-mono tabular-nums">
          {filtered.length} pattern{filtered.length !== 1 ? "s" : ""}
          {activeTags.size > 0 && (
            <span className="text-gray-400">
              {" "}· filtered
            </span>
          )}
        </p>
        {activeTags.size > 0 && (
          <button
            onClick={() => setActiveTags(new Set())}
            className="text-xs text-gray-500 font-mono hover:text-gray-1000 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>
      <DemoGrid demos={filtered} />
    </div>
  );
}
