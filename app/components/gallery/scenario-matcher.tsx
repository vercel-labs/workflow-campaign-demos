"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { demos } from "@/lib/demos";
import type { DemoCatalogEntry } from "@/lib/demos";
import { taxonomyMap } from "@/lib/taxonomy";
import { SearchPanel } from "./search-panel";
import { FilterBar } from "./filter-bar";
import { DemoGrid } from "./demo-grid";

function getRequestedTags(tagParams: string[]): Set<string> {
  return new Set(
    tagParams
      .flatMap((value) => value.split(","))
      .map((value) => value.trim().toLowerCase())
      .filter((value) => taxonomyMap.has(value)),
  );
}

function ScenarioMatcherContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedTagKey = searchParams.getAll("tag").join(",");
  const requestedTags = useMemo(
    () => getRequestedTags(searchParams.getAll("tag")),
    [requestedTagKey, searchParams],
  );
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState<Set<string>>(() => requestedTags);

  useEffect(() => {
    setActiveTags(requestedTags);
  }, [requestedTags]);

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

  const clearFilters = useCallback(() => {
    setQuery("");
    setActiveTags(new Set());

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("tag");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams]);

  const hasActiveFilters = activeTags.size > 0 || query.trim().length > 0;

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
        <p className="text-sm text-gray-900 font-mono tabular-nums">
          {filtered.length} pattern{filtered.length !== 1 ? "s" : ""}
          {hasActiveFilters && (
            <span className="text-gray-400">
              {" "}· filtered
            </span>
          )}
        </p>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-gray-900 font-mono hover:text-gray-1000 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>
      <DemoGrid demos={filtered} />
    </div>
  );
}

/**
 * Client component that owns search + filter state and renders the
 * filtered demo grid. All filtering is client-side over the static catalog.
 */
export function ScenarioMatcher() {
  return (
    <Suspense fallback={null}>
      <ScenarioMatcherContent />
    </Suspense>
  );
}
