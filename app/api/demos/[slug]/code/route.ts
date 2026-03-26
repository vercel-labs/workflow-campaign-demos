import { NextResponse } from "next/server";
import { getAdapter, getRegisteredSlugs } from "@/lib/demo-adapters";
import { jsonError } from "@/lib/http/json-error";

type RouteParams = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const adapter = getAdapter(slug);

  if (!adapter) {
    const registeredSlugs = getRegisteredSlugs();

    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/demos/[slug]/code",
        action: "unknown_slug",
        slug,
        registeredSlugs,
        status: 404,
      }),
    );

    return jsonError(404, "UNKNOWN_SLUG", `Unknown demo slug "${slug}"`, {
      slug,
      registeredSlugs,
    });
  }

  const files = await adapter.getCodeBundle();

  console.info(
    JSON.stringify({
      level: "info",
      route: "/api/demos/[slug]/code",
      action: "code_bundle_returned",
      slug,
      status: 200,
      fileCount: files.length,
    }),
  );

  return NextResponse.json({
    ok: true,
    slug: adapter.slug,
    title: adapter.title,
    apiRoutes: adapter.apiRoutes.map(({ route, kind }) => ({ route, kind })),
    files,
  });
}
