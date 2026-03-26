/**
 * Canonical demo catalog types and loader.
 *
 * The generated catalog lives at lib/demos.generated.json and is produced by:
 *   bun .scripts/generate-gallery-catalog.ts
 */

export type SourceMode =
  | "filesystem"
  | "inline-page-string"
  | "mixed"
  | "unknown";

export type DemoCatalogEntry = {
  slug: string;
  title: string;
  description: string;
  whenToUse: string;
  reviewedBy: string;
  tags: string[];
  sourceMode: SourceMode;
  workflowFiles: string[];
  apiRoutes: string[];
  extraRoutes: string[];
};

export type DemoCatalog = DemoCatalogEntry[];

// eslint-disable-next-line @typescript-eslint/no-require-imports
const generated: DemoCatalog = require("./demos.generated.json");

/** All demos sorted by slug. */
export const demos: DemoCatalog = generated;

/** Lookup a single demo by slug. Returns undefined for unknown slugs. */
export function getDemo(slug: string): DemoCatalogEntry | undefined {
  return demos.find((d) => d.slug === slug);
}
