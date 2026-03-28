// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

const meta = {
  "slug": "content-enricher",
  "uiStatus": "placeholder",
  "uiReasons": [
    "component_requires_props",
    "hardcoded_start_route:/api/enrich->/api/content-enricher"
  ],
  "routeMap": {
    "start": {
      "original": "/api/enrich",
      "gallery": "/api/content-enricher"
    },
    "readable": {
      "original": "/api/readable/[runId]",
      "gallery": "/api/readable/[runId]"
    },
    "extras": {
      "/api/enrich": "/api/content-enricher/enrich"
    }
  }
} as const;

export default function ContentEnricherNativePlaceholder() {
  return (
    <pre
      data-native-demo-meta={JSON.stringify(meta)}
      className="overflow-x-auto rounded-lg border border-gray-300 bg-background-200 p-4 text-xs text-gray-900"
    >
      {JSON.stringify(meta, null, 2)}
    </pre>
  );
}
