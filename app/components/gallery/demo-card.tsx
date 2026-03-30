import Link from "next/link";
import { getTagLabel } from "@/lib/taxonomy";
import type { DemoCatalogEntry } from "@/lib/demos";

export function DemoCard({ demo }: { demo: DemoCatalogEntry }) {
  return (
    <Link
      href={`/demos/${demo.slug}`}
      className="group relative flex flex-col rounded-lg border border-gray-300 bg-background-200 p-5 transition-all duration-150 hover:border-gray-400 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
    >
      <h3 className="text-[13px] font-semibold text-gray-1000 leading-snug group-hover:text-blue-700 transition-colors duration-150">
        {demo.title}
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-gray-900 line-clamp-2 flex-1">
        {demo.description}
      </p>
      <div className="mt-auto pt-3 flex items-end justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {demo.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-block rounded-full border border-gray-300 px-2 py-0.5 text-[10px] font-mono text-gray-500"
            >
              {getTagLabel(tag)}
            </span>
          ))}
          {demo.tags.length > 3 && (
            <span className="inline-block rounded-full border border-gray-300 px-2 py-0.5 text-[10px] font-mono text-gray-500">
              +{demo.tags.length - 3}
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
          className="shrink-0 text-gray-500 opacity-0 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0.5 group-focus-visible:opacity-100"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </Link>
  );
}
