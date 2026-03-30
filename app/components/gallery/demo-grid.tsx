import type { DemoCatalogEntry } from "@/lib/demos";
import { DemoCard } from "./demo-card";

export function DemoGrid({ demos }: { demos: DemoCatalogEntry[] }) {
  if (demos.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-gray-500">
          No patterns match your filters.
        </p>
        <p className="mt-1 text-xs text-gray-500 font-mono">
          Try a broader search or clear your tag filters.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {demos.map((demo) => (
        <DemoCard key={demo.slug} demo={demo} />
      ))}
    </div>
  );
}
