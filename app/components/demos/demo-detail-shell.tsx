import type { ReactNode } from "react";
import type { DemoCatalogEntry } from "@/lib/demos";
import { getTagLabel } from "@/lib/taxonomy";
import { GALLERY_TITLE } from "@/lib/page-titles";

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
      className="min-h-screen bg-background-100 text-gray-1000"
    >
      {/* Compact top bar — back nav + title on one line */}
      <div className="border-b border-gray-300 bg-background-200/50 px-6 py-3">
        <div className="mx-auto flex max-w-7xl items-center gap-4">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 shrink-0 text-xs font-mono text-gray-500 transition-colors hover:text-gray-1000"
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
            {GALLERY_TITLE}
          </a>

          <span className="text-gray-300">/</span>

          <h1 className="text-sm font-semibold tracking-tight truncate">
            {title}
          </h1>

          {/* Tags inline in the top bar */}
          <div className="ml-auto hidden sm:flex items-center gap-1.5">
            {catalogEntry?.tags.map((tag) => (
              <a
                key={tag}
                href={`/?tag=${tag}`}
                className="rounded-full border border-gray-300 px-2 py-px text-[10px] font-mono text-gray-500 transition-colors hover:border-gray-500 hover:text-gray-900"
              >
                {getTagLabel(tag)}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6">
        {/* Context strip — description + when-to-use + API routes */}
        {catalogEntry && (
          <div className="flex flex-col gap-3 border-b border-gray-300/50 py-4 sm:flex-row sm:items-start sm:gap-6">
            <div className="min-w-0 flex-1">
              {catalogEntry.description && (
                <p className="text-sm leading-relaxed text-gray-1000">
                  {catalogEntry.description}
                </p>
              )}
              {catalogEntry.whenToUse && (
                <p className="mt-2 text-xs leading-relaxed text-gray-900">
                  <span className="font-mono text-cyan-700 text-[11px]">when&nbsp;to&nbsp;use</span>{" "}
                  {catalogEntry.whenToUse}
                </p>
              )}
            </div>

            {apiRoutes.length > 0 && (
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                {apiRoutes.map((route) => (
                  <span
                    key={`${route.kind}:${route.route}`}
                    className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 text-[10px] font-mono text-gray-500"
                  >
                    {route.kind === "start"
                      ? "POST"
                      : route.kind === "readable"
                        ? "SSE"
                        : "API"}{" "}
                    <span className="text-cyan-700">{route.route}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Demo content — code workbench is the hero, gets maximum space */}
        <div className="py-8">{children}</div>
      </div>
    </main>
  );
}
