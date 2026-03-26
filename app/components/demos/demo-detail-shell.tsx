import type { ReactNode } from "react";
import type { DemoCatalogEntry } from "@/lib/demos";
import type { DemoApiRoute } from "@/lib/demo-adapters";

export function DemoDetailShell({
  slug,
  title,
  catalogEntry,
  apiRoutes,
  children,
}: {
  slug: string;
  title: string;
  catalogEntry?: DemoCatalogEntry;
  apiRoutes: DemoApiRoute[];
  children: ReactNode;
}) {
  return (
    <main
      id="main-content"
      className="min-h-screen bg-background-100 px-6 py-12 text-gray-1000"
    >
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <a
            href="/"
            className="text-sm text-gray-500 transition-colors hover:text-gray-1000"
          >
            &larr; Gallery
          </a>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            {title}
          </h1>

          {catalogEntry?.description ? (
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-900">
              {catalogEntry.description}
            </p>
          ) : null}

          {catalogEntry?.whenToUse ? (
            <p className="mt-2 text-xs font-mono text-gray-500">
              <span className="text-gray-900">When to use:</span>{" "}
              {catalogEntry.whenToUse}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {apiRoutes.map((route) => (
              <span
                key={`${route.kind}:${route.route}`}
                className="rounded-full border border-gray-300 bg-background-200 px-2.5 py-1 text-xs font-mono text-gray-900"
              >
                {route.kind}: {route.route}
              </span>
            ))}
          </div>

          <p className="mt-3 text-xs font-mono text-gray-500">
            Code API:{" "}
            <code className="text-cyan-700">/api/demos/{slug}/code</code>
          </p>
        </header>

        {children}
      </div>
    </main>
  );
}
