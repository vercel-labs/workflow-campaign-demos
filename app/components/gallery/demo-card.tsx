import Link from "next/link";
import { getTagLabel } from "@/lib/taxonomy";
import type { DemoCatalogEntry } from "@/lib/demos";

export function DemoCard({ demo }: { demo: DemoCatalogEntry }) {
  return (
    <Link
      href={`/demos/${demo.slug}`}
      className="group block rounded-lg border border-gray-300 bg-background-200 p-5 transition-colors hover:border-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
    >
      <h3 className="text-base font-semibold text-gray-1000 group-hover:text-blue-700 transition-colors">
        {demo.title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-gray-900 line-clamp-2">
        {demo.description}
      </p>
      {demo.whenToUse && (
        <p className="mt-2 text-xs text-gray-500 line-clamp-1 font-mono">
          {demo.whenToUse}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {demo.tags.map((tag) => (
          <span
            key={tag}
            className="inline-block rounded-full bg-gray-300 px-2 py-0.5 text-xs font-mono text-gray-900"
          >
            {getTagLabel(tag)}
          </span>
        ))}
      </div>
    </Link>
  );
}
