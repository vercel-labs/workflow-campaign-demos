import { NextResponse } from "next/server";
import { getAdapter } from "@/lib/demo-adapters";

type RouteParams = {
  params: Promise<{ slug: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const adapter = getAdapter(slug);

  if (!adapter) {
    console.info(
      JSON.stringify({
        level: "info",
        route: "/api/demos/[slug]/code",
        slug,
        status: 404,
      })
    );
    return NextResponse.json(
      { error: "unknown_slug", slug },
      { status: 404 }
    );
  }

  const files = await adapter.getCodeBundle();

  console.info(
    JSON.stringify({
      level: "info",
      route: "/api/demos/[slug]/code",
      slug,
      status: 200,
      fileCount: files.length,
    })
  );

  return NextResponse.json({
    slug: adapter.slug,
    title: adapter.title,
    files,
  });
}
