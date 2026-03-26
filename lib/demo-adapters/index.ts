/**
 * Demo adapter registry.
 *
 * Central lookup for all mounted demo adapters. Unknown slugs return undefined
 * so callers can render a 404.
 */

import type { DemoAdapter } from "./types";
import { fanOutAdapter } from "./fan-out";
import { approvalChainAdapter } from "./approval-chain";
import { cancellableExportAdapter } from "./cancellable-export";

const adapters: ReadonlyMap<string, DemoAdapter> = new Map([
  [fanOutAdapter.slug, fanOutAdapter],
  [approvalChainAdapter.slug, approvalChainAdapter],
  [cancellableExportAdapter.slug, cancellableExportAdapter],
]);

/** Resolve an adapter by slug. Returns undefined for unknown slugs. */
export function getAdapter(slug: string): DemoAdapter | undefined {
  return adapters.get(slug);
}

/** All registered adapter slugs. */
export function getRegisteredSlugs(): string[] {
  return [...adapters.keys()];
}

export type {
  DemoAdapter,
  DemoCodeFile,
  CodeFileRole,
  ApiRouteKind,
  DemoApiRoute,
  GalleryRouteContext,
  GalleryRouteHandler,
  GalleryRouteModule,
} from "./types";
