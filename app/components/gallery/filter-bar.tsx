"use client";

import { taxonomy } from "@/lib/taxonomy";

export function FilterBar({
  activeTags,
  onToggle,
}: {
  activeTags: Set<string>;
  onToggle: (tagId: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
      {taxonomy.map((tag) => {
        const active = activeTags.has(tag.id);
        return (
          <button
            key={tag.id}
            onClick={() => onToggle(tag.id)}
            aria-pressed={active}
            title={tag.description}
            className={`rounded-full border px-3 py-1 text-xs font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${
              active
                ? "border-blue-700 bg-blue-700/15 text-blue-700"
                : "border-gray-300 bg-transparent text-gray-900 hover:border-gray-400 hover:text-gray-1000"
            }`}
          >
            {tag.label}
          </button>
        );
      })}
    </div>
  );
}
