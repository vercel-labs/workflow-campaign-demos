/**
 * Demo adapter contract.
 *
 * Each adapter wraps a standalone demo directory so the gallery can:
 *   - render the demo UI at /demos/[slug]
 *   - serve its workflow source code at /api/demos/[slug]/code
 *   - proxy its API routes (start, readable, extras)
 *
 * Adapters may wrap or re-export demo code but MUST NOT move, rename,
 * or mutate files inside the original demo directory.
 */

import type { ReactElement } from "react";

export type CodeFileRole =
  | "workflow"
  | "page"
  | "api"
  | "component"
  | "support";

export type DemoCodeFile = {
  /** Relative path from repo root (e.g. "fan-out/workflows/incident-fanout.ts"). */
  path: string;
  role: CodeFileRole;
  contents: string;
};

export type ApiRouteKind = "start" | "readable" | "extra";

export type GalleryRouteContext = {
  params: Promise<Record<string, string>>;
};

export type GalleryRouteHandler = (
  request: Request,
  context: GalleryRouteContext
) => Promise<Response> | Response;

export type GalleryRouteModule = Partial<{
  GET: GalleryRouteHandler;
  POST: GalleryRouteHandler;
  PUT: GalleryRouteHandler;
  PATCH: GalleryRouteHandler;
  DELETE: GalleryRouteHandler;
}>;

export type DemoApiRoute = {
  /** Route path relative to the demo (e.g. "/api/fan-out"). */
  route: string;
  kind: ApiRouteKind;
  /** Lazy loader for the route module. Returns method handlers (GET, POST, etc.). */
  load: () => Promise<GalleryRouteModule>;
};

export type DemoAdapter = {
  slug: string;
  title: string;
  /** Render only the runnable demo body, not the outer page shell. */
  renderDemo: () => Promise<ReactElement>;
  /** Return the code files this demo exposes for the agent-facing code API. */
  getCodeBundle: () => Promise<DemoCodeFile[]>;
  /** API routes this demo provides, with lazy loaders. */
  apiRoutes: DemoApiRoute[];
};
