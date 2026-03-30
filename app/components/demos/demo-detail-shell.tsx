import type { ReactNode } from "react";
import type { DemoCatalogEntry } from "@/lib/demos";
import { getTagLabel } from "@/lib/taxonomy";

type DemoApiRoute = {
  route: string;
  kind: "start" | "readable" | "extra";
};

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
      className="min-h-screen bg-background-100 px-6 py-10 text-gray-1000"
    >
      <div className="mx-auto max-w-6xl">
        {/* Navigation */}
        <nav className="mb-8">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-gray-500 transition-colors hover:text-gray-1000"
          >
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
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Gallery
          </a>
        </nav>

        {/* Header */}
        <header className="mb-8 border-b border-gray-300 pb-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            {title}
          </h1>

          {catalogEntry?.description && (
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-900">
              {catalogEntry.description}
            </p>
          )}

          {catalogEntry?.whenToUse && (
            <p className="mt-3 text-xs leading-relaxed text-gray-500">
              <span className="font-mono text-gray-900">When to use</span>{" "}
              &mdash; {catalogEntry.whenToUse}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {catalogEntry?.tags.map((tag) => (
              <a
                key={tag}
                href={`/?tag=${tag}`}
                className="rounded-full border border-gray-300 px-2.5 py-0.5 text-[10px] font-mono text-gray-500 transition-colors hover:border-gray-500 hover:text-gray-900"
              >
                {getTagLabel(tag)}
              </a>
            ))}

            <span className="mx-1 text-gray-300">|</span>

            {apiRoutes.map((route) => (
              <span
                key={`${route.kind}:${route.route}`}
                className="rounded-full border border-gray-300 bg-background-200 px-2.5 py-0.5 text-[10px] font-mono text-gray-500"
              >
                {route.kind === "start" ? "POST" : route.kind === "readable" ? "SSE" : "API"}{" "}
                <span className="text-cyan-700">{route.route}</span>
              </span>
            ))}
          </div>
        </header>

        {/* Demo content — code workbench is the hero */}
        {children}
      </div>
    </main>
  );
}
