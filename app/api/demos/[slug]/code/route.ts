import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { demos, getDemo } from "@/lib/demos";
import { jsonError } from "@/lib/http/json-error";

type RouteParams = {
  params: Promise<{ slug: string }>;
};

type CodeFileRole = "workflow" | "page" | "api" | "component" | "support";
type ApiRouteKind = "start" | "readable" | "extra";

type DemoCodeFile = {
  path: string;
  role: CodeFileRole;
  contents: string;
};

type DemoApiRoute = {
  route: string;
  kind: ApiRouteKind;
};

async function collectSourceFiles(relativeDir: string): Promise<string[]> {
  const absoluteDir = join(process.cwd(), relativeDir);

  try {
    const entries = await readdir(absoluteDir, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const relativePath = `${relativeDir}/${entry.name}`;

        if (entry.isDirectory()) {
          return collectSourceFiles(relativePath);
        }

        if (
          !entry.isFile() ||
          !/\.(ts|tsx)$/.test(entry.name) ||
          entry.name.includes(".test.")
        ) {
          return [];
        }

        return [relativePath];
      }),
    );

    return nested.flat().sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

function getRouteKind(path: string, extraRoutes: Set<string>): ApiRouteKind {
  if (path.includes("/app/api/readable/[runId]/route.ts")) {
    return "readable";
  }

  if (extraRoutes.has(path)) {
    return "extra";
  }

  return "start";
}

function getFileRole(path: string): CodeFileRole {
  if (path.includes("/workflows/")) {
    return "workflow";
  }

  if (path.includes("/app/api/")) {
    return "api";
  }

  if (path.endsWith("/app/page.tsx")) {
    return "page";
  }

  if (path.includes("/app/components/")) {
    return "component";
  }

  return "support";
}

function toApiRoute(slug: string, path: string, extraRoutes: Set<string>): DemoApiRoute {
  const routePath = path
    .replace(`${slug}/app`, "")
    .replace(/\/route\.ts$/, "");

  return {
    route: routePath,
    kind: getRouteKind(path, extraRoutes),
  };
}

async function buildCodeBundle(
  filePaths: string[],
): Promise<DemoCodeFile[]> {
  const files = await Promise.all(
    filePaths.map(async (path): Promise<DemoCodeFile> => ({
      path,
      role: getFileRole(path),
      contents: await readFile(join(process.cwd(), path), "utf8"),
    })),
  );

  return files;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const demo = getDemo(slug);

  if (!demo) {
    const registeredSlugs = demos.map((entry) => entry.slug);

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

  const componentFiles = await collectSourceFiles(`${slug}/app/components`);
  const extraRoutes = new Set(demo.extraRoutes);
  const filePaths = [
    ...new Set([
      ...demo.workflowFiles,
      ...demo.apiRoutes,
      ...demo.extraRoutes,
      `${slug}/app/page.tsx`,
      `${slug}/app/layout.tsx`,
      ...componentFiles,
    ]),
  ];
  const files = await buildCodeBundle(filePaths);
  const apiRoutes = [...new Set([...demo.apiRoutes, ...demo.extraRoutes])].map((path) =>
    toApiRoute(slug, path, extraRoutes),
  );

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
    slug: demo.slug,
    title: demo.title,
    apiRoutes,
    files,
  });
}
