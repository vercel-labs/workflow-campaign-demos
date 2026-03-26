import type { DemoCatalogEntry } from "@/lib/demos";
import { DemoCard } from "./demo-card";

export function DemoGrid({ demos }: { demos: DemoCatalogEntry[] }) {
  if (demos.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-gray-500 text-sm">
          No demos match your current filters.
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
