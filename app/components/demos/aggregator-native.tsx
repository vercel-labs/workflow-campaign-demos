// GENERATED — do not edit. Regenerate with: bun .scripts/generate-native-gallery.ts
"use client";

const meta = {
  "slug": "aggregator",
  "uiStatus": "placeholder",
  "uiReasons": [
    "component_requires_props",
    "hardcoded_extra_route:/api/signal->/api/aggregator/signal"
  ],
  "routeMap": {
    "start": {
      "original": "/api/aggregator",
      "gallery": "/api/aggregator"
    },
    "readable": {
      "original": "/api/readable/[runId]",
      "gallery": "/api/readable/[runId]"
    },
    "extras": {
      "/api/signal": "/api/aggregator/signal"
    }
  }
} as const;

export default function AggregatorNativePlaceholder() {
  return (
    <pre
      data-native-demo-meta={JSON.stringify(meta)}
      className="overflow-x-auto rounded-lg border border-gray-300 bg-background-200 p-4 text-xs text-gray-900"
    >
      {JSON.stringify(meta, null, 2)}
    </pre>
  );
}
