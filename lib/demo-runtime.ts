import { demos } from "./demos";

const DEV_BASE_PORT = 3101;

const demoIndexBySlug = new Map(demos.map((demo, index) => [demo.slug, index]));

function getDemoIndex(slug: string): number | null {
  return demoIndexBySlug.get(slug) ?? null;
}

function getScopedOriginEnvVar(slug: string): string | undefined {
  const envKey = `DEMO_ORIGIN_${slug.replace(/[^a-zA-Z0-9]/g, "_").toUpperCase()}`;
  return process.env[envKey];
}

export function getDemoPort(slug: string): number | null {
  const demoIndex = getDemoIndex(slug);

  if (demoIndex === null) {
    return null;
  }

  return DEV_BASE_PORT + demoIndex;
}

export function getDemoOrigin(slug: string): string | null {
  const port = getDemoPort(slug);

  if (port === null) {
    return null;
  }

  if (process.env.NODE_ENV !== "production") {
    return `http://127.0.0.1:${port}`;
  }

  const scopedOrigin = getScopedOriginEnvVar(slug);

  if (scopedOrigin) {
    return scopedOrigin;
  }

  const originTemplate = process.env.DEMO_ORIGIN_TEMPLATE;

  if (originTemplate) {
    return originTemplate.replaceAll("{slug}", slug);
  }

  return null;
}
